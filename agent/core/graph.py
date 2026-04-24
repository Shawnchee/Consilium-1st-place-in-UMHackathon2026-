"""LangGraph wiring.

Graph shape:
    START ─▶ retrieve_history ─▶ agent ─┬─▶ END
                                        └─▶ tools ─▶ agent (loop)

- `retrieve_history` pulls past consultation notes from AsyncPostgresStore
  and stashes them in state.retrieved_history.
- `agent` invokes the Z.AI GLM (via langchain_openai.ChatOpenAI) with the
  retrieved history folded into a fresh SystemMessage, and TOOLS bound
  via `.bind_tools()` so the model can call them natively.
- `tools` runs the tool call, appends a ToolMessage, loops back to agent.

The store is supplied via `.compile(store=...)`. The retrieve node receives
it as an injected kwarg; tools receive it via InjectedStore.
"""
from __future__ import annotations

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.store.base import BaseStore

from .llm import get_llm
from .prompts import build_system_prompt
from .state import AgentState
from .store import consultation_namespace
from .tools import TOOLS


async def retrieve_history_node(
    state: AgentState,
    *,
    store: BaseStore,
) -> dict:
    """Pull this patient's past consultation notes into state."""
    ns = consultation_namespace(state["clinic_id"], state["patient_id"])
    items = await store.asearch(ns)
    return {"retrieved_history": [item.value for item in items]}


async def agent_node(state: AgentState) -> dict:
    """Call Z.AI GLM with retrieved history in the system prompt + bound tools."""
    history = state.get("retrieved_history", [])
    system = SystemMessage(content=build_system_prompt(history))

    # Rebuild the system message every turn from retrieved_history so newly
    # saved notes show up on the very next turn (the feedback loop).
    non_system = [m for m in state["messages"] if m.type != "system"]
    llm = get_llm().bind_tools(TOOLS)
    ai = await llm.ainvoke([system, *non_system])
    return {"messages": [ai]}


def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)
    builder.add_node("retrieve_history", retrieve_history_node)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(TOOLS))

    builder.add_edge(START, "retrieve_history")
    builder.add_edge("retrieve_history", "agent")
    builder.add_conditional_edges(
        "agent",
        tools_condition,
        {"tools": "tools", END: END},
    )
    builder.add_edge("tools", "agent")

    return builder
