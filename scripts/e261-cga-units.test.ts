import assert from "node:assert/strict";
import test from "node:test";
import { croreToExactRupees } from "./lib/cga-units";

test("CGA August 2026 primary-source amount converts to integer rupees", () => {
  assert.equal(187037.42 * 10_000_000, 1870374200000.0002); // expected-red original
  assert.equal(croreToExactRupees(187037.42), 1870374200000);
  assert.equal(croreToExactRupees(1568009), 15680090000000);
  assert.equal(croreToExactRupees(509949), 5099490000000);
  assert.equal(croreToExactRupees(2077958), 20779580000000);
});

test("zero, small amounts and signed corrections remain representable", () => {
  assert.equal(croreToExactRupees(0), 0);
  assert.equal(croreToExactRupees(0.0000001), 1);
  assert.equal(croreToExactRupees(-0.01), -100000);
  assert.equal(croreToExactRupees(0.01), 100000);
});

test("nonfinite, unsafe and sub-rupee amounts fail closed", () => {
  for (const invalid of [NaN, Infinity, -Infinity, 1e12, -1e12, 0.00000004, -0.00000004]) {
    assert.throws(() => croreToExactRupees(invalid), RangeError);
  }
});

test("August 2026 CGA total equals revenue plus capital without double-counting subsets", () => {
  const revenue = croreToExactRupees(1568009);
  const capital = croreToExactRupees(509949);
  const total = croreToExactRupees(2077958);
  assert.equal(revenue + capital, total);
  const revenueBudget = croreToExactRupees(4125494);
  const capitalBudget = croreToExactRupees(1221821);
  const totalBudget = croreToExactRupees(5347315);
  assert.equal(revenueBudget + capitalBudget, totalBudget);
  // Interest, loans and subsidies are reported subsets, not extra expenditure.
  assert.ok(croreToExactRupees(514810) < revenue);
  assert.ok(croreToExactRupees(139417) < capital);
  assert.ok(croreToExactRupees(187037.42) < revenue);
});
