import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

from agent.core.db import get_supabase
from agent.core.llm import get_llm
from agent.core.store import open_store
from agent.core.triage_graph import _strip_fences

# Load env from .env files
load_dotenv()

log = logging.getLogger("agent.consolidate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

async def run_consolidation():
    # Use CLINIC_ID from env, fallback to default for testing
    clinic_id = os.getenv("CLINIC_ID", "pawsclinic_kl")
    log.info("Starting consolidation for clinic: %s", clinic_id)
    
    supabase = get_supabase()
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.isoformat()
    yesterday = (now_dt - timedelta(days=1)).isoformat()
    seven_days_ago = (now_dt - timedelta(days=7)).isoformat()

    async with open_store() as store:
        ns = ("clinic_knowledge", clinic_id)
        
        # 1. Determine incremental window (High Watermark)
        existing_sops = await store.aget(ns, "master_sops")
        last_update_str = (existing_sops.value if existing_sops else {}).get("updated_at")
        
        start_time = last_update_str if last_update_str else yesterday
        log.info("Incremental window start: %s", start_time)

        # 2. Fetch new corrections since last update
        corrections = (
            supabase.table("corrections")
            .select("feature, glm_output, doctor_correction, rejection_reason, created_at, approved")
            .eq("feature", "triage")
            .eq("approved", True)
            .gt("created_at", start_time)
            .execute()
        ).data or []
        
        # 3. Fetch visits for the 7-day rolling trends
        visits = (
            supabase.table("visits")
            .select("visit_date, soap_note, prescription")
            .gte("created_at", seven_days_ago)
            .execute()
        ).data or []

        if not visits and not corrections:
            log.info("No new data to consolidate. Skipping.")
            return

        llm = get_llm()

        # 4. Master SOP Synthesis (AI Rules)
        if corrections:
            log.info("Processing %d new corrections...", len(corrections))
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
                log.info("Successfully updated master_sops in LangGraph store.")
            except Exception as e:
                log.error("Failed to parse SOP synthesis JSON: %s", e)

        # 5. Clinical Trend Synthesis (Doctor Insights)
        if visits:
            log.info("Processing visits from the last 7 days...")
            existing_trends_item = await store.aget(ns, "clinic_trends")
            old_trends = (existing_trends_item.value if existing_trends_item else {}).get("trends", [])

            trend_prompt = (
                f"Current Date: {now_str}\n"
                "You are the 'Clinical Insight' engine. Update the rolling 7-day trends.\n\n"
                "INSTRUCTIONS:\n"
                "- Category Labels MUST be one of: 'Common Diagnoses', 'Clinical Presentation', 'Prescription Patterns', 'Diagnostic Approach', 'Follow-up Protocol'.\n"
                "- TEMPORAL WEIGHTING: Distinguish between 'Persistent' (seen across multiple days), 'Emerging' (new in the last 48h), and 'Fading' (seen 4-7 days ago but not since).\n"
                "- WRITING STYLE: Use professional, high-density veterinarian language. \n"
                "- BREVITY: Each summary MUST be under 40 words. Be direct.\n"
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
                log.info("Successfully updated clinic_trends in LangGraph store.")
            except Exception as e:
                log.error("Failed to parse trend synthesis JSON: %s", e)

if __name__ == "__main__":
    asyncio.run(run_consolidation())
