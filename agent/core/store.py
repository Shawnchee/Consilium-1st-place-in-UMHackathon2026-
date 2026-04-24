"""AsyncPostgresStore wrapper — backs the feedback-loop memory.

Namespace convention:
    ("consultations", clinic_id, patient_id)
        key   = note_id
        value = ConsultationNote dict

`open_store()` is an async context manager that yields a ready-to-use
store (tables created on first run via `.setup()`). The graph receives
the store via `.compile(store=...)`; tools reach it via InjectedStore.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from langgraph.store.postgres import AsyncPostgresStore


_POSTGRES_URL_ENV = "POSTGRES_URL"


def _postgres_url() -> str:
    url = os.getenv(_POSTGRES_URL_ENV)
    if not url:
        raise RuntimeError(
            f"{_POSTGRES_URL_ENV} is not set — copy agent/.env.example to "
            "agent/.env and fill it in."
        )
    return url


@asynccontextmanager
async def open_store():
    """Open a fresh AsyncPostgresStore, run .setup(), yield it."""
    async with AsyncPostgresStore.from_conn_string(_postgres_url()) as store:
        await store.setup()
        yield store


def consultation_namespace(clinic_id: str, patient_id: str) -> tuple[str, ...]:
    return ("consultations", clinic_id, patient_id)
