import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSnapshotFreshness, MAX_SNAPSHOT_AGE_MS } from '../src/snapshot-freshness.ts';

const anchor = '2026-10-31T06:58:47.306Z';
const observed = Date.parse(anchor);

test('fresh hourly snapshot remains fresh at 119 minutes', () => {
  assert.deepEqual(assessSnapshotFreshness(anchor, observed + 119 * 60000), { state: 'fresh', ageMinutes: 119 });
});

test('two-hour boundary is inclusive and immediately older snapshot is stale', () => {
  assert.equal(assessSnapshotFreshness(anchor, observed + MAX_SNAPSHOT_AGE_MS).state, 'fresh');
  assert.equal(assessSnapshotFreshness(anchor, observed + MAX_SNAPSHOT_AGE_MS + 1).state, 'stale');
});

test('actual 31 October snapshot is stale at fixed 10:32:19 UTC evaluation', () => {
  assert.deepEqual(assessSnapshotFreshness(anchor, Date.parse('2026-10-31T10:32:19.000Z')), { state: 'stale', ageMinutes: 213 });
});

test('missing, malformed and impossible calendar timestamps are unknown', () => {
  for (const bad of [null, '', 'yesterday', '2026-02-30T00:00:00Z', '2026-10-31T06:58:47']) {
    assert.deepEqual(assessSnapshotFreshness(bad, observed), { state: 'unknown', ageMinutes: null });
  }
});

test('future timestamp beyond five-minute clock tolerance is unknown', () => {
  assert.equal(assessSnapshotFreshness(anchor, observed - 5 * 60000 - 1).state, 'unknown');
  assert.deepEqual(assessSnapshotFreshness(anchor, observed - 5 * 60000), { state: 'fresh', ageMinutes: 0 });
});

test('nonfinite clock or invalid policy threshold fails closed', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.equal(assessSnapshotFreshness(anchor, bad).state, 'unknown');
    assert.equal(assessSnapshotFreshness(anchor, observed, bad).state, 'unknown');
  }
  assert.equal(assessSnapshotFreshness(anchor, observed, 0).state, 'unknown');
});
