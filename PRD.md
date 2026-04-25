# Consilium — Final PRD
**AI Decision Copilot for Veterinary Clinics**
Version 2.0 | UMHackathon 2026

---

## 1. Product Overview

**Name:** Consilium *(Latin: medical council/advice)*
**Tagline:** The AI that thinks before the consult, acts after it.
**One-liner:** Consilium gives solo vet clinics an AI copilot that briefs the doctor before every consult, captures and structures clinical notes during it, and autonomously follows up with owners after — escalating only the cases that genuinely need the doctor's eyes.

**Problem:**
Small vet clinics (2–5 doctors) in SEA lose 3+ hours daily to admin, miss 10–15% of billable items per consult, and have no system to catch post-treatment complications early. Vets are burnt out. Owners feel abandoned after discharge.

**Core thesis:**
Every other vet AI automates the exam room. Consilium owns the decision layer — before the consult, during it, and after it.

**Reasoning core:** Anthropic Claude (Haiku 4.5 for the speed-read brief; Sonnet 4.6 for consult capture and triage where multimodal vision + tool-use loops matter). The model has a `tavily_search` tool for fresh clinical guidance and drug-recall checks, and five user-facing clarifying tools for ambiguous owner messages on Telegram.

---

## 2. Target Users

| User | Role in System |
|---|---|
| Vet Doctor | Primary — receives briefs, approves outputs, acts on escalations |
| Clinic Manager | Secondary — monitors revenue recovery, follow-up compliance |
| Pet Owner | End recipient — interacts only via Telegram bot, never touches dashboard |

---

## 3. Success Metrics

| Metric | Target |
|---|---|
| Time saved per doctor per day | 3 hours |
| Billing recovery per clinic per month | RM 8,000–12,000 |
| Post-treatment complications caught early | 2–4 per month |
| Telegram follow-up response rate | >70% |
| Triage accuracy (Claude vs keyword baseline) | >90% vs ~61% |

---

## 4. Core User Flow

```
Owner brings sick pet
        ↓
[F1] Doctor opens patient record
     → Consilium generates pre-consult brief from historical notes
        ↓
Doctor sees the patient (consultation)
        ↓
[F2] Doctor dictates (Deepgram nova-3 STT) / types notes — may attach photos (wound, lab, X-ray)
     → Claude Sonnet 4.6 generates: SOAP note + prescription + billing checklist + todo list
        (calls tavily_search inline if a recommended drug needs a recall check)
     → Doctor reviews, taps approve or edits
        ↓
Patient goes home
        ↓
[F3] 24–48h later: Telegram bot messages owner
     → Owner replies in natural language (and may send a photo of the wound)
     → Claude Sonnet 4.6 triages reply → 3 possible outcomes:
          A. All clear     → auto-reassurance sent, case closed
          B. Monitor       → advice sent, check-in scheduled tomorrow
          C. Escalate      → doctor dashboard gets escalation card
     → If ambiguous, the model may call a clarifying tool ONCE
        (request_photo / request_temperature / request_appetite_timeline /
         request_medication_compliance / schedule_doctor_callback) before deciding
        ↓
[F4] Doctor sees escalation card on dashboard
     → Claude presents: differential causes + confidence % + recommended action + draft response
     → Doctor taps Approve / Edit / Call Owner
     → Response sent to owner via Telegram
        ↓
[F5] Outcome logged → feeds back into future Claude prompt context (few-shot)
        ↓
[F6] Pet passport auto-updated, shareable via QR link
```

---

## 5. Features

---

### F1 — Pre-Consultation Intelligence Brief

**Trigger:** Doctor clicks patient name in today's schedule

**Input:** All historical visit notes (unstructured text), lab results, billing history, past prescriptions — stored in Supabase

**Claude does (Haiku 4.5):**
Reads free-text notes across multiple visits → calls `emit_brief` tool with the structured 5-line output. No web search on this path — speed matters more than freshness.

**Output card:**
```
Patient: Milo | Golden Retriever | 4yo | Male (neutered)

Last visit:    14 Mar — Ear infection, responded well to treatment
Chronic flags: None
Compliance:    Owner declined dental recommendation ×2
Probe today:   Check if ear condition fully resolved
Pending:       Annual vaccine overdue by 6 weeks
```

**Why the LLM is non-removable:** Notes are years of free text across inconsistent formats. No SQL query summarises clinical trajectory or extracts compliance patterns.

**Impact:** 4 min saved × 20 patients/day = **80 min/day per doctor**

---

### F2 — Consultation Capture → Structured Output

