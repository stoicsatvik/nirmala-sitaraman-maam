import type { PublicMoneyRecord } from "./ingestion";
import { isPlausibleTenderReference } from "./procurement-evidence";

export type ReconciliationBasis = "exact_tender_reference" | "exact_external_reference";

export interface ReconciledLink {
  fromExternalKey: string;
  toExternalKey: string;
  relation: string;
  basis: ReconciliationBasis;
  confidence: 1;
  reference: string;
}

function normalizeReference(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Only a unique tender publication and unique award from the same authority,
 * jurisdiction and fiscal year may form an exact reference link.
 * Same-stage duplicates and malformed navigation HTML are not money-flow
 * transitions. This does not infer payment, delivery or outcome.
 */
export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const byTender = new Map<string, PublicMoneyRecord[]>();
  for (const record of records) {
    if (!record.tenderReference) continue;
    const reference = normalizeReference(record.tenderReference);
    if (!isPlausibleTenderReference(reference)) continue;
    const group = byTender.get(reference) ?? [];
    group.push(record);
    byTender.set(reference, group);
  }

  const links: ReconciledLink[] = [];
  for (const [reference, group] of byTender) {
    const unique = [...new Map(group.map(record => [record.externalKey, record])).values()];
    const tenders = unique.filter(record => record.state === "tendered");
    const awards = unique.filter(record => record.state === "procured");
    if (tenders.length !== 1 || awards.length !== 1) continue;
    const [from] = tenders;
    const [to] = awards;
    if (from.externalKey === to.externalKey || from.sensorId === to.sensorId) continue;
    if (from.authority !== to.authority || from.jurisdiction !== to.jurisdiction) continue;
    if (!from.fiscalYear || from.fiscalYear !== to.fiscalYear) continue;
    links.push({
      fromExternalKey: from.externalKey,
      toExternalKey: to.externalKey,
      relation: "tendered → procured",
      basis: "exact_tender_reference",
      confidence: 1,
      reference
    });
  }
  return links;
}
