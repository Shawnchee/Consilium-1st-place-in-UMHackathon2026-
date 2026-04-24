"""Tool skeletons wired to AsyncPostgresStore via LangGraph's InjectedStore.

The `store` kwarg is hidden from the LLM's tool schema by `InjectedStore`,
so the model only sees the business args (patient_id, query, etc.).

Feedback loop:
  - `save_consultation_note` is the WRITE path. The vet system (or the
    agent itself) calls this after a consultation; the note lives in
    PostgresStore forever.
  - `get_patient_history` / `search_past_consultations` are the READ
    path. The agent calls them mid-turn to pull relevant prior notes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from langchain_core.tools import tool
from langgraph.prebuilt import InjectedStore
from langgraph.store.base import BaseStore

from .state import ConsultationNote
from .store import consultation_namespace


@tool
async def get_patient_history(
    patient_id: str,
    clinic_id: str,
    store: Annotated[BaseStore, InjectedStore()],
) -> list[dict]:
    """Return all past consultation notes for this patient."""
    ns = consultation_namespace(clinic_id, patient_id)
    items = await store.asearch(ns)
    return [item.value for item in items]


@tool
async def search_past_consultations(
    query: str,
    patient_id: str,
    clinic_id: str,
    store: Annotated[BaseStore, InjectedStore()],
) -> list[dict]:
    """Search this patient's past consultations by free-text query.

    Skeleton: delegates to `store.asearch(ns, query=...)`. For true
    semantic search, configure the store with an embeddings index; the
    call signature is the same.
    """
    ns = consultation_namespace(clinic_id, patient_id)
    items = await store.asearch(ns, query=query)
    return [item.value for item in items]


@tool
async def save_consultation_note(
    patient_id: str,
    clinic_id: str,
    chief_complaint: str,
    diagnosis: str,
    treatment: str,
    store: Annotated[BaseStore, InjectedStore()],
) -> str:
    """Persist a new consultation note. Feedback-loop write path."""
    ns = consultation_namespace(clinic_id, patient_id)
    note_id = str(uuid.uuid4())
    note: ConsultationNote = {
        "note_id": note_id,
        "patient_id": patient_id,
        "chief_complaint": chief_complaint,
        "diagnosis": diagnosis,
        "treatment": treatment,
        "consulted_at": datetime.now(timezone.utc).isoformat(),
    }
    await store.aput(ns, note_id, note)
    return note_id


TOOLS = [get_patient_history, search_past_consultations, save_consultation_note]
