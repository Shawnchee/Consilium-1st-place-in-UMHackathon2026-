"""
15 static triage eval cases — 5 escalate, 5 monitor, 5 clear.

Each case maps directly to a TriageState input. tool_call_count is 0
for all first-turn cases (the standard CI scenario). Escalate cases are
the most safety-critical: a wrong answer here is a medical regression.
"""
from __future__ import annotations

from typing import TypedDict


class EvalCase(TypedDict):
    id: str
    text: str
    tool_call_count: int
    expected_decision: str  # "escalate" | "monitor" | "clear"


TRIAGE_CASES: list[EvalCase] = [
    # ── ESCALATE ──────────────────────────────────────────────────────
    # These are unambiguous life-threatening signals. Any deviation is a
    # safety regression and must block the PR.
    {
        "id": "esc_01_seizure",
        "text": "She just had a seizure and she's unconscious, she won't wake up",
        "tool_call_count": 0,
        "expected_decision": "escalate",
    },
    {
        "id": "esc_02_breathing",
        "text": "He can't breathe properly and his gums are turning blue, please help",
        "tool_call_count": 0,
        "expected_decision": "escalate",
    },
    {
        "id": "esc_03_postop_bleed",
        "text": "The surgery wound opened up last night and there's been non-stop bleeding since",
        "tool_call_count": 0,
        "expected_decision": "escalate",
    },
    {
        "id": "esc_04_collapse",
        "text": "He suddenly collapsed and can't stand up at all, his legs are just giving out",
        "tool_call_count": 0,
        "expected_decision": "escalate",
    },
    {
        "id": "esc_05_bloody_vomit",
        "text": "She has been vomiting blood for the past two hours and is very weak",
        "tool_call_count": 0,
        "expected_decision": "escalate",
    },

    # ── MONITOR ───────────────────────────────────────────────────────
    # Concerning but not immediately life-threatening. Should not be
    # cleared prematurely or over-escalated.
    {
        "id": "mon_01_lethargy",
        "text": "He seems a bit tired today and didn't want to go on his morning walk",
        "tool_call_count": 0,
        "expected_decision": "monitor",
    },
    {
        "id": "mon_02_soft_stool",
        "text": "She's had soft stools since yesterday but is still drinking water and moving around",
        "tool_call_count": 0,
        "expected_decision": "monitor",
    },
    {
        "id": "mon_03_limping",
        "text": "He has a slight limp on his front left leg but is still putting weight on it",
        "tool_call_count": 0,
        "expected_decision": "monitor",
    },
    {
        "id": "mon_04_skipped_meal",
        "text": "She skipped her dinner last night but ate breakfast this morning, she seems okay otherwise",
        "tool_call_count": 0,
        "expected_decision": "monitor",
    },
    {
        "id": "mon_05_ear_scratch",
        "text": "He keeps scratching his right ear a lot today, no discharge but he looks uncomfortable",
        "tool_call_count": 0,
        "expected_decision": "monitor",
    },

    # ── CLEAR ─────────────────────────────────────────────────────────
    # Positive recovery signals. Should not be escalated or kept on
    # monitor unnecessarily.
    {
        "id": "clr_01_great",
        "text": "Just wanted to say she is doing great! Eating normally, full of energy, back to herself",
        "tool_call_count": 0,
        "expected_decision": "clear",
    },
    {
        "id": "clr_02_recovered",
        "text": "He finished the antibiotics course and is completely back to normal, no more symptoms",
        "tool_call_count": 0,
        "expected_decision": "clear",
    },
    {
        "id": "clr_03_wound_healed",
        "text": "The wound looks fully healed, no redness or swelling at all, she is running around happily",
        "tool_call_count": 0,
        "expected_decision": "clear",
    },
    {
        "id": "clr_04_eating_well",
        "text": "Eating and drinking normally, playing with toys, no issues at all since the last visit",
        "tool_call_count": 0,
        "expected_decision": "clear",
    },
    {
        "id": "clr_05_checkup_ok",
        "text": "All good on our end! He passed his home check, stools normal, sleeping well, very happy",
        "tool_call_count": 0,
        "expected_decision": "clear",
    },
]
