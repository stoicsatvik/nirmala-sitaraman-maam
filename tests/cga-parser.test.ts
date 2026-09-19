import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCgaReport } from "../scripts/sensors/cga";

const fixtureUrl = new URL("./fixtures/cga-monthly-account.html", import.meta.url);

test("CGA parser deterministically preserves period, units and aggregate values", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const rows = parseCgaReport(html);

  assert.deepEqual(rows.map(({ key, period, budgetEstimateCrore, actualCrore }) => ({ key, period, budgetEstimateCrore, actualCrore })), [
    { key: "total-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 5065345, actualCrore: 1612345.5 },
    { key: "revenue-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 3944255, actualCrore: 1200100 },
    { key: "capital-expenditure", period: "AUGUST 2026", budgetEstimateCrore: 1121090, actualCrore: 412245.5 }
  ]);
});

test("CGA parser fails closed when the report period contract disappears", () => {
  const changedMarkup = `<html><body><table><tr><td>Total Expenditure</td><td>100</td><td>50</td></tr></table></body></html>`;
  assert.deepEqual(parseCgaReport(changedMarkup), []);
});

test("CGA parser fails closed on rows without both budget and actual values", () => {
  const malformed = `<html><body><h1>AS AT THE END OF AUGUST 2026</h1><table><tr><td>Total Expenditure</td><td>100</td></tr></table></body></html>`;
  assert.deepEqual(parseCgaReport(malformed), []);
});
