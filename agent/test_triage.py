"""Smoke test the triage graph end-to-end without going through HTTP.

Runs three scenarios against the real Z.AI GLM + AsyncPostgresStore:
  1. Strong red-flag → decision=escalate (no tool call)
  2. Ambiguous visual symptom + toolCallCount=0 → tool_call=request_photo
  3. Ambiguous visual symptom + toolCallCount=1 → forced decision

Usage (from repo root):
    python -m agent.test_triage
"""
from __future__ import annotations

import asyncio
import json
import uuid

from dotenv import load_dotenv

from agent.core.store import open_store
from agent.core.triage_graph import build_triage_graph


DEMO_CLINIC = "clinic_demo"
DEMO_PATIENT = f"patient_demo_{uuid.uuid4().hex[:6]}"


SCENARIOS = [
    {
        "label": "Red-flag (should escalate, no tool_call)",
        "text": "She just had a seizure and is unconscious",
        "tool_call_count": 0,
        "conversation_text": "",
    },
    {
        "label": "Visual symptom + first turn (should request_photo)",
        "text": "There's some blood near her stitches",
        "tool_call_count": 0,
        "conversation_text": "",
    },
    {
        "label": "Same symptom + budget spent (forced decision)",
        "text": "The bleeding is getting worse and the stitches look loose",
        "tool_call_count": 1,
        "conversation_text": (
            "owner: There's some blood near her stitches | "
            "bot_tool(request_photo): Could you send a clear close-up photo?"
        ),
    },
]


async def main() -> None:
    async with open_store() as store:
        graph = build_triage_graph().compile(store=store)

        for s in SCENARIOS:
            print("\n" + "─" * 64)
            print(f"  {s['label']}")
            print("─" * 64)
            initial = {
                "patient_id": DEMO_PATIENT,
                "clinic_id": DEMO_CLINIC,
                "patient_name": "Bella",
                "text": s["text"],
                "tool_call_count": s["tool_call_count"],
                "conversation_text": s["conversation_text"],
                "retrieved_history": [],
                "output": None,
            }
            result = await graph.ainvoke(initial)
            output = result["output"]
            print(json.dumps(output.model_dump(by_alias=False, exclude_none=True), indent=2))


if __name__ == "__main__":
    load_dotenv(dotenv_path="agent/.env")
    load_dotenv()
    asyncio.run(main())