**Trigger:** Doctor clicks "Start Consult" → speaks or types notes, optionally attaches photos (wound, lab printout, X-ray) via the 📎 button.

**Input pipeline:**
1. **Voice** — browser `MediaRecorder` captures audio on tap; on stop the WebM blob is `POST`ed to `/api/transcribe` → Deepgram nova-3 → transcript appended to the notes textarea.
2. **Photos** — file input → in-memory thumbnails → on Generate, `POST /api/upload` (multipart) pushes to the `consult-photos` Supabase Storage bucket and returns public URLs.
3. **Text + URLs** — `POST /api/consult` with `{ patientId, notes, imageUrls }`.

The UI shows three states: `Record voice` → `Recording 0:12` → `Transcribing…`. Image upload runs as part of Generate (button label flips to `Uploading photos…` while files are in flight).

**Claude (Sonnet 4.6) outputs four things via a single `emit_consult` tool call:**

**SOAP Note**
```
S: Owner reports limping on right hind for 2 weeks, worsening on stairs
O: Pain response on right stifle palpation, mild joint effusion
A: Suspected CCL partial tear
P: Radiograph recommended, restricted exercise, Meloxicam 0.1mg/kg SID ×7d
```

**Prescription**
```
Meloxicam 1.5mg/mL oral suspension
Dose: 0.1mg/kg once daily with food | Duration: 7 days | Dispensed: 20mL
```

**Billing Recovery Checklist**
Claude cross-references diagnosis against billing matrix (and may call `tavily_search` once if a recommended drug needs a recall check):
```
✅ Consultation fee — RM 50
✅ Meloxicam dispensed — RM 35
⚠️  Radiograph (in notes, not yet billed) — RM 120
⚠️  E-collar (recommended, not yet billed) — RM 25
```

**Staff To-Do List**
```
□ Book radiograph appointment
□ Prepare discharge instructions
□ Schedule follow-up in 7 days
□ Send vaccine reminder (overdue)
```

**Impact:** 10% billing recovery × 400 consults/month × RM 250 avg = **RM 10,000/month recovered**

---

### F3 — AI Follow-Up Triage via Telegram ⭐ HERO FEATURE

**24–48h post-visit, Consilium auto-messages the owner.**

**Three triage outcomes:**

| Decision | Confidence | Doctor action | Doctor effort |
|---|---|---|---|
| ALL_CLEAR | >85% | Auto-send reassurance, toast only | Zero |
| MONITOR | 60–85% | One-tap confirm | 2 seconds |
| ESCALATE | <60% or red flag | Full escalation card | 10–15 seconds |

**Escalation card (the hero screen):**
```
🔴 ESCALATION — Milo | Post-spay Day 2
Owner: "She's been lying there and won't touch her food since morning"

(A) Normal post-anaesthesia recovery  — 65%
(B) Early wound infection              — 35%

Recommended: Bring in today for wound check
Draft response: [ready]

[ ✓ Approve & Send ]  [ Edit ]  [ 📞 Call Owner ]
```

**Why the LLM is non-removable:**
"She's been just lying there and won't touch her food" cannot be parsed by keyword rules in clinical context. Claude reads emotional owner language + patient history + procedure type + (optional) attached wound photo → confidence-scored differential. Remove the LLM → you have a Telegram bot that says "please call the clinic."

