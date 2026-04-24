"""AgentState — the typed dict that flows through the LangGraph graph.

`messages` uses the standard `add_messages` reducer so nodes can return
partial message lists and LangGraph appends them for us.
"""
from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class ConsultationNote(TypedDict):
    """Shape of one past consultation note pulled from the store."""

    note_id: str
    patient_id: str
    chief_complaint: str
    diagnosis: str
    treatment: str
    consulted_at: str


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    patient_id: str
    clinic_id: str
    retrieved_history: list[ConsultationNote]
