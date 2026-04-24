"""Demo the real graph end-to-end against Z.AI GLM + AsyncPostgresStore.

What you'll see:
    Turn 1 — fresh patient, empty history. The agent answers with no
             prior notes in context.
    [seed] — a consultation note is written into the store (simulating
             the doctor finishing a consult).
    Turn 2 — same patient, same question. `retrieve_history` now finds
             the seeded note and folds it into the system prompt, so
             the model references it. This is the feedback loop.

Usage (from repo root):
    python -m agent.run_local

Prereqs:
    - agent/.env with POSTGRES_URL + ZAI_API_KEY + ZAI_MODEL + ZAI_BASE_URL
    - pip install -r agent/requirements.txt
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

from agent.core.graph import build_graph
from agent.core.store import consultation_namespace, open_store


DEMO_CLINIC = "clinic_demo"
DEMO_PATIENT = f"patient_demo_{uuid.uuid4().hex[:6]}"
DEMO_QUESTION = "Bella is vomiting again after eating. What should I do, and has this happened before?"


def _print_turn_banner(label: str) -> None:
    bar = "─" * 64
    print(f"\n{bar}\n  {label}\n{bar}")


def _print_event(event: dict) -> None:
    msgs = event.get("messages", [])
    hist = event.get("retrieved_history", [])
    last = msgs[-1] if msgs else None
    last_type = last.type if last else None
    print(f"  step → msgs={len(msgs):>2}  history={len(hist):>2}  last={last_type}")
    content = getattr(last, "content", None)
    if content:
        text = content if isinstance(content, str) else str(content)
        print(f"         content: {text[:200]}")
    tool_calls = getattr(last, "tool_calls", None)
    if tool_calls:
        for tc in tool_calls:
            name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "?")
            print(f"         tool_call: {name}")


async def run_turn(graph, *, label: str) -> None:
    _print_turn_banner(label)
    initial = {
        "messages": [HumanMessage(content=DEMO_QUESTION)],
        "patient_id": DEMO_PATIENT,
        "clinic_id": DEMO_CLINIC,
        "retrieved_history": [],
    }
    async for event in graph.astream(initial, stream_mode="values"):
        _print_event(event)


async def seed_consultation_note(store) -> None:
    ns = consultation_namespace(DEMO_CLINIC, DEMO_PATIENT)
    note = {
        "note_id": str(uuid.uuid4()),
        "patient_id": DEMO_PATIENT,
        "chief_complaint": "Vomiting for 2 days after scavenging kitchen scraps",
        "diagnosis": "Dietary indiscretion, mild gastritis",
        "treatment": "Bland diet 5 days, metoclopramide PRN, recheck if persists >48h",
        "consulted_at": datetime.now(timezone.utc).isoformat(),
    }
    await store.aput(ns, note["note_id"], note)
    print(f"\n[seed] wrote consultation note {note['note_id'][:8]}… into {ns}")


async def main() -> None:
    async with open_store() as store:
        graph = build_graph().compile(store=store)

        await run_turn(graph, label=f"Turn 1 — empty history  (patient={DEMO_PATIENT})")
        await seed_consultation_note(store)
        await run_turn(graph, label="Turn 2 — after feedback-loop write")


if __name__ == "__main__":
    load_dotenv(dotenv_path="agent/.env")
    load_dotenv()  # fallback to repo-root .env
    asyncio.run(main())