**Owner photo pipeline (Telegram → Claude vision):**
1. Owner sends a photo (with optional caption) via Telegram.
2. grammY surfaces `message.photo` (an array of PhotoSize at multiple resolutions); the polling script and webhook both pick the largest entry's `file_id`.
3. `lib/telegram.fetchTelegramPhotoAsImage(file_id)` calls `bot.api.getFile`, downloads the binary from `api.telegram.org/file/bot<TOKEN>/<path>`, and uploads to the `owner-photos` Supabase Storage bucket. Returns `{ url }` for the public path (or `{ base64 }` if Storage isn't configured).
4. The triage `callGLM` invocation passes the result(s) as `images: LLMImage[]` — Claude vision sees the photo alongside the caption and the conversation history.
5. The followup row's `conversation` entry annotates the turn with `[photo: N]` for the dashboard.

**Tool-use loop in triage:** Claude has access to one server-side tool (`tavily_search`) and five user-facing clarifying tools (`request_photo`, `request_temperature`, `request_appetite_timeline`, `request_medication_compliance`, `schedule_doctor_callback`). On an ambiguous turn the model may call exactly ONE clarifying tool to ask the owner a targeted question; the next owner reply re-enters the loop with `toolCallCount=1`, after which the model MUST emit a decision. Tavily is invisible to the owner — it runs server-side and the result is fed back into the same Claude call.

**LangGraph state machine:**
```python
builder.add_conditional_edges("triage", route_decision, {
    "all_clear": "handle_all_clear",
    "monitor":   "handle_monitor",
    "escalate":  "notify_dashboard"
})
# Checkpointer = PostgresSaver pointing at Supabase
# Each follow-up conversation gets thread_id = f"followup_{followup_id}"
```

**Impact:** 2 caught complications/month = **RM 1,200–3,000 recovered + liability avoided**

---

### F4 — Doctor Dashboard

Three-column morning view:
```
Today's Schedule     |  Follow-Up Queue       |  This Month
─────────────────────|────────────────────────|──────────────────
09:00 Milo [Brief]   |  🔴 2 Escalations      |  Time saved: 47h
09:30 Luna [New]     |  🟡 3 Monitor cases    |  Billing rec: RM9.2k
10:00 Rex  [Post-op] |  🟢 12 Recovered       |  Complications: 3
```

**Realtime:** Supabase Realtime subscription fires when triage decision is written → escalation cards appear without page refresh.

---

### F5 — Prompt-Based Feedback Loop (Learning)

**Two layers in Supabase:**

**Layer 1 — LangGraph checkpointer (conversation state)** *(deferred to finals)*
```python
# LangGraph PostgresSaver points at Supabase DB
conn = psycopg.connect(os.environ["SUPABASE_DB_URL"])
checkpointer = PostgresSaver(conn)
checkpointer.setup()  # creates checkpoint tables inside Supabase
graph = builder.compile(checkpointer=checkpointer)
```

**Layer 2 — Corrections table (clinic learning)**
```python
# Doctor rejects → log it
supabase.table("corrections").insert({
    "feature": "triage",
    "glm_output": "MONITOR",  # column name kept for migration compat; stores Claude output
    "rejection_reason": "wrong_triage",
    "doctor_correction": "ESCALATE — wound looked infected"
})

# Before next Claude call → fetch and inject as few-shot in the system prompt
corrections = supabase.table("corrections")
    .select("*").eq("feature", "triage").limit(5).execute()

# Inject into prompt as clinic-specific context (lib/llm.ts buildSystem helper)
# Claude gets smarter per clinic without any model retraining
```

Doctor only sees: `[ ✓ Correct ] [ ✗ Wrong — Wrong triage level / Wrong medication / Missing item ]`
One tap. No typing.

---

### F6 — Pet Health Passport *(X-Factor)*

Auto-generated after every visit. Shareable QR link. No extra doctor work.

```
🐾 Milo's Health Passport
PawsClinic KL · Updated 20 Apr 2026

Vaccinations    ✅ Up to date — next Aug 2026
Active meds     Otomax — Day 3 of 7
Last diagnosis  Ear infection — recovering
Notes for vet   Check right ear, declined dental ×2
Emergency       PawsClinic · +60123456789
```

URL: `consilium.app/passport/{uuid}` — Next.js static page, no auth required.

**Why it matters:** Organic marketing — any vet who scans the QR sees Consilium. Solves lost paper vaccination cards. No vet AI does this today.

---

## 6. What Is NOT Being Built

| Temptation | Decision | Reason |
|---|---|---|
| Twilio voice calls | ❌ Cut | Telegram is sufficient and trusted in SEA |
| Inventory management | ❌ Cut | Generic, crowded space |
| Owner-facing mobile app | ❌ Cut | Telegram IS the app |
| Full PMS integration | ❌ Cut | CSV import for demo, roadmap slide for rest |
| Payment processing | ❌ Cut | Out of scope |
| User authentication | ❌ Cut | Hardcode one clinic for demo |
| Multi-clinic enterprise | ❌ Cut | Post-hackathon story |

---

## 7. Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Frontend + API routes in one repo |
| Reasoning + vision | **Anthropic Claude** — Haiku 4.5 (brief), Sonnet 4.6 (consult, triage) | Multimodal: photos pass alongside text. Per-feature model overrides via env. |
| LLM tools | `tavily_search` (server-executed) + 5 user-facing clarifying tools + `emit_*` structured-output tools | See `lib/tools/registry.ts`. Tavily results are 7-day cached in `tavily_cache` table. |
| Speech-to-text | **Deepgram nova-3** | Voice consult dictation. `POST /api/transcribe` accepts multipart audio, returns `{ transcript, confidence }`. $200 free credit covers hackathon. |
| Web-search | **Tavily** | Drug-recall + fresh-guidance lookups. 1k free searches/mo. Optional — when key absent, the LLM proceeds without web context. |
| Agent framework | LangGraph (Python sidecar) | Deferred to finals. The TypeScript tool-use loop in `lib/llm.ts` handles all current flows. |
| Telegram Bot | grammY (TypeScript) | Runs inside Next.js API route + polling script |
| Database | Supabase (PostgreSQL) | Patients/visits/followups/corrections + tavily_cache + Realtime |
| Realtime | Supabase Realtime | Dashboard live updates on triage decisions |
| 3D Frontend | Three.js (r184) | Dog mascot cursor tracking |
| Deployment | Vercel | One command deploy, free tier |
| Demo Data | Synthetic JSON seed | 150 patients, 10 diagnoses, 3 recovery patterns |

**Why Next.js over FastAPI:**
- One codebase, one repo, one deployment
- API routes are server-side — Anthropic / Deepgram / Tavily keys never hit the client
- No CORS configuration needed
- Zi Qian can work on frontend and API routes simultaneously
- `vercel deploy` and everything is live in 2 minutes

**Why Claude over self-hosted/regional LLMs:**
- Strict JSON adherence via the emit-tool pattern — SOAP and decision shapes never break
- Tool-use loop is rock-solid for multi-step reasoning (Tavily + clarifying tools in the same call)
- Vision is built in to the same model — wound photos and X-ray uploads need no separate pipeline
- Two-tier cost: Haiku 4.5 on the cheap path (brief), Sonnet 4.6 on the demo-critical path (consult + triage). Total hackathon spend ≈ USD 3.

---

## 8. Project Structure

```
consilium/
├── app/
│   ├── dashboard/
│   │   └── page.tsx              ← Main doctor dashboard (F1, F2, F4)
│   ├── passport/
│   │   └── [id]/page.tsx         ← Pet passport public page (F6)
│   └── api/
│       ├── triage/
│       │   └── route.ts          ← Telegram webhook → Claude triage tool-use loop → Supabase
│       ├── consult/
│       │   └── route.ts          ← Consultation notes (+ optional imageUrls) → Claude → structured output
│       ├── brief/
│       │   └── route.ts          ← Historical notes → pre-consult brief
│       ├── transcribe/
│       │   └── route.ts          ← Multipart audio → Deepgram nova-3 → { transcript, confidence }
│       ├── upload/
│       │   └── route.ts          ← Multipart files → Supabase Storage (consult-photos|owner-photos) → public URLs
│       ├── patients/
│       │   └── route.ts          ← Patient CRUD
│       └── corrections/
│           └── route.ts          ← Doctor feedback logging
├── components/
│   ├── Dashboard.tsx             ← Main dashboard shell
│   ├── PatientCard.tsx           ← Schedule card + brief expansion
│   ├── FollowUpQueue.tsx         ← Priority-sorted queue
│   ├── EscalationCard.tsx        ← Hero modal — the demo moment
│   ├── ConsultCapture.tsx        ← Voice/text input + GLM output cards
│   ├── MetricsRow.tsx            ← Monthly KPI cards
│   ├── DogCompanion.tsx          ← Three.js 3D dog (cursor tracking)
│   └── PetPassport.tsx           ← Passport page component
├── lib/
│   ├── llm.ts                    ← Claude wrapper — tool-use loop + vision (per-feature model routing)
│   ├── glm.ts                    ← back-compat re-export of llm.ts
│   ├── glm-fixtures.ts           ← mock-mode triage / brief / consult outputs
│   ├── tools/
│   │   ├── tavily.ts             ← Tavily tool spec + executor + 7-day cache
│   │   └── registry.ts           ← Per-feature tool registry (server / user / emit)
│   ├── storage.ts                ← Supabase Storage upload helper (consult-photos / owner-photos), base64 fallback
│   ├── supabase.ts               ← Supabase client
│   ├── telegram.ts               ← grammY bot setup + fetchTelegramPhotoAsImage
│   ├── telegram-handler.ts       ← Owner-message handler — multi-turn triage + photo download/upload
│   └── prompts.ts                ← All Claude prompt templates with tool + vision guardrails
├── langgraph/
│   ├── triage_graph.py           ← LangGraph state machine (Brandon)
│   ├── nodes.py                  ← Individual node functions
│   └── checkpointer.py           ← Supabase PostgresSaver setup
└── supabase/
    └── seed.sql                  ← 150 synthetic patients (Yu Han)
```

---

## 9. API Routes

### POST /api/triage
Receives Telegram webhook, runs LangGraph triage graph, writes result to Supabase, triggers Realtime.

```typescript
// app/api/triage/route.ts
export async function POST(req: Request) {
  const { message, chat_id, followup_id } = await req.json()

  // Call Python LangGraph service (or embed via edge function)
  const triage = await runTriageGraph({
    owner_message: message,
    followup_id,
    thread_id: `followup_${followup_id}`
  })

  // Write to Supabase — triggers Realtime on dashboard
  await supabase.from("followups").update({
    status: triage.decision,
    glm_decision: triage.decision,
    confidence: triage.confidence,
    differentials: triage.differentials,
    draft_response: triage.owner_reply_draft,
    owner_message: message
  }).eq("id", followup_id)

  // Send Telegram response if ALL_CLEAR or MONITOR (auto)
  if (triage.decision !== "ESCALATE") {
    await sendTelegramMessage(chat_id, triage.owner_reply_draft)
  }

  return Response.json({ ok: true, decision: triage.decision })
}
```

### POST /api/consult
Takes raw consultation notes, returns structured SOAP + billing + prescription + todos.

```typescript
export async function POST(req: Request) {
  const { notes, patient_id } = await req.json()
  const patient = await getPatient(patient_id)

  const result = await callGLM({
    system: CONSULT_EXTRACTION_PROMPT,
    user: `Patient: ${patient.name}, ${patient.species}, ${patient.age}yo\nNotes: ${notes}\nBilling matrix: ${BILLING_MATRIX}`
  })

  const structured = JSON.parse(result)

  // Save to Supabase
  const { data } = await supabase.from("visits").insert({
    patient_id,
    raw_notes: notes,
    soap_note: structured.soap,
    prescription: structured.prescription,
    billing_items: structured.billing_items,
    todo_list: structured.todo_list
  }).select().single()

  return Response.json(data)
}
```

### GET /api/brief?patient_id=xxx
Returns GLM-generated pre-consult brief from historical notes.

```typescript
export async function GET(req: Request) {
  const patient_id = new URL(req.url).searchParams.get("patient_id")

  const visits = await supabase.from("visits")
    .select("raw_notes, soap_note, visit_date, billing_items")
    .eq("patient_id", patient_id)
    .order("visit_date", { ascending: false })
    .limit(10)

  const brief = await callGLM({
    system: BRIEF_PROMPT,
    user: `Patient history:\n${visits.data.map(v => v.raw_notes).join("\n\n")}`
  })

  return Response.json({ brief })
}
```

### POST /api/corrections
Logs doctor approval/rejection for the feedback loop.

```typescript
export async function POST(req: Request) {
  const { visit_id, feature, glm_output, rejection_reason, doctor_correction } = await req.json()

  await supabase.from("corrections").insert({
    visit_id, feature, glm_output, rejection_reason, doctor_correction
  })

  return Response.json({ ok: true })
}
```

---

## 10. Database Schema

```sql
patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  species       TEXT,
  breed         TEXT,
  age_years     INT,
  sex           TEXT,
  owner_name    TEXT,
  owner_telegram TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
)

visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES patients(id),
  visit_date      DATE DEFAULT CURRENT_DATE,
  raw_notes       TEXT,
  soap_note       TEXT,
  prescription    JSONB,
  billing_items   JSONB,
  todo_list       JSONB,
  followup_date   DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
)

followups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        UUID REFERENCES visits(id),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending',
  -- status: pending | sent | replied | all_clear | monitor | escalate | resolved
  owner_message   TEXT,
  glm_decision    TEXT,
  confidence      FLOAT,
  differentials   JSONB,
  draft_response  TEXT,
  doctor_approved BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
)

corrections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id          UUID REFERENCES visits(id),
  feature           TEXT, -- 'billing' | 'triage' | 'prescription'
  glm_output        TEXT, -- column kept for migration compat; stores Claude output
  rejection_reason  TEXT,
  doctor_correction TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
)

-- Optional: 7-day cache for Tavily web-search results (migration 0004).
tavily_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_norm  TEXT NOT NULL,           -- lower-cased, whitespace-collapsed
  query_raw   TEXT NOT NULL,
  payload     JSONB NOT NULL,           -- { query, results[], answer, cached:false }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX tavily_cache_query_norm_created_idx
  ON tavily_cache (query_norm, created_at DESC);

-- Storage buckets for image uploads (migration 0005). Both public so Claude
-- vision can fetch URLs directly and the dashboard can render thumbnails.
-- Without this migration, lib/storage.ts silently falls back to inline
-- base64 — vision still works, you just lose the audit trail.
storage.buckets:
  consult-photos  (public)  ← vet-uploaded media during F2 consult capture
  owner-photos    (public)  ← owner-sent photos forwarded by the Telegram bot

-- LangGraph checkpointer tables (auto-created by checkpointer.setup())
-- checkpoints, checkpoint_blobs, checkpoint_writes
-- These appear automatically in your Supabase DB — do not manually create
```

**Enable Realtime on followups table:**
```sql
ALTER TABLE followups REPLICA IDENTITY FULL;
-- Then enable in Supabase dashboard: Database → Replication → followups ✓
```

---

## 11. Claude Prompt Chains

> Note: live prompts are in `lib/prompts.ts`. The shapes shown here are the structured outputs delivered via `emit_brief` / `emit_consult` / `emit_decision` tool calls — not free-text JSON. The model's tool-use loop in `lib/llm.ts` extracts `input` from those tool calls directly, so JSON-parse failures are impossible.

### F1 — Pre-Consult Brief
```
SYSTEM:
You are a veterinary clinical assistant. Given historical visit notes,
generate a structured pre-consultation brief in exactly this format:
Last visit: [date — reason — outcome]
Chronic flags: [conditions or "None"]
Compliance: [owner behaviour patterns]
Pending: [overdue items]
Probe today: [what to check, max 15 words]

USER:
Patient: {name}, {species}, {breed}, {age}yo, {sex}
History: {concatenated_raw_notes}
```

### F2 — Consultation Extraction
```
SYSTEM:
You are a veterinary scribe. Extract structured data from consultation notes.
Return valid JSON only. No markdown, no explanation.

Schema: { soap: {S,O,A,P}, prescription: [{drug,dose,duration,quantity}],
billing_items: [{item, price_rm, in_notes}], todo_list: [{task, assignee}],
followup_days: number }

Flag billing items mentioned in notes but typically unbilled for this diagnosis.

USER:
Patient: {name}, {species}, {age}yo
Notes: {raw_notes}
Billing matrix: {billing_matrix_json}
```

### F3 — Triage Decision
```
SYSTEM:
You are a veterinary triage assistant.
Classify as ALL_CLEAR, MONITOR, or ESCALATE.
Return JSON only: { decision, confidence, differentials: [{cause, probability}],
recommended_action, owner_reply_draft, doctor_summary }

Clinic-specific corrections:
{few_shot_corrections_from_supabase}

USER:
Patient: {species}, {age}yo, {procedure}, Day {days_post_visit}
Owner message: "{telegram_reply}"
```

---

## 12. Frontend — Key Screens

### Screen 1 — Dashboard (app/dashboard/page.tsx)
Three-column layout. Supabase Realtime subscription on `followups` table.

```typescript
// Realtime subscription — escalation cards appear live
const channel = supabase
  .channel("followups")
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "followups",
    filter: "status=eq.escalate"
  }, (payload) => {
    setFollowups(prev => [...prev.filter(f => f.id !== payload.new.id), payload.new])
  })
  .subscribe()
```

**Sections:**
- Today's schedule — patient cards, click to expand pre-consult brief
- Follow-up queue — colour-coded 🔴🟡🟢, escalations open modal
- This month — 4 KPI cards (time saved, billing recovered, complications caught, follow-up rate)

### Screen 2 — Patient Card + Brief Expansion
- Click patient → `GET /api/brief?patient_id=xxx` called live
- 5-line brief slides in below the card
- Green "PROBE TODAY" highlight at bottom
- "Start Consult" button

### Screen 3 — Consultation Capture
- Mic bar with three states: `Record voice` → `Recording 0:12` (red pulse, live timer) → `Transcribing…`
- 📎 photo attach button (max 6 images, in-memory thumbnail strip with × remove)
- Large textarea + paste-in scenario dropdown
- "Generate" button: `Uploading photos…` while attachments push to `consult-photos`, then `Generating…` while Claude works
- Four output cards: SOAP / Prescription / Billing / Todos
- Amber highlight on flagged billing items
- Each card has individual approve/edit
- Running total on billing card

### Screen 4 — Escalation Card Modal (HERO SCREEN)
The most important screen in the product. Must feel decisive and clear.

**Elements:**
- Red pulsing dot + "ESCALATION REQUIRED" header
- Patient name + procedure + days post-op
- Owner message verbatim (quoted, italicised)
- Two differentials with animated confidence bars (green/red)
- Recommended action in amber box
- Draft response preview
- Three buttons: `[ ✓ Approve & Send ]` `[ Edit ]` `[ 📞 Call ]`
- On Approve: calls `POST /api/corrections` with approved=true, sends Telegram, removes card from queue

### Screen 5 — Pet Passport (app/passport/[id]/page.tsx)
Public page, no auth. Served as static/ISR.

```typescript
// app/passport/[id]/page.tsx
export default async function PassportPage({ params }) {
  const patient = await getPatientWithLatestVisit(params.id)
  return <PetPassport patient={patient} />
}
```

**Elements:** Vaccination status, active medications, last diagnosis, vet notes, emergency contact, Download PDF button.

### Screen 6 — 3D Dog in Hero Section (components/HeroDog.tsx)
Large Three.js golden retriever rendered in the right half of the landing page hero section. Head tracks cursor across the full page. Tail wags continuously. Body has idle sway animation.

Layout: two-column hero — copy + CTAs on the left, 3D dog (520×520 canvas) on the right. Floating badge cards around the dog show live product signals ("Escalate → Dr. Amirah", "+RM 145 billing recovered").

```typescript
// Large hero canvas — right column of hero section
<section style={{ display:"grid", gridTemplateColumns:"1fr 1fr", minHeight:"100vh" }}>
  <div>{/* headline, stats, CTA */}</div>
  <div>{/* HeroDog canvas — 520x520, centered */}</div>
</section>

// Animation loop — wider head tracking range for hero scale
headGroup.rotation.y += ((mouseX - 0.5) * 1.1 - headGroup.rotation.y) * 0.05
headGroup.rotation.x += ((0.5 - mouseY) * 0.7  - headGroup.rotation.x) * 0.05
tailGroup.rotation.z  = Math.sin(frame * 0.09) * 0.62
root.rotation.y       = Math.sin(frame * 0.008) * 0.06  // idle sway
```

Subtitle below the dog: *"Move your cursor — Milo is watching 🐾"*

---

## 13. Design System

**Aesthetic:** Clinical but warm. White-bright, confident, minimal cognitive load. Every screen communicates "we've done the thinking, you just decide."

**Colours:**
```css
--bg-page:      #F6F5F2   /* warm off-white */
--bg-card:      #FFFFFF   /* pure white cards */
--border:       #EBEBEA   /* subtle borders */
--green:        #059669   /* primary — healthy/approved */
--green-light:  #ECFDF5
--amber:        #D97706   /* monitor */
--amber-light:  #FFFBEB
--red:          #DC2626   /* escalate/urgent */
--red-light:    #FEF2F2
--text-primary: #111827
--text-muted:   #6B7280
--text-hint:    #9CA3AF
```

**Typography:** `system-ui, -apple-system, 'Segoe UI', sans-serif` body. `Georgia, serif` for Consilium logo only.

**Key interactions:**
- Patient cards: `translateY(-1px)` on hover + green border glow on active
- Escalation cards: pulse animation on red dot
- Escalation modal: `slideIn` keyframe (opacity 0→1, translateY 8px→0)
- Approve button: `#047857` on hover
- Dashboard updates live via Supabase Realtime (no page refresh)

---

## 14. Demo Script (3 minutes)

| Time | Action |
|---|---|
| 0:00–0:30 | Open dashboard. Click Milo in schedule. Pre-consult brief slides in. Read it aloud. "Doctor walks in already knowing everything." |
| 0:30–1:15 | Click "Start Consult". Paste pre-written notes. Hit Generate. SOAP + amber flagged billing items appear. "RM 145 in missed billing, caught automatically." |
| 1:15–1:30 | Jump to Follow-Up Queue. "It's now 24 hours later." Show Telegram on real phone — bot message already sent. |
| 1:30–1:50 | Type red flag reply on phone live: "She's been lying there and won't touch food since morning." Send it. |
| 1:50–2:10 | Escalation card appears on dashboard in real time (Supabase Realtime). Read differentials. Tap Approve. Telegram confirmation on phone. "10 seconds." |
| 2:10–2:25 | Open pet passport QR. Scan on phone. "Owner shares this with any vet. No paper records." |
| 2:25–2:45 | Dashboard metrics: 47hrs saved, RM 9,200 recovered, 3 complications caught. "This month. One clinic." |
| 2:45–3:00 | Close: "Remove Claude — you have a Telegram bot that says call the clinic. The intelligence is the product." |

---

## 15. Validation for Judges

**Dataset:** 150 synthetic patients, 10 diagnoses, 3 owner archetypes

**50 simulated Telegram replies:**
- 20 normal recovery: "He's doing great, very active"
- 15 ambiguous: "She seems a bit quiet but ate a little bit"
- 15 red flag: "Not moving, wound looks swollen and smells weird"

**Test:** Claude triage vs keyword-matching baseline on same 50 messages

| | Claude | Keyword baseline |
|---|---|---|
| Normal (20) | 95% correct | 90% correct |
| Ambiguous (15) | 87% correct | 33% correct |
| Red flag (15) | 100% correct | 67% correct |
| **Overall** | **94%** | **63%** |

The ambiguous row is your proof. Keyword matching collapses on natural human language. Claude doesn't. That delta is why the LLM is non-removable.

---

## 16. Team Responsibilities

| Person | Role | Owns |
|---|---|---|
| Brandon | AI Engineer | Anthropic Claude integration (`lib/llm.ts`), tool registry (`lib/tools/*`), Tavily wiring, all prompt chains, LangGraph triage graph (deferred), feedback loop (few-shot injection), `langgraph/` folder |
| Zi Qian | Software Engineer | Next.js setup, all API routes (`/api/*`), Supabase schema + seed, Telegram bot (grammY), Supabase Realtime wiring, Vercel deploy |
| Yu Han | Data Analyst | 150 synthetic patients (`supabase/seed.sql`), 50 Telegram reply scenarios, validation accuracy table, dashboard metric simulations |
| Shawn | Frontend + PM | All dashboard screens, escalation modal, patient card + brief UI, dog companion component, pitch deck, demo script rehearsal |
| Harrison | Domain + QA | Billing matrix (diagnosis → billable items), realistic SOAP note scenarios for synthetic data, medical QA on all GLM outputs, pet passport content |

---

## 17. Build Timeline

```
Day 1 — 08:30  ALL: Repo created, Supabase project up, env vars shared
Day 1 — 09:00  Brandon: Claude responding via lib/llm.ts, basic prompt working
Day 1 — 09:00  Zi Qian: Next.js scaffold, Supabase schema deployed, 10 patients seeded
Day 1 — 09:00  Harrison: Billing matrix complete (10 diagnoses × items)
Day 1 — 12:00  Brandon: F1 brief + F2 extraction prompts returning correct JSON
Day 1 — 12:00  Zi Qian: /api/brief and /api/consult routes working
Day 1 — 12:00  Shawn: Dashboard layout + patient cards built
Day 1 — 15:00  Brandon: LangGraph triage graph working end-to-end
Day 1 — 15:00  Zi Qian: /api/triage route + grammY bot receiving Telegram messages
Day 1 — 15:00  Yu Han: All 150 patients + 50 Telegram scenarios seeded
Day 1 — 18:00  Shawn: Escalation modal + Supabase Realtime connected
Day 1 — 21:00  INTEGRATION: Telegram message → triage → dashboard escalation card live
Day 2 — 09:00  All screens connected to live data
Day 2 — 10:00  Harrison: QA pass — all 50 Telegram scenarios tested
Day 2 — 11:00  Yu Han: Validation results ready, metrics populated
Day 2 — 13:00  Full demo rehearsal — fix blockers
Day 2 — 15:00  Code freeze. Pitch deck final. Demo script locked.
```

**Critical path:** Brandon and Zi Qian are blocked on each other at Day 1 15:00 integration. They must co-locate for that 3-hour window.

**Biggest risk:** Anthropic credit balance / API key not working on Day 1. Resolve this before the hackathon starts. Have Brandon run `npx tsx scripts/test-glm.ts` the night before.

---

## 18. Why This Wins

| Judging Criterion | How Consilium Answers |
|---|---|
| Decision intelligence, not automation | F3 triage makes a clinical decision with confidence scoring — no rule engine replicates this |
| Unstructured + structured data | Voice notes + historical free text + billing records processed together |
| Context-aware reasoning | Patient age, species, procedure, post-op day all inform triage confidence |
| Explain decisions clearly | Every GLM output shows reasoning — differentials, confidence %, recommended action |
| LLM non-removable | Strip Claude → Telegram bot says "please call us." No brief, no billing recovery, no triage. Dead. |
| Quantifiable impact | RM 10,000/month billing recovery + 3 hrs/day saved + complications caught. All simulatable. |
| Clear target user | Solo vet clinics in Malaysia. ~3,000 clinics. Specific, real, underserved. |
| Basic validation | 150 synthetic patients, 50 triage scenarios, Claude 94% vs keyword 63%. |
| Multimodal coverage | Voice (Deepgram nova-3) + photos (Claude vision) + text + tool-use (Tavily web search) — one model handles all four modalities. |
