import type {
  Patient,
  FollowUp,
  MetricCardData,
  ConsultOutput,
  DiagnosisRow,
  CorrectionRow,
} from "./types";

export const PATIENTS: Patient[] = [
  {
    id: "p1",
    time: "09:00",
    name: "Milo",
    species: "Dog",
    breed: "Miniature Schnauzer",
    age: "8yo",
    sex: "Male (neutered)",
    owner: "Aisyah Rahman",
    ownerPhone: "+60 12 345 6789",
    tag: "Pre-op",
    tagColor: "red",
    reason: "Pre-cystotomy workup — bladder stones",
    brief: {
      lastVisit: "24 Nov — external clinic: amox-clav + Royal Canin Urinary SO; symptoms persisted",
      chronic: "Suspected struvite urolithiasis (first surgical episode)",
      compliance: "Owner switched to Urinary SO as advised; finishing 7-day antibiotic course today",
      pending: "Cystotomy 02 Dec 09:00 — pre-op bloods + urine C/S today, NPO from 22:00",
      probe: "Confirm urethra clear of migrating stones — risk of obstruction; check pre-op CBC + chem",
    },
  },
  {
    id: "p2",
    time: "09:30",
    name: "Luna",
    species: "Cat",
    breed: "British Shorthair",
    age: "2yo",
    sex: "Female (spayed)",
    owner: "Daniel Tan",
    ownerPhone: "+60 16 778 2310",
    tag: "New patient",
    tagColor: "green",
    reason: "Not eating for 2 days",
    brief: {
      lastVisit: "First visit — no prior records in system",
      chronic: "Unknown — first visit",
      compliance: "N/A",
      pending: "Intake exam, FIV/FeLV, weight baseline",
      probe: "Appetite + dental inspection — rule out oral pain first",
    },
  },
  {
    id: "p3",
    time: "10:00",
    name: "Rex",
    species: "Dog",
    breed: "German Shepherd",
    age: "7yo",
    sex: "Male (intact)",
    owner: "Priya Subramaniam",
    ownerPhone: "+60 19 234 5566",
    tag: "Post-op Day 3",
    tagColor: "red",
    reason: "CCL repair recheck",
    brief: {
      lastVisit: "17 Apr — Right stifle CCL repair (TPLO), uncomplicated",
      chronic: "Mild hip dysplasia (bilateral, Meloxicam PRN)",
      compliance: "Excellent — always on time, follows instructions",
      pending: "Suture check today, radiograph in 6 weeks",
      probe: "Incision site, weight-bearing, icing compliance",
    },
  },
  {
    id: "p4",
    time: "10:45",
    name: "Mochi",
    species: "Dog",
    breed: "Shih Tzu",
    age: "9yo",
    sex: "Female (spayed)",
    owner: "Lim Wei Ming",
    ownerPhone: "+60 17 889 0022",
    tag: "Chronic care",
    tagColor: "amber",
    reason: "Skin — recurrent hotspot",
    brief: {
      lastVisit: "02 Apr — Pyoderma L flank, Cephalexin 7d — cleared",
      chronic: "Atopic dermatitis (3 recurrences in 8 months)",
      compliance: "Inconsistent — stops topical once itch subsides",
      pending: "Apoquel trial discussion, allergy workup",
      probe: "Seasonal pattern? Diet? Long-term Apoquel vs referral",
    },
  },
  {
    id: "p5",
    time: "11:15",
    name: "Bella",
    species: "Cat",
    breed: "Domestic Shorthair",
    age: "12yo",
    sex: "Female (spayed)",
    owner: "Hafiz Ismail",
    ownerPhone: "+60 13 556 9988",
    tag: "Senior wellness",
    tagColor: "green",
    reason: "Weight loss + PU/PD",
    brief: {
      lastVisit: "11 Feb — Senior panel, BUN slightly elevated (32)",
      chronic: "Early CKD suspected — IRIS 2",
      compliance: "Good — diet switched to k/d as recommended",
      pending: "Renal recheck, USG + UPC, BP",
      probe: "Rule out hyperthyroidism (T4), repeat chem + urine",
    },
  },
];

export const INITIAL_FOLLOWUPS: FollowUp[] = [
  {
    id: "f1",
    level: "escalate",
    patient: "Milo",
    procedure: "Pre-cystotomy — Day before surgery",
    owner: "Aisyah Rahman",
    daysPost: 0,
    ownerMessage:
      "Doc, Milo has been straining to pee since last night and now nothing's coming out. He's still trying every few minutes but it's just drops with blood.",
    differentials: [
      { cause: "Urethral obstruction from migrating cystolith", prob: 0.78, tone: "red" },
      { cause: "UTI flare without obstruction", prob: 0.22, tone: "green" },
    ],
    recommendation:
      "Bring Milo in immediately — possible partial urethral obstruction; consider moving cystotomy forward",
    draft:
      "Hi Aisyah, please bring Milo in now — straining without producing urine can mean one of the stones is partially blocking his urethra, and we don't want to wait. We're ready for him at the clinic. — Peng Aun Sg Dua Penang",
    tsLabel: "8 min ago",
  },
  {
    id: "f2",
    level: "escalate",
    patient: "Coco",
    procedure: "Dental — Day 1 post-op",
    owner: "Sarah Goh",
    daysPost: 1,
    ownerMessage:
      "He's drooling a lot of blood and I can see his gum is really swollen on the left. Is this normal? He won't let me near his mouth.",
    differentials: [
      {
        cause: "Extraction socket breakdown / infection",
        prob: 0.72,
        tone: "red",
      },
      { cause: "Normal post-op oozing", prob: 0.28, tone: "green" },
    ],
    recommendation:
      "Same-day recheck — likely needs socket re-examination under sedation",
    draft:
      "Hi Sarah, that level of bleeding and swelling on Day 1 isn't something we want to wait on. Please bring Coco in today — we can see him at 3:15pm. Do not give any food or water in the 2 hours before coming. — Peng Aun Sg Dua Penang",
    tsLabel: "38 min ago",
  },
  {
    id: "f3",
    level: "monitor",
    patient: "Biscuit",
    procedure: "GI upset — Day 3",
    owner: "James Lee",
    daysPost: 3,
    ownerMessage:
      "Stool is firmer today, still a bit soft. Appetite back to normal. Drinking well.",
    recommendation: "Continue bland diet 2 more days, transition slowly to normal",
  },
  {
    id: "f4",
    level: "monitor",
    patient: "Pepper",
    procedure: "Ear infection — Day 5",
    owner: "Nadia Osman",
    daysPost: 5,
    ownerMessage:
      "Scratching less but still a bit. No smell anymore. Finished 5 of 7 days of drops.",
    recommendation: "Complete full course, recheck in 10 days",
  },
  {
    id: "f5",
    level: "clear",
    patient: "Tofu",
    procedure: "Vaccine — Day 2",
    owner: "Marcus Chen",
    daysPost: 2,
    ownerMessage: "All good! Back to his crazy self, eating like a horse. Thanks doc!",
    recommendation: "Auto-reply sent, case closed",
  },
];

