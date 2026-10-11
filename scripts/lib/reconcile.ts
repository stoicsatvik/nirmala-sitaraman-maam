import type { PublicMoneyRecord } from "./ingestion";

export type ReconciliationBasis = "exact_tender_reference" | "exact_external_reference";

export interface ReconciledLink {
  fromExternalKey: string;
  toExternalKey: string;
  relation: string;
  basis: ReconciliationBasis;
  /** Exact identifier equality, not proof of a fund transfer. */
  confidence: 1;
  reference: string;
}

function normalizeReference(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Emit only independently sourced, unambiguous shared tender references.
 * Identical identifiers do not prove chronological public-money movement.
 */
export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const byReference = new Map<string, PublicMoneyRecord[]>();
  for (const record of records) {
    if (!record.tenderReference || !record.fiscalYear || !record.jurisdiction) continue;
    const reference = normalizeReference(record.tenderReference);
    if (reference.length < 5) continue;
    const key = JSON.stringify([
      reference,
      record.fiscalYear.trim(),
      record.jurisdiction.trim().toUpperCase()
    ]);
    const group = byReference.get(key) ?? [];
    group.push(record);
    byReference.set(key, group);
  }

  const links: ReconciledLink[] = [];
  for (const group of byReference.values()) {
    const unique = [
      ...new Map(group.map(record => [`${record.sensorId}:${record.externalKey}`, record])).values()
    ];
    // Ambiguous references and same-source replays are not corroboration.
    if (unique.length !== 2) continue;
    const [a, b] = unique.sort((x, y) =>
      `${x.sensorId}:${x.externalKey}`.localeCompare(`${y.sensorId}:${y.externalKey}`)
    );
    if (a.sensorId === b.sensorId || a.externalKey === b.externalKey || a.sourceUrl === b.sourceUrl) continue;
    links.push({
      fromExternalKey: a.externalKey,
      toExternalKey: b.externalKey,
      relation: "shared tender reference (no inferred fund transfer)",
      basis: "exact_tender_reference",
      confidence: 1,
      reference: normalizeReference(a.tenderReference!)
    });
  }
  return links.sort((a, b) =>
    `${a.reference}:${a.fromExternalKey}`.localeCompare(`${b.reference}:${b.fromExternalKey}`)
  );
}
