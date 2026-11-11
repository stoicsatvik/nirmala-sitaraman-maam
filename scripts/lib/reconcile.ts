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

const NAVIGATION_REFERENCE = /(?:javascript|function|document|captcha|login|screen\s*reader|advanced\s*search|active\s*tenders|tenders\s*by|corrigendum|epublishing|government\s*of\s*india|find\s*my\s*nodal|mis\s*reports|latest\s*(?:tenders|corrigendum)|updates\s+every|more\.\.?)/i;
const NAVIGATION_TITLE = /(?:javascript|function|document\.|captcha|login|screen\s*reader|advanced\s*search|active\s*tenders|tenders\s*by|corrigendum\s+title|bid\s+opening\s+date|tender\s+title|reference\s+no|epublishing|government\s*of\s*india|find\s*my\s*nodal|mis\s*reports|latest\s*(?:tenders|corrigendum)|updates\s+every|more\.\.?|visitor\s+no|designed,\s*developed|version\s*:)/i;

/** Reject page chrome, HTML/script payloads and title text masquerading as IDs. */
export function isPlausibleTenderReference(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5 || compact.length > 120) return false;
  if (/[<>|{};=,]/.test(trimmed) || NAVIGATION_REFERENCE.test(trimmed)) return false;
  if (/^\d{1,2}[-/]\w{3,}[-/]\d{2,4}$/i.test(trimmed)) return false;
  if (!/[A-Z]/i.test(compact) || !/\d/.test(compact)) return false;
  return /[\/_-]/.test(compact)
    || /^[A-Z]{2,}\d{5,}$/i.test(compact)
    || /^\d{4}\s+[A-Z]{2,}\s+\d{1,5}$/i.test(trimmed);
}

function isPlausibleTenderTitle(value: string | undefined): value is string {
  if (!value) return false;
  const title = value.trim();
  if (!title || title.length > 500 || /[<>|]/.test(title) || NAVIGATION_TITLE.test(title)) return false;
  // CPPP's homepage includes a parent row that concatenates ten nested rows.
  // Keep the individual child rows; reject the aggregate parent row.
  if ((title.match(/(?:^|\s)\d+\.\s/g) ?? []).length > 1) return false;
  return true;
}

/** CPPP table schema: title in cell 0, reference number in cell 1. */
export function extractTenderReference(cells: string[]): string | undefined {
  const title = cells[0];
  const reference = cells[1];
  if (!isPlausibleTenderTitle(title) || !isPlausibleTenderReference(reference)) return undefined;
  return reference.trim();
}

export function reconcileRecords(records: PublicMoneyRecord[]): ReconciledLink[] {
  const groups = new Map<string, PublicMoneyRecord[]>();

  for (const record of records) {
    if (!isPlausibleTenderReference(record.tenderReference)) continue;
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
