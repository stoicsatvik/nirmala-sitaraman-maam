import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cgaRowToRecord, parseCgaReport } from "../scripts/sensors/cga";
import type { SensorDefinition } from "../scripts/lib/ingestion";

const fixtureUrl = new URL("./fixtures/cga-monthly-account.html", import.meta.url);
const sensor: SensorDefinition = {
  id: "cga-monthly-accounts",
  label: "Controller General of Accounts monthly accounts",
  scope: "union",
  kind: "accounts",
  authority: "Controller General of Accounts",
  sourceUrl: "https://cga.nic.in/",
  expectedFreshness: "monthly"
};
const reportUrl = "https://cga.nic.in/writereaddata/MonthAccount/frozen-august-2026.html";

test("CGA parser deterministically preserves period, units and aggregate values", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const rows = parseCgaReport(html);

  assert.deepEqual(rows.map(({ key, period, budgetEstimateCrore, actualCrore }) => ({ key, period, budgetEstimateCrore, actualCrore })), [
    { key: "total-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 5065345, actualCrore: 1612345.5 },
    { key: "revenue-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 3944255, actualCrore: 1200100 },
    { key: "capital-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 1121090, actualCrore: 412245.5 }
  ]);
});

test("CGA normalized record preserves provenance and stable evidence identity", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const [row] = parseCgaReport(html);
  const first = cgaRowToRecord(sensor, row, 8, reportUrl);
  const second = cgaRowToRecord(sensor, row, 8, reportUrl);

  assert.equal(first.externalKey, "cga-monthly-accounts:total-expenditure:8:2026-2027");
  assert.equal(first.amountInr, 1612345.5 * 10_000_000);
  assert.equal(first.sourceUrl, reportUrl);
  assert.equal(first.sourceDocument, reportUrl);
  assert.equal(first.state, "paid");
  assert.equal(first.evidenceHash, second.evidenceHash);
  assert.deepEqual(first.raw, {
    period: "AUGUST 2026",
    month: 8,
    actualCrore: 1612345.5,
    budgetEstimateCrore: 5065345,
    sourceCells: ["Total Expenditure", "50,65,345.00", "16,12,345.50", "31.8%"]
  });
});

test("CGA evidence identity changes when the primary-source URL changes", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const [row] = parseCgaReport(html);
  const first = cgaRowToRecord(sensor, row, 8, reportUrl);
  const moved = cgaRowToRecord(sensor, row, 8, `${reportUrl}?revision=2`);
  assert.notEqual(first.evidenceHash, moved.evidenceHash);
});

test("CGA parser fails closed when the report period contract disappears", () => {
  const changedMarkup = `<html><body><table><tr><td>Total Expenditure</td><td>100</td><td>50</td></tr></table></body></html>`;
  assert.deepEqual(parseCgaReport(changedMarkup), []);
});

test("CGA parser fails closed on rows without both budget and actual values", () => {
  const malformed = `<html><body><h1>AS AT THE END OF AUGUST 2026</h1><table><tr><td>Total Expenditure</td><td>100</td></tr></table></body></html>`;
  assert.deepEqual(parseCgaReport(malformed), []);
});
