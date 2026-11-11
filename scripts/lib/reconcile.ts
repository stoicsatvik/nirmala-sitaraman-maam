import type { PublicMoneyRecord } from "./ingestion";

export type ReconciliationBasis = "exact_tender_reference" | "exact_external_reference";

export interface ReconciledLink {
  fromExternalKey: string;
  toExternalKey: string;
  relation: string;
  basis: ReconciliationBasis;
  // Confidence 1 means exact reference-text agreement, NOT proof of causation.
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

function normalizeContext(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Conservative public-record co-reference only.
 *
 * A shared tender string is not a verified financial flow or causal progression.
 * Incomplete/ambiguous identity, fiscal-year, authority or jurisdiction context
 * must fail closed instead of inventing a graph edge.
 */
export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const groups = new Map<string, PublicMoneyRecord[]>();

  for (const record of records) {
    if (!record.tenderReference) continue;
    const reference = normalizeReference(record.tenderReference);
    const authority = normalizeContext(record.authority);
    const jurisdiction = normalizeContext(record.jurisdiction);
    const fiscalYear = normalizeContext(record.fiscalYear);
    if (reference.length < 5 || !authority || !jurisdiction || !fiscalYear) continue;

    const key = JSON.stringify([reference, authority, jurisdiction, fiscalYear]);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const links: ReconciledLink[] = [];
  for (const [key, group] of groups) {
    // No arbitrary linearization of three-way or duplicate-record groups.
    if (group.length !== 2) continue;
    const [first, second] = group;
    if (!first.externalKey || !second.externalKey || first.externalKey === second.externalKey) {
      continue;
    }
    // The persistence lookup currently keys by externalKey alone, not sensorId.
    if (first.state === second.state) continue;
    const ordered = [first, second].sort(
      (a, b) => (STATE_ORDER.get(a.state) ?? 99) - (STATE_ORDER.get(b.state) ?? 99)
    );
    const reference = JSON.parse(key)[0] as string;
    links.push({
      fromExternalKey: ordered[0].externalKey,
      toExternalKey: ordered[1].externalKey,
      relation: "shared_tender_reference",
      basis: "exact_tender_reference",
      confidence: 1,
      reference
    });
  }
  return links;
}
