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
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.store.base import BaseStore

from .llm import get_llm
from .prompts import build_triage_system_prompt
from .state import ConsultationNote
from .store import consultation_namespace
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
    patient_name: str
    text: str
    tool_call_count: int
    conversation_text: str

    # populated by retrieve_history
    retrieved_history: list[ConsultationNote]

    # populated by triage_agent
    output: TriageOutput | None


async def retrieve_history_node(
    state: TriageState,
    *,
    store: BaseStore,
) -> dict:
    ns = consultation_namespace(state["clinic_id"], state["patient_id"])
    items = await store.asearch(ns)
    return {"retrieved_history": [item.value for item in items]}


_SCHEMA_HINT = json.dumps(TriageOutput.model_json_schema(), indent=2)


async def triage_agent_node(state: TriageState) -> dict:
    history = state.get("retrieved_history", [])
    base_system = build_triage_system_prompt(
        history,
        patient_name=state["patient_name"],
        tool_call_count=state["tool_call_count"],
        conversation_text=state["conversation_text"],
    )
    system = (
        f"{base_system}\n\n"
        "Respond with ONLY a single JSON object (no prose, no markdown "
        "fences, no commentary) matching this schema:\n"
        f"{_SCHEMA_HINT}"
    )

    llm = get_llm()
    response = await llm.ainvoke(
        [
            ("system", system),
            ("human", state["text"]),
        ]
    )
    raw = response.content if isinstance(response.content, str) else str(response.content)
    cleaned = _strip_fences(raw)

    try:
        output = TriageOutput.model_validate_json(cleaned)
    except Exception as e:
        raise RuntimeError(
            f"triage agent returned invalid JSON: {e}\n--- raw ---\n{raw}"
        ) from e
    return {"output": output}


def build_triage_graph() -> StateGraph:
    builder = StateGraph(TriageState)
    builder.add_node("retrieve_history", retrieve_history_node)
    builder.add_node("triage_agent", triage_agent_node)

    builder.add_edge(START, "retrieve_history")
    builder.add_edge("retrieve_history", "triage_agent")
    builder.add_edge("triage_agent", END)

    return builder
