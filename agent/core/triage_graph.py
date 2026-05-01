"""Triage graph — owner-facing follow-up flow.

Shape:
    START ─▶ retrieve_history ─▶ triage_agent ─▶ END

Differs from `graph.py` in three ways:
  - LLM is asked to emit JSON matching `TriageOutput`; we parse it
    ourselves so we can strip the ```json fences Z.AI's GLM likes to
    wrap output in. (`with_structured_output` choked on those.)
  - The 5 PRD tools are output categories (kind="tool_call"), not
    LangGraph tools — no tool_node, no loop.
  - State carries the conversation text + patient name + tool budget
    so the prompt can reason about whether to ask or commit.
"""
from __future__ import annotations

import json
import re
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.store.base import BaseStore

from .db import get_supabase
from .llm import get_llm
from .prompts import build_triage_system_prompt
from .state import ConsultationNote
from .triage import TriageOutput


# Strip optional ```json … ``` (or plain ```) fences that some chat
# models add around JSON output.
_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


def _strip_fences(text: str) -> str:
    text = text.strip()
    m = _FENCE_RE.match(text)
    return m.group(1).strip() if m else text


class TriageState(TypedDict):
    # inputs
    patient_id: str
    clinic_id: str
    clinic_name: str
    patient_name: str
    text: str
    tool_call_count: int
    messages: Annotated[list[AnyMessage], add_messages]

    # populated by retrieve_history
    retrieved_history: list[ConsultationNote]
    clinic_sops: list[dict]

    # populated by triage_agent
    output: TriageOutput | None


async def retrieve_history_node(
    state: TriageState,
    *,
    store: BaseStore,
) -> dict:
    # 1. Fetch latest 5 patient history from Supabase `visits`
    supabase = get_supabase()
    response = (
        supabase.table("visits")
        .select("visit_date, soap_note, prescription")
        .eq("patient_id", state["patient_id"])
        .order("visit_date", desc=True)
        .limit(5)
        .execute()
    )
    visits_history = response.data or []

    # 2. Fetch synthesized Clinic Triage SOPs from LangGraph store
    ns = ("clinic_knowledge", state["clinic_id"])
    sop_item = await store.aget(ns, "master_sops")
    clinic_sops = sop_item.value if sop_item else {"rules": []}

    return {"retrieved_history": visits_history, "clinic_sops": [clinic_sops]}


_SCHEMA_HINT = json.dumps(TriageOutput.model_json_schema(), indent=2)


async def triage_agent_node(state: TriageState) -> dict:
    history = state.get("retrieved_history", [])
    clinic_sops = state.get("clinic_sops", [])
    base_system = build_triage_system_prompt(
        history,
        clinic_sops=clinic_sops,
        patient_name=state["patient_name"],
        tool_call_count=state["tool_call_count"],
        clinic_name=state.get("clinic_name", "the clinic"),
    )
    system = (
        f"{base_system}\n\n"
        "Respond with ONLY a single JSON object (no prose, no markdown "
        "fences, no commentary) matching this schema:\n"
        f"{_SCHEMA_HINT}"
    )

    llm = get_llm()
    # Combine system prompt, existing thread messages, and the new turn
    # LangGraph's checkpointer handles the historical 'messages' list.
    response = await llm.ainvoke(
        [
            ("system", system),
            *state["messages"],
            ("human", state["text"]),
        ]
    )
    raw = response.content if isinstance(response.content, str) else str(response.content)
    cleaned = _strip_fences(raw)

    try:
        output = TriageOutput.model_validate_json(cleaned)
    except Exception as e:
        # If the LLM failed, we still return the user turn so it's persisted in the thread
        return {
            "messages": [("human", state["text"]), ("ai", raw)],
            "output": None
        }

    return {
        "messages": [("human", state["text"]), ("ai", raw)],
        "output": output
    }


def build_triage_graph() -> StateGraph:
    builder = StateGraph(TriageState)
    builder.add_node("retrieve_history", retrieve_history_node)
    builder.add_node("triage_agent", triage_agent_node)

    builder.add_edge(START, "retrieve_history")
    builder.add_edge("retrieve_history", "triage_agent")
    builder.add_edge("triage_agent", END)

    return builder
