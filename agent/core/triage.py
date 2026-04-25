"""Triage I/O contracts.

Mirrors `TriageFixtureOutput` from `lib/glm-fixtures.ts` exactly so the
Next.js Telegram handler can call this sidecar without changing the
shape it already speaks to the mock.

Two output kinds:
    decision  — terminal verdict (escalate | monitor | clear)
    tool_call — agent wants more info from the owner before deciding;
                exactly one of 5 PRD-spec tools, picked once per case.

Field names are intentionally camelCase to match the TS contract one-
to-one. `with_structured_output` derives its JSON schema directly from
these field names, so what the model emits is exactly what TS expects.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ToolName = Literal[
    "request_photo",
    "request_temperature",
    "request_appetite_timeline",
    "request_medication_compliance",
    "schedule_doctor_callback",
]

FollowUpLevel = Literal["escalate", "monitor", "clear"]


class Differential(BaseModel):
    cause: str
    prob: float = Field(ge=0.0, le=1.0)
    tone: Literal["red", "green"]


class TriageOutput(BaseModel):
    """Structured triage result. One of two shapes via `kind`.

    decision: decision, confidence, differentials, recommendedAction,
              ownerReplyDraft, doctorSummary, reasoning all populated.
    tool_call: tool, args, ownerPrompt, reasoning populated.
    """

    kind: Literal["decision", "tool_call"]
    reasoning: str

    # decision-only fields
    decision: Optional[FollowUpLevel] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    differentials: Optional[list[Differential]] = None
    recommendedAction: Optional[str] = None
    ownerReplyDraft: Optional[str] = None
    doctorSummary: Optional[str] = None

    # tool_call-only fields
    tool: Optional[ToolName] = None
    args: Optional[dict[str, Any]] = None
    ownerPrompt: Optional[str] = None


# ─── request models (sidecar input) ────────────────────────────────────


class ConversationTurnIn(BaseModel):
    """Flattened mirror of `ConversationTurn` from lib/types.ts.

    The LLM only needs role + a textual representation; the TS caller
    is responsible for collapsing tool/decision turns to {role, text}.
    """

    role: Literal["owner", "bot_tool", "bot_decision"]
    text: str


class TriageRequest(BaseModel):
    followup_id: str
    patient_id: str
    clinic_id: str
    chat_id: str
    text: str
    patient_name: Optional[str] = "your pet"
    tool_call_count: int = 0
    prior_conversation: list[ConversationTurnIn] = Field(default_factory=list)
