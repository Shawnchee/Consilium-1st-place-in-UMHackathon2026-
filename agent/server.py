import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from agent.core.db import get_supabase
from agent.core.llm import get_llm
from agent.core.store import open_store
from agent.core.triage import TriageOutput, TriageRequest
from agent.core.triage_graph import build_triage_graph, _strip_fences

# Try loading from common locations: root .env, agent/.env, or system env
load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path="agent/.env")
load_dotenv(dotenv_path="../.env")
load_dotenv()

log = logging.getLogger("agent.server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open the store + checkpointer + compile the graph once at startup."""
    # We use separate pools for store and checkpointer for simplicity,
    # as they each manage their own lifecycle via context managers.
    db_url = os.getenv("POSTGRES_URL") or os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    async with open_store() as store, AsyncPostgresSaver.from_conn_string(
        db_url
    ) as checkpointer:
        await checkpointer.setup()
        graph = build_triage_graph().compile(store=store, checkpointer=checkpointer)
        app.state.graph = graph
        log.info("triage graph compiled with checkpointer, store ready")
        yield


app = FastAPI(title="Consilium triage agent", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/triage", response_model=TriageOutput)
async def triage(req: TriageRequest) -> TriageOutput:
    started = time.perf_counter()
    graph = app.state.graph
    
    # thread_id ensures LangGraph retrieves the correct conversation history
    config = {"configurable": {"thread_id": f"followup_{req.followup_id}"}}
    
    initial = {
        "patient_id": req.patient_id,
        "clinic_id": req.clinic_id,
        "clinic_name": req.clinic_name or "the clinic",
        "patient_name": req.patient_name or "your pet",
        "text": req.text,
        "tool_call_count": req.tool_call_count,
        "retrieved_history": [],
        "output": None,
    }

    try:
        # LangGraph will automatically pull/save 'messages' to the checkpointer
        # based on the thread_id in config.
        result = await graph.ainvoke(initial, config=config)
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


@app.post("/consolidate_memory")
async def consolidate_memory(req: dict[str, Any]) -> dict[str, str]:
    """Nightly cron job: synthesizes 'Clinic SOPs' (AI behavior) and 'Clinical Trends' (Doctor info)."""
    clinic_id = req.get("clinic_id")
    if not clinic_id:
        raise HTTPException(status_code=400, detail="clinic_id required")

    supabase = get_supabase()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    # 1. Fetch data
    # Corrections drive the Master SOPs (AI behavior rules)
    corrections = (
        supabase.table("corrections")
        .select("feature, glm_output, doctor_correction, rejection_reason")
        .eq("feature", "triage") # Only triage corrections for the triage agent
        .gte("created_at", yesterday)
        .execute()
    ).data or []

    # Visits drive the Clinical Trends (Doctor-facing insights)
    visits = (
        supabase.table("visits")
        .select("visit_date, soap_note, prescription")
        .gte("created_at", yesterday)
        .execute()
    ).data or []

    if not visits and not corrections:
        return {"status": "skipped", "reason": "no new data to consolidate"}

    graph = app.state.graph
    store = graph.store
    ns = ("clinic_knowledge", clinic_id)
    llm = get_llm()

    # 2. Synthesize Master SOPs (AI behavior)
    if corrections:
        existing_sops = await store.aget(ns, "master_sops")
        old_rules = (existing_sops.value if existing_sops else {}).get("rules", [])
        
        sop_prompt = (
            "You are the 'Triage Logic' synthesizer. Update the 'Master Triage SOPs' "
            "based on today's doctor corrections. Focus on escalation thresholds and tone.\n\n"
            "OLD RULES:\n" + "\n".join(f"- {r}" for r in old_rules) + "\n\n"
            "TODAY'S CORRECTIONS:\n" + json.dumps(corrections, indent=2) + "\n\n"
            "Output ONLY JSON: {'rules': [...], 'updated_at': '...'}"
        )
        resp = await llm.ainvoke([("system", sop_prompt), ("human", "Update SOPs.")])
        try:
            new_sops = json.loads(_strip_fences(str(resp.content)))
            new_sops["updated_at"] = datetime.now(timezone.utc).isoformat()
            await store.aput(ns, "master_sops", new_sops)
            log.info("updated master_sops for %s", clinic_id)
        except:
            log.error("Failed to parse SOP synthesis")

    # 3. Synthesize Clinical Trends (Doctor-facing insights)
    if visits:
        trend_prompt = (
            "You are the 'Clinical Insight' engine. Summarize the latest trends from today's visits "
            "for the doctor's review (e.g., common diagnoses, prescription patterns).\n\n"
            "TODAY'S VISITS:\n" + json.dumps(visits, indent=2) + "\n\n"
            "Output ONLY JSON: {'trends': [...], 'updated_at': '...'}"
        )
        resp = await llm.ainvoke([("system", trend_prompt), ("human", "Summarize trends.")])
        try:
            new_trends = json.loads(_strip_fences(str(resp.content)))
            new_trends["updated_at"] = datetime.now(timezone.utc).isoformat()
            await store.aput(ns, "clinic_trends", new_trends)
            log.info("updated clinic_trends for %s", clinic_id)
        except:
            log.error("Failed to parse trend synthesis")
    
    return {"status": "success"}
