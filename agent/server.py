"""FastAPI sidecar — exposes the triage graph over HTTP.

The Next.js Telegram handler (lib/telegram-handler.ts) POSTs to /triage
instead of calling the local mock fixture. Response shape mirrors
`TriageFixtureOutput` from lib/glm-fixtures.ts so the TS handler
doesn't have to change.

Usage:
    uvicorn agent.server:app --host 0.0.0.0 --port 8000 --reload

Env (loaded from agent/.env via python-dotenv):
    POSTGRES_URL, ZAI_API_KEY, ZAI_MODEL, ZAI_BASE_URL
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from agent.core.store import open_store
from agent.core.triage import TriageOutput, TriageRequest
from agent.core.triage_graph import build_triage_graph

load_dotenv(dotenv_path="agent/.env")
load_dotenv()

log = logging.getLogger("agent.server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open the store + compile the graph once at startup."""
    async with open_store() as store:
        graph = build_triage_graph().compile(store=store)
        app.state.graph = graph
        log.info("triage graph compiled, store ready")
        yield


app = FastAPI(title="Consilium triage agent", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _conversation_text(turns: list[Any]) -> str:
    return " | ".join(f"{t.role}: {t.text}" for t in turns)


@app.post("/triage", response_model=TriageOutput)
async def triage(req: TriageRequest) -> TriageOutput:
    started = time.perf_counter()
    graph = app.state.graph
    initial = {
        "patient_id": req.patient_id,
        "clinic_id": req.clinic_id,
        "patient_name": req.patient_name or "your pet",
        "text": req.text,
        "tool_call_count": req.tool_call_count,
        "conversation_text": _conversation_text(req.prior_conversation),
        "retrieved_history": [],
        "output": None,
    }

    try:
        result = await graph.ainvoke(initial)
    except Exception as e:
        log.exception("triage graph failed")
        raise HTTPException(status_code=500, detail=f"agent error: {e}") from e

    output: TriageOutput | None = result.get("output")
    if output is None:
        raise HTTPException(status_code=500, detail="agent produced no output")

    elapsed = (time.perf_counter() - started) * 1000
    if output.kind == "decision":
        log.info(
            "triage followup=%s decision=%s confidence=%.2f (%dms)",
            req.followup_id,
            output.decision,
            output.confidence or 0.0,
            elapsed,
        )
    else:
        log.info(
            "triage followup=%s tool_call=%s (%dms)",
            req.followup_id,
            output.tool,
            elapsed,
        )
    return output
