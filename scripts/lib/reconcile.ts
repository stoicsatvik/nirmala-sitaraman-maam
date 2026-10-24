import type { PublicMoneyRecord } from "./ingestion";
import { stageForObservation } from "./stages.ts";

export type ReconciliationBasis = "exact_tender_reference" | "exact_external_reference";

export interface ReconciledLink {
  fromSensorId: string;
  fromExternalKey: string;
  toSensorId: string;
  toExternalKey: string;
  relation: string;
  basis: ReconciliationBasis;
  confidence: 1;
  reference: string;
}

/** The database's real unique key is (sensor_id, external_key), never external_key alone. */
export function recordIdentity(sensorId: string, externalKey: string): string {
  return JSON.stringify([sensorId, externalKey]);
}

export interface PersistedRecordLookup {
  id: string;
  sensor_id: string;
  external_key: string;
}

/** Resolve graph edges against the exact source-scoped database identities. */
export function resolveLinkRows(links: ReconciledLink[], rows: PersistedRecordLookup[]) {
  const ids = new Map(rows.map((row) => [recordIdentity(row.sensor_id, row.external_key), row.id]));
  return links.flatMap((link) => {
    const fromId = ids.get(recordIdentity(link.fromSensorId, link.fromExternalKey));
    const toId = ids.get(recordIdentity(link.toSensorId, link.toExternalKey));
    if (!fromId || !toId || fromId === toId) return [];
    return [{
      from_live_record_id: fromId,
      to_live_record_id: toId,
      relation: link.relation,
      match_basis: link.basis,
      confidence: link.confidence,
      reference: link.reference
    }];
  });
}

const STATE_ORDER = new Map([
  ["budgeted", 0],
  ["revised", 1],
  ["sanctioned", 2],
  ["released", 3],
  ["tender_published", 4],
  ["procured", 5],
  ["paid", 6],
  ["delivered", 7],
  ["audited", 8]
]);

function normalizeReference(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

/** Never promote page furniture, HTML, scripts or generic labels to exact identifiers. */
function validTenderReference(value: string): boolean {
  const reference = value.trim();
  if (reference.length < 5 || reference.length > 100 || !/[0-9]/.test(reference)) return false;
  if (/[<>"'{}=;\\]|\b(?:javascript|function|document|window|captcha|login)\b/i.test(reference)) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}._/\- ]*$/u.test(reference);
}

export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  // Tender strings are not globally unique. Even identical strings from
  // different authorities or fiscal years cannot prove a shared money flow.
  // Preserve E211 source-scoped record identity and E190 stage semantics.
  const byScopedTender = new Map<string, PublicMoneyRecord[]>();

  for (const record of records) {
    if (!record.tenderReference || !validTenderReference(record.tenderReference)) continue;
    const authority = record.authority?.trim().replace(/\s+/g, " ").toUpperCase();
    const jurisdiction = record.jurisdiction?.trim().replace(/\s+/g, " ").toUpperCase();
    const fiscalYear = record.fiscalYear?.trim().toUpperCase();
    if (!authority || !jurisdiction || !fiscalYear) continue;
    const reference = normalizeReference(record.tenderReference);
    const groupKey = JSON.stringify([authority, jurisdiction, fiscalYear, reference]);
    const group = byScopedTender.get(groupKey) ?? [];
    group.push(record);
    byScopedTender.set(groupKey, group);
  }

  const links: ReconciledLink[] = [];

  for (const group of byScopedTender.values()) {
    const reference = normalizeReference(group[0].tenderReference!);
    const unique = [...new Map(group.map((record) => [
      recordIdentity(record.sensorId, record.externalKey), record
    ])).values()];
    if (unique.length < 2) continue;

    // Multiple distinct observations at one lifecycle stage may describe
    // separate lots or awards. Do not arbitrarily choose an edge between them.
    const stages = unique.map((record) => stageForObservation(record.sensorId, record.state));
    if (new Set(stages).size !== unique.length) continue;

    unique.sort((a, b) =>
      (STATE_ORDER.get(stageForObservation(a.sensorId, a.state)) ?? 99) -
      (STATE_ORDER.get(stageForObservation(b.sensorId, b.state)) ?? 99)
    );

    for (let index = 0; index < unique.length - 1; index += 1) {
      const from = unique[index];
      const to = unique[index + 1];
      if (
        recordIdentity(from.sensorId, from.externalKey) === recordIdentity(to.sensorId, to.externalKey) ||
        stageForObservation(from.sensorId, from.state) === stageForObservation(to.sensorId, to.state) ||
        from.sensorId === to.sensorId
      ) continue;

      links.push({
        fromSensorId: from.sensorId,
        fromExternalKey: from.externalKey,
        toSensorId: to.sensorId,
        toExternalKey: to.externalKey,
        relation: [stageForObservation(from.sensorId, from.state), "→", stageForObservation(to.sensorId, to.state)].join(" "),
        basis: "exact_tender_reference",
        confidence: 1,
        reference
      });
    }
  }

  return links;
}
