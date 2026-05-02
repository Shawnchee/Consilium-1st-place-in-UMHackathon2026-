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
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()
    yesterday = (now_dt - timedelta(days=1)).isoformat()
    seven_days_ago = (now_dt - timedelta(days=7)).isoformat()

    # 1. Determine the incremental window
    # We only want corrections since the last time we updated the SOPs
    graph = app.state.graph
    store = graph.store
    ns = ("clinic_knowledge", clinic_id)
    
    existing_sops = await store.aget(ns, "master_sops")
    last_update_str = (existing_sops.value if existing_sops else {}).get("updated_at")
    
    if last_update_str:
        # Use the exact time of last update to avoid re-processing old corrections
        start_time = last_update_str
    else:
        # Fallback to last 24h for the first run
        start_time = yesterday

    # Fetch data
    corrections = (
        supabase.table("corrections")
        .select("feature, glm_output, doctor_correction, rejection_reason, created_at, approved")
        .eq("feature", "triage")
        .eq("approved", True)
        .gt("created_at", start_time)
        .execute()
    ).data or []

    # Visits drive the Clinical Trends (Doctor-facing insights)
    # Trends always use a 7-day rolling window for context, so we keep this fixed.
    visits = (
        supabase.table("visits")
        .select("visit_date, soap_note, prescription")
        .gte("created_at", seven_days_ago)
        .execute()
    ).data or []

    if not visits and not corrections:
        return {"status": "skipped", "reason": "no new data to consolidate"}

    llm = get_llm()

    # 2. Synthesize Master SOPs (AI behavior)
    if corrections:
        old_rules = (existing_sops.value if existing_sops else {}).get("rules", [])
        
        sop_prompt = (
            f"Current Date: {now_str}\n"
            "You are the 'Triage Logic' synthesizer. Update the 'Master Triage SOPs' "
            "based on today's doctor corrections.\n\n"
            "TEMPORAL & VERIFICATION RULES:\n"
            "- 'pinned': true rules are permanent and NEVER expire. (Requires 'verified': true)\n"
            "- 'verified': true, 'pinned': false rules expire 30 days after 'last_reinforced_at'.\n"
            "- 'verified': false rules are AI suggestions. They are ACTIVE but need doctor review.\n"
            "- IMPORTANT: All NEW rules synthesized from 'TODAY'S CORRECTIONS' MUST start with 'verified': false and 'pinned': false.\n"
            "- If today's correction reinforces an existing rule, update its 'last_reinforced_at' to today but KEEP its existing 'verified' and 'pinned' status.\n\n"
            "OLD RULES:\n" + json.dumps(old_rules, indent=2) + "\n\n"
            "TODAY'S CORRECTIONS:\n" + json.dumps(corrections, indent=2) + "\n\n"
            "Output ONLY JSON: {'rules': [{'action': '...', 'condition': '...', 'added_date': '...', 'last_reinforced_at': '...', 'pinned': bool, 'verified': bool}], 'updated_at': '...'}"
        )
        resp = await llm.ainvoke([("system", sop_prompt), ("human", "Update SOPs.")])
        try:
            new_sops = json.loads(_strip_fences(str(resp.content)))
            new_sops["updated_at"] = now_str
            await store.aput(ns, "master_sops", new_sops)
            log.info("updated master_sops for %s", clinic_id)
        except:
            log.error("Failed to parse SOP synthesis")

    # 3. Synthesize Clinical Trends (7-day rolling window)
    if visits:
        existing_trends_item = await store.aget(ns, "clinic_trends")
        old_trends = (existing_trends_item.value if existing_trends_item else {}).get("trends", [])

        trend_prompt = (
            f"Current Date: {now_str}\n"
            "You are the 'Clinical Insight' engine. Update the rolling 7-day trends.\n\n"
            "INSTRUCTIONS:\n"
            "- Category Labels MUST be one of: 'Common Diagnoses', 'Clinical Presentation', 'Prescription Patterns', 'Diagnostic Approach', 'Follow-up Protocol'.\n"
            "- TEMPORAL WEIGHTING: Distinguish between 'Persistent' (seen across multiple days), 'Emerging' (new in the last 48h), and 'Fading' (seen 4-7 days ago but not since).\n"
            "- WRITING STYLE: Use professional, high-density veterinarian language. \n"
            "- BREVITY: Each summary MUST be under 40 words. Be direct. (e.g., 'Spike in Otitis cases since Monday; mostly Golden Retrievers. Resolve with Otomax.')\n"
            "- If a trend from 'PREVIOUS TRENDS' is seen again in 'LAST 7 DAYS OF VISITS', reinforce it and update its 'last_seen' date to today.\n"
            "- If an old trend is missing from recent data, move it to a 'fading' category or remove it.\n\n"
            "PREVIOUS TRENDS:\n" + json.dumps(old_trends, indent=2) + "\n\n"
            "LAST 7 DAYS OF VISITS:\n" + json.dumps(visits, indent=2) + "\n\n"
            "Output ONLY JSON: {'trends': [{'label': '...', 'last_seen': '...', 'is_persisting': bool, 'summary': '...'}], 'updated_at': '...'}"
        )
        resp = await llm.ainvoke([("system", trend_prompt), ("human", "Update trends.")])
        try:
            new_trends = json.loads(_strip_fences(str(resp.content)))
            new_trends["updated_at"] = now_str
            await store.aput(ns, "clinic_trends", new_trends)
            log.info("updated clinic_trends for %s", clinic_id)
        except:
            log.error("Failed to parse trend synthesis")
    
    return {"status": "success"}
    

@app.get("/knowledge")
async def get_knowledge(clinic_id: str) -> dict[str, Any]:
    """Fetch synthesized knowledge for the management dashboard."""
    graph = app.state.graph
    store = graph.store
    ns = ("clinic_knowledge", clinic_id)
    
    sops_item = await store.aget(ns, "master_sops")
    trends_item = await store.aget(ns, "clinic_trends")
    
    sops = sops_item.value if sops_item else {"rules": [], "updated_at": None}
    trends = trends_item.value if trends_item else {"trends": [], "updated_at": None}
    
    return {
        "rules": sops.get("rules", []),
        "trends": trends.get("trends", []),
        "updatedAt": sops.get("updated_at") or trends.get("updated_at")
    }


@app.post("/knowledge")
async def update_knowledge(req: dict[str, Any]) -> dict[str, bool]:
    """Update clinic knowledge (e.g. pinning/verifying rules)."""
    clinic_id = req.get("clinic_id")
    rules = req.get("rules")
    if not clinic_id or rules is None:
        raise HTTPException(status_code=400, detail="clinic_id and rules required")
        
    graph = app.state.graph
    store = graph.store
    ns = ("clinic_knowledge", clinic_id)
    
    # We update the rules but preserve the updated_at timestamp or set a new one
    await store.aput(ns, "master_sops", {
        "rules": rules,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True}
