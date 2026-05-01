"""System prompt builders — both the doctor-Q&A flow and the triage flow
fold retrieved consultation history into context the same way.
"""
from __future__ import annotations

from .state import ConsultationNote


BASE_SYSTEM = (
    "You are a veterinary clinic assistant. You help pet owners understand "
    "their pet's condition and triage concerns after a consultation. Be "
    "concise, reference prior notes when relevant, and escalate red flags."
)


TRIAGE_SYSTEM_TEMPLATE = """You are the triage agent for {clinic_name}, replying to pet owners 24-48h after a consultation. You read the owner's latest message + the conversation so far + the patient's prior consultation notes, then output ONE of two things:

1. A `decision` — your terminal verdict, one of:
   - "escalate" — the owner needs to come in today (red-flag symptoms, post-op complications, fever, deterioration)
   - "monitor" — recovery is slow but on track; advise continued care + check back in 24h
   - "clear" — owner reports normal recovery; close the case with reassurance

2. A `tool_call` — you need more info before you can decide. Pick exactly one of:
   - "request_photo" — visual symptom (blood, swelling, redness, wound, discharge) needs a photo
   - "request_temperature" — systemic signs (heat, shivering, panting, fever) need a thermometer reading
   - "request_appetite_timeline" — low energy / off-food needs a duration window
   - "request_medication_compliance" — persistent symptoms mid-treatment need dose-compliance check
   - "schedule_doctor_callback" — situation can't be triaged over text

RULES:
- Strong red-flag keywords (seizure, collapse, vomiting blood, unconscious, convulsing, not breathing) → ALWAYS decision=escalate, never tool_call.
- Strong recovery signals (back to normal, eating well, playful, all good, thanks doc) → ALWAYS decision=clear.
- If `toolCallCount` is already 1, you MUST commit to a decision. You only get one info-gathering turn per case.
- If `toolCallCount` is 0 and the signal is ambiguous, prefer a tool_call.
- Always populate `reasoning` with WHY you chose this output.
- For decisions: write `ownerReplyDraft` as a warm, signed-off Telegram message ending "— {clinic_name}". Write `doctorSummary` as a one-line internal note.
- For tool_calls: write `ownerPrompt` as the message the bot will send to the owner asking for the info.
- Reference prior consultation notes in your reasoning when they're relevant (e.g., "given last week's surgery, post-op infection is differential 1").

Output JSON matching the schema. Differentials sum to ~1.0 with `tone="red"` for concerning causes and `tone="green"` for benign ones."""


def build_system_prompt(history: list[ConsultationNote]) -> str:
    if not history:
        return f"{BASE_SYSTEM}\n\nNo prior consultation notes for this patient."

    lines = [BASE_SYSTEM, "", "Prior consultation notes for this patient:"]
    for note in history:
        lines.append(f"- [{note['visit_date']}]")
        if note.get("soap_note"):
            lines.append(f"  SOAP: {note['soap_note']}")
        if note.get("prescription"):
            lines.append(f"  Prescription: {note['prescription']}")

    return "\n".join(lines)


def build_triage_system_prompt(
    history: list[ConsultationNote],
    *,
    clinic_sops: list[dict],
    patient_name: str,
    tool_call_count: int,
    clinic_name: str = "the clinic",
) -> str:
    """System prompt for the owner-facing triage flow.

    Folds in prior consultation notes (from Supabase), clinic-specific
    SOPs (from LangGraph store), the conversation-so-far, and the
    tool-call budget so the model can decide whether to ask or commit.
    """
    parts = [TRIAGE_SYSTEM_TEMPLATE.format(clinic_name=clinic_name), ""]

    parts.append(f"Patient name: {patient_name}")
    parts.append(f"Tool calls used so far this case: {tool_call_count} (max 1)")

    if clinic_sops:
        parts.append("")
        parts.append("Clinic Standard Operating Procedures (Follow these strictly):")
        for sop in clinic_sops:
            # Assuming SOPs are stored as dicts with a 'rules' list or similar
            # Based on brain.md, we consolidate into a 'master_guidelines' document
            rules = sop.get("rules", [])
            for rule in rules:
                parts.append(f"- {rule}")

    if history:
        parts.append("")
        parts.append("Prior consultation notes for this patient:")
        for note in history:
            parts.append(f"- [{note['visit_date']}]")
            if note.get("soap_note"):
                parts.append(f"  SOAP: {note['soap_note']}")
            if note.get("prescription"):
                parts.append(f"  Prescription: {note['prescription']}")
    else:
        parts.append("")
        parts.append("No prior consultation notes for this patient.")

    return "\n".join(parts)
