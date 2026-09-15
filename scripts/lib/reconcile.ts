import type { PublicMoneyRecord } from "./ingestion";

export type ReconciliationBasis = "exact_tender_reference" | "exact_external_reference";

export interface ReconciledLink {
  fromExternalKey: string;
  toExternalKey: string;
  relation: string;
  basis: ReconciliationBasis;
  confidence: 1;
  reference: string;
}

const STATE_ORDER = new Map([
  ["budgeted", 0],
  ["revised", 1],
  ["sanctioned", 2],
  ["released", 3],
  ["procured", 4],
  ["paid", 5],
  ["delivered", 6],
  ["audited", 7]
]);

function normalizeReference(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const byTender = new Map<string, PublicMoneyRecord[]>();

  for (const record of records) {
    if (!record.tenderReference) continue;
    const reference = normalizeReference(record.tenderReference);
    if (reference.length < 5) continue;
    const group = byTender.get(reference) ?? [];
    group.push(record);
    byTender.set(reference, group);
  }

  const links: ReconciledLink[] = [];

  for (const [reference, group] of byTender) {
    const unique = [...new Map(group.map((record) => [record.externalKey, record])).values()];
    if (unique.length < 2) continue;

    unique.sort((a, b) => (STATE_ORDER.get(a.state) ?? 99) - (STATE_ORDER.get(b.state) ?? 99));

    for (let index = 0; index < unique.length - 1; index += 1) {
      const from = unique[index];
      const to = unique[index + 1];
      if (from.externalKey === to.externalKey) continue;

      links.push({
        fromExternalKey: from.externalKey,
        toExternalKey: to.externalKey,
        relation: `${from.state} → ${to.state}`,
        basis: "exact_tender_reference",
        confidence: 1,
        reference
      });
    }
  }

  return links;
}