export const MONTH_METRICS: MetricCardData[] = [
  { label: "Time saved", value: "47h", sub: "this month", tone: "green" },
  {
    label: "Billing recovered",
    value: "RM 9,240",
    sub: "vs avg 8–12k target",
    tone: "green",
  },
  {
    label: "Complications caught",
    value: "3",
    sub: "2 prevented ER",
    tone: "amber",
  },
  { label: "Follow-up response", value: "78%", sub: ">70% target", tone: "green" },
];

export const GLM_CONSULT_OUTPUT: ConsultOutput = {
  soap: {
    S: "Owner reports straining + haematuria for 2 weeks. External clinic 1 week ago prescribed amox-clav + Royal Canin Urinary SO — no improvement. Eating, drinking normally otherwise.",
    O: "QAR. T 38.7°C, HR 110, RR 28. BW 9.8kg. Mild discomfort on caudal abdominal palpation. Urethra patent on rectal exam. X-ray: 2 large cystoliths nearly filling bladder, multiple smaller uroliths scattered along urethra.",
    A: "Cystolithiasis with secondary urolithiasis — too large for medical dissolution. Suspected struvite (pending stone analysis). Cystotomy indicated.",
    P: "Pre-op bloods (CBC + chem) today. Urine C/S sent. NPO from 22:00. Cystotomy 02 Dec 09:00. Continue Urinary SO post-op pending stone analysis.",
  },
  prescription: [
    {
      drug: "Amoxicillin-clavulanate 250 mg tablets",
      dose: "12.5 mg/kg PO BID",
      dur: "7 days (post-op)",
      qty: "14 tabs",
    },
    {
      drug: "Meloxicam 1.5 mg/mL oral susp.",
      dose: "0.1 mg/kg PO SID",
      dur: "5 days (post-op)",
      qty: "10 mL",
    },
  ],
  billing: [
    { item: "Consultation fee", price: 50, flagged: false, note: "" },
    { item: "Abdominal X-ray (2 views)", price: 120, flagged: false, note: "" },
    { item: "Pre-anesthetic bloods (CBC + chem panel)", price: 180, flagged: false, note: "" },
    {
      item: "Urine C/S (external lab)",
      price: 95,
      flagged: true,
      note: "Sent to lab, not yet billed",
    },
    { item: "Amoxicillin-clavulanate dispensed (14 tabs)", price: 38, flagged: false, note: "" },
    {
      item: "Cystotomy surgery (scheduled 02 Dec)",
      price: 850,
      flagged: true,
      note: "Quoted to owner, not yet booked in system",
    },
    { item: "Royal Canin Urinary SO 4 kg", price: 110, flagged: false, note: "" },
  ],
  todos: [
    { task: "Confirm cystotomy slot 02 Dec 09:00 with surgical team", who: "Reception" },
    { task: "Process pre-op bloods + urine C/S today", who: "Nurse" },
    { task: "Send Aisyah pre-op fasting + drop-off instructions", who: "Telegram bot" },
    { task: "Prepare stone-analysis submission paperwork for post-op", who: "Nurse" },
  ],
};

export const TOP_DIAGNOSES: DiagnosisRow[] = [
  { label: "Otitis externa", count: 38 },
  { label: "Gastroenteritis", count: 29 },
  { label: "Atopic dermatitis", count: 24 },
  { label: "Dental disease", count: 19 },
  { label: "CCL injury", count: 11 },
];

export const CORRECTIONS_LOG: CorrectionRow[] = [
  {
    date: "18 Apr",
    feature: "Triage",
    glm: "MONITOR",
    fix: "ESCALATE — wound looked infected on photo",
    who: "Dr. Amirah",
  },
  {
    date: "16 Apr",
    feature: "Billing",
    glm: "Missed nail trim",
    fix: "Added RM 15 — performed during consult",
    who: "Dr. Amirah",
  },
  {
    date: "14 Apr",
    feature: "Prescription",
    glm: "Meloxicam 0.2 mg/kg",
    fix: "Reduced to 0.1 mg/kg — senior patient",
    who: "Dr. Amirah",
  },
  {
    date: "12 Apr",
    feature: "Triage",
    glm: "ESCALATE",
    fix: "MONITOR — owner overanxious, normal healing",
    who: "Dr. Amirah",
  },
];
