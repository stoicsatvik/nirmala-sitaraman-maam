import assert from "node:assert/strict";
import test from "node:test";
import { sensorCollectionStatus, summarizeSensorCoverage } from "../../src/sensor-health.ts";

test("E427: pinned 30 October snapshot's reachability is not record coverage", () => {
  const rows = [
    ["cga", true, 6, null], ["pfms", false, 0, "fetch failed"],
    ["cppp", true, 46, null], ["gem", true, 0, null],
    ["cag", true, 9, null], ["bmc-tenders", true, 8, null],
    ["maharashtra", true, 7, null], ["bmc-budget", true, 0, "parser no rows"],
    ["awards", true, 0, "no ungated rows"], ["outcomes", true, 1, null]
  ] as const;
  const sensors = rows.map(([id, ok, recordCount, error]) => ({ id, ok, recordCount, error }));
  assert.deepEqual(summarizeSensorCoverage(sensors), {
    total: 10, reachable: 9, yieldingRows: 6, zeroRows: 4,
    reachableWithWarnings: 2, unreachable: 1, emittedRows: 77
  });
});

test("E427: all-zero source health is not treated as useful evidence", () => {
  assert.deepEqual(summarizeSensorCoverage([]), {
    total: 0, reachable: 0, yieldingRows: 0, zeroRows: 0,
    reachableWithWarnings: 0, unreachable: 0, emittedRows: 0
  });
  assert.equal(sensorCollectionStatus({ id: "a", ok: true, recordCount: 0 }), "no rows");
});

test("E427: a reachable source with a parsing warning is limited, not healthy", () => {
  assert.equal(sensorCollectionStatus({ id: "a", ok: true, recordCount: 0, error: "parser empty" }), "limited");
  assert.equal(sensorCollectionStatus({ id: "b", ok: false, recordCount: 0, error: "timeout" }), "error");
  assert.equal(sensorCollectionStatus({ id: "c", ok: true, recordCount: 2 }), "rows emitted");
});

test("E427: duplicate identities and invalid counts fail closed", () => {
  assert.throws(() => summarizeSensorCoverage([
    { id: "a", ok: true, recordCount: 1 }, { id: "a", ok: true, recordCount: 1 }
  ]), /duplicate/);
  assert.throws(() => summarizeSensorCoverage([{ id: "x", ok: true, recordCount: -1 }]), /invalid/);
  assert.throws(() => summarizeSensorCoverage([{ id: "x", ok: true, recordCount: Number.NaN }]), /invalid/);
});
