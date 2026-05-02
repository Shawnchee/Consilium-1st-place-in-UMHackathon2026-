"""
AI Eval Pipeline — Triage agent safety and correctness checks.

Two-tier gate:

  HARD  — escalate (5/5 required)
    Any downgrade of a life-threatening case blocks the PR immediately.
    Label: SAFETY REGRESSION.

  SOFT  — monitor (4/5 required) + clear (4/5 required)
    1 miss per category is tolerated because the monitor/clear boundary
    is intentionally fuzzy. 2+ misses in either category blocks the PR.

Strategy: call triage_agent_node() directly with pre-populated state
(empty history, empty SOPs). No Supabase or Postgres needed — only
ANTHROPIC_API_KEY.
"""
from __future__ import annotations

import uuid
from typing import Literal

import pytest

from agent.core.triage_graph import triage_agent_node
from agent.tests.fixtures.triage_cases import TRIAGE_CASES

# ── constants ─────────────────────────────────────────────────────────
ESCALATE_REQUIRED = 5   # out of 5 — zero tolerance
MONITOR_REQUIRED  = 4   # out of 5 — 1 miss allowed
CLEAR_REQUIRED    = 4   # out of 5 — 1 miss allowed

Decision = Literal["escalate", "monitor", "clear"]

# ── helpers ───────────────────────────────────────────────────────────
def _make_state(case: dict) -> dict:
    return {
        "patient_id":        f"eval_{uuid.uuid4().hex[:8]}",
        "clinic_id":         "clinic_eval",
        "clinic_name":       "Eval Clinic",
        "patient_name":      "EvalPet",
        "text":              case["text"],
        "tool_call_count":   case["tool_call_count"],
        "messages":          [],
        "retrieved_history": [],
        "clinic_sops":       [],
        "output":            None,
    }


def _by(decision: Decision) -> list[dict]:
    return [c for c in TRIAGE_CASES if c["expected_decision"] == decision]


def _fmt_failure(case: dict, got: str) -> str:
    return (
        f"\n  [{case['id']}]\n"
        f"  Input      : {case['text']}\n"
        f"  Expected   : {case['expected_decision']}\n"
        f"  Got        : {got}\n"
    )


# ── HARD gate: escalate (5 / 5) ───────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("case", _by("escalate"), ids=[c["id"] for c in _by("escalate")])
async def test_escalate_safety(case: dict) -> None:
    """Every escalate case must pass — a miss is a SAFETY REGRESSION."""
    result = await triage_agent_node(_make_state(case))
    output = result.get("output")

    assert output is not None, (
        f"[{case['id']}] Agent returned None — likely a JSON parse failure."
    )
    assert output.decision == "escalate", (
        f"\n{'=' * 60}\n"
        f"  SAFETY REGRESSION — [{case['id']}]\n"
        f"{'=' * 60}"
        + _fmt_failure(case, output.decision) +
        f"  Confidence : {output.confidence}\n"
        f"  Reasoning  : {output.reasoning}\n"
        f"{'=' * 60}"
    )


# ── SOFT gate: monitor (4 / 5) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_monitor_threshold() -> None:
    """At least 4 of 5 monitor cases must be correct (1 miss allowed)."""
    cases   = _by("monitor")
    passed  = []
    failed  = []

    for case in cases:
        result = await triage_agent_node(_make_state(case))
        output = result.get("output")
        if output and output.decision == "monitor":
            passed.append(case["id"])
        else:
            got = output.decision if output else "None (parse error)"
            failed.append(_fmt_failure(case, got))

    assert len(passed) >= MONITOR_REQUIRED, (
        f"\nMonitor gate: {len(passed)}/{len(cases)} passed "
        f"(need {MONITOR_REQUIRED}).\n"
        f"Failures:{chr(10).join(failed)}"
    )


# ── SOFT gate: clear (4 / 5) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_clear_threshold() -> None:
    """At least 4 of 5 clear cases must be correct (1 miss allowed)."""
    cases   = _by("clear")
    passed  = []
    failed  = []

    for case in cases:
        result = await triage_agent_node(_make_state(case))
        output = result.get("output")
        if output and output.decision == "clear":
            passed.append(case["id"])
        else:
            got = output.decision if output else "None (parse error)"
            failed.append(_fmt_failure(case, got))

    assert len(passed) >= CLEAR_REQUIRED, (
        f"\nClear gate: {len(passed)}/{len(cases)} passed "
        f"(need {CLEAR_REQUIRED}).\n"
        f"Failures:{chr(10).join(failed)}"
    )
