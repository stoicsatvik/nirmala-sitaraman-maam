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

function normalizeScope(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Exact tender text is not a globally unique identifier. Only attempt
 * deterministic lifecycle associations inside the same named authority,
 * jurisdiction and fiscal year. Missing scope or ambiguous repeated stages
 * must abstain, rather than manufacturing a public-money flow.
 *
 * Even an accepted link means "same scoped source identifier", not proof
 * that any payment, delivery or audit event actually occurred.
 */
export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const byScopedTender = new Map<string, { reference: string; records: PublicMoneyRecord[] }>();

  for (const record of records) {
    if (!record.tenderReference) continue;
    const reference = normalizeReference(record.tenderReference);
    const authority = normalizeScope(record.authority);
    const jurisdiction = normalizeScope(record.jurisdiction);
    const fiscalYear = normalizeScope(record.fiscalYear);
    if (reference.length < 5 || !authority || !jurisdiction || !fiscalYear) continue;

    const scopeKey = JSON.stringify([authority, jurisdiction, fiscalYear, reference]);
    const group = byScopedTender.get(scopeKey) ?? { reference, records: [] };
    group.records.push(record);
    byScopedTender.set(scopeKey, group);
  }

  const links: ReconciledLink[] = [];

  for (const { reference, records: group } of byScopedTender.values()) {
    const unique = [...new Map(group.map((record) => [record.externalKey, record])).values()];
    if (unique.length < 2) continue;

    // Multiple distinct observations at one lifecycle stage may be separate
    // lots, awards or projects. Do not arbitrarily connect them in a chain.
    if (new Set(unique.map((record) => record.state)).size !== unique.length) continue;

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
