"""System prompt builder — folds retrieved consultation history into context."""
from __future__ import annotations

from .state import ConsultationNote


BASE_SYSTEM = (
    "You are a veterinary clinic assistant. You help pet owners understand "
    "their pet's condition and triage concerns after a consultation. Be "
    "concise, reference prior notes when relevant, and escalate red flags."
)


def build_system_prompt(history: list[ConsultationNote]) -> str:
    if not history:
        return f"{BASE_SYSTEM}\n\nNo prior consultation notes for this patient."

    lines = [BASE_SYSTEM, "", "Prior consultation notes for this patient:"]
    for note in history:
        lines.append(
            f"- [{note['consulted_at']}] {note['chief_complaint']} "
            f"→ {note['diagnosis']} / {note['treatment']}"
        )
    return "\n".join(lines)
