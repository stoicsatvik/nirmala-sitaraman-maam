import { readFile } from "node:fs/promises";
import { parseCpppTenderCells, isPlausibleTenderReference } from "../scripts/lib/procurement-evidence";
import { reconcileRecords } from "../scripts/lib/reconcile";
import type { PublicMoneyRecord } from "../scripts/lib/ingestion";

const path = new URL("../public/data/live/latest.json", import.meta.url);
const snapshot = JSON.parse(await readFile(path, "utf8")) as {
  generatedAt: string;
  records: PublicMoneyRecord[];
  links: Array<{ relation: string; reference: string; confidence: number }>;
};
const cppp = snapshot.records.filter(record => record.sensorId === "cppp-procurement");
const fourCellCandidates = cppp.filter(record =>
  parseCpppTenderCells((record.raw?.cells as string[] | undefined) ?? []) !== undefined
);
const malformedRefs = cppp.filter(record =>
  !record.tenderReference || !isPlausibleTenderReference(record.tenderReference)
);
const oldFalseLinks = snapshot.links.filter(link =>
  !isPlausibleTenderReference(link.reference) || link.relation === "procured → procured"
);
const correctedLinks = reconcileRecords(snapshot.records);
const result = {
  snapshotGeneratedAt: snapshot.generatedAt,
  cpppPreviouslyLabeledProcured: cppp.length,
  fourCellPlausibleCandidatesNotHeaderValidated: fourCellCandidates.length,
  malformedOrMissingReferences: malformedRefs.length,
  historicalLinks: snapshot.links.length,
  demonstrablyInvalidHistoricalLinks: oldFalseLinks.length,
  correctedLinksUnderNewGate: correctedLinks.length,
  note: "Read-only historical audit. Four-cell candidates are NOT independently validated live tender observations."
};
console.log(JSON.stringify(result, null, 2));
