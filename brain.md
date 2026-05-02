# Architecture Specification: Clinic-Specific AI Brain

This document outlines the architecture for transforming the Consilium AI into a "Clinic-Specific Brain." It uses a dual-memory system (LangGraph + Supabase) and an Agentic RAG (Retrieval-Augmented Generation) feedback loop to allow the AI to learn standard operating procedures (SOPs) and clinical trends directly from doctor behavior.

---

## 1. The Dual-Memory System

To ensure the AI has access to both the immediate conversation context and long-term clinic knowledge without breaking the React dashboard UI, we split the memory architecture:

### A. Short-Term Memory (The Chat Thread)
*   **LangGraph Checkpointer (`PostgresSaver`):** The Python LangGraph agent uses its native checkpointer to automatically manage the `HumanMessage` and `AIMessage` history. The agent remains fully stateful across turns using `thread_id`.
*   **Next.js `followups` Table:** Because the LangGraph checkpointer stores data in a complex binary format, Next.js simultaneously logs a human-readable copy of the chat into the `followups` table. This is **strictly for the frontend dashboard** so human doctors can read the ongoing Telegram chats.

### B. Long-Term Memory (The Clinic Brain)
*   **LangGraph `store` (`AsyncPostgresStore`):** The `store` table acts as the permanent NoSQL/Vector database for the clinic. It does **not** store raw daily chats. Instead, it stores clean, synthesized "Clinic SOPs", "Doctor Preferences", and "Clinical Trends".

---

## 2. Raw Data Ingestion (Supabase Direct)

The LangGraph Python agent is kept strictly isolated from raw administrative database writes. Next.js remains the primary API for the human doctors. Data enters the ecosystem simply by being saved into Supabase:

1.  **Consultations (SOAP + Prescriptions):** 
    When a doctor finishes a consultation on the Next.js frontend, they review the AI-generated SOAP notes and Prescriptions.
    *   *Trigger:* The doctor clicks "Approve Final Version".
    *   *Action:* Next.js saves the final data to the Supabase `visits` table.
2.  **Corrections (Triage Feedback):**
    When the AI makes a triage mistake (e.g., advising "monitor" instead of "escalate"), the doctor corrects it via the Next.js Dashboard. 
    *   *Trigger:* The doctor submits the correction.
    *   *Action:* Next.js saves the raw correction to the Supabase `corrections` table.

---

## 3. Memory Consolidation (The Nightly Cron Job)

If the AI read directly from the raw `visits` and `corrections` tables, it would be overwhelmed by thousands of noisy, repetitive, or contradictory rows. We solve this using an Agentic **Memory Consolidation** pattern.

*   **The Cron Job:** Every night at 2:00 AM, a background task executes.
*   **Extraction:** It queries Supabase for all rows in `visits` and `corrections` where `created_at` > yesterday. This eliminates the need for complex, real-time webhooks.
*   **Synthesis:** It feeds the raw data to an LLM with the prompt: *"Synthesize these daily corrections and cases into core Clinic Rules and Trends. Merge duplicates and update existing rules."*
*   **Storage:** The LLM outputs clean, unified JSON rules (e.g., `{"rule": "For vomiting with history of surgery, always escalate."}`). The cron job saves these synthesized rules into the LangGraph `store` under a specific namespace (e.g., `["clinic_knowledge", clinic_id]`).

---

## 4. Utilizing the Brain (Triage & Dashboard)

With the highly-curated `store` table populated, the system leverages it in two ways:

### A. The Triage Agent
When an owner messages the Telegram bot, the Python LangGraph `retrieve_history_node` spins up and queries two things:
1.  **Patient History:** Queries the Supabase `visits` table directly to get the dog's past SOAP notes.
2.  **Clinic SOPs:** Queries the LangGraph `store` to pull the clinic's preferred treatment guidelines for the symptoms mentioned.

The agent injects both into its System Prompt. *Result:* The AI acts identically to the specific clinic's head doctor.

### B. The Clinic Summary Dashboard
The Next.js frontend can query the distilled insights from the LangGraph `store` to render a "Clinic Summary" widget for the doctors.
*   *UI Examples:* "Trending this week: 5 cases of Parvovirus", or "Top Prescribed Medication: Cerenia".
*   *Value:* Doctors get instant epidemiological insights into their own clinic without running complex SQL analytics.
