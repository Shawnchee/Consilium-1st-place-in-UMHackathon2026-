/**
 * Diagnosis → billable items. Starter matrix the consult fixture (and later
 * the real GLM) references to flag missing line-items. Harrison owns the
 * long-term content; this is enough for the demo.
 *
 * Prices are RM and approximate — they move to a `billing_items` table once
 * the clinic-admin surface lands.
 */

export interface BillableItem {
  item: string;
  price: number;
}

export const BILLING_MATRIX: Record<string, BillableItem[]> = {
  "otitis externa": [
    { item: "Consultation fee", price: 50 },
    { item: "Ear cytology", price: 40 },
    { item: "Otomax otic drops (7.5g)", price: 55 },
  ],
  gastroenteritis: [
    { item: "Consultation fee", price: 50 },
    { item: "Subcutaneous fluids (Hartmann's)", price: 45 },
    { item: "Antiemetic injection (Cerenia)", price: 35 },
    { item: "Bland diet dispensed", price: 20 },
  ],
  "atopic dermatitis": [
    { item: "Consultation fee", price: 50 },
    { item: "Skin scrape + cytology", price: 60 },
    { item: "Apoquel 5.4mg (30 tablets)", price: 180 },
  ],
  "dental disease": [
    { item: "Consultation fee", price: 50 },
    { item: "Dental radiograph", price: 140 },
    { item: "Scaling + polishing (GA)", price: 450 },
  ],
  "ccl injury": [
    { item: "Consultation fee", price: 50 },
    { item: "Radiograph stifle (2 views)", price: 120 },
    { item: "Meloxicam 1.5mg/mL (20mL)", price: 35 },
    { item: "Gabapentin 100mg (14 caps)", price: 42 },
    { item: "E-collar (size L)", price: 25 },
  ],
};

export function billablesFor(diagnosis: string): BillableItem[] {
  const q = diagnosis.toLowerCase();
  for (const [key, items] of Object.entries(BILLING_MATRIX)) {
    if (q.includes(key)) return items;
  }
  return [];
}
