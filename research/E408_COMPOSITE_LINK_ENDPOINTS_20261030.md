# E408 | Composite public-evidence link endpoint identity

**30 October 2026.** Research-only, synthetic identity-integrity correction stacked on E407 PR #15. No live ingestion, database read/write, deployment, political allegation, or merge.

## Falsifiable defect

The persistence schema upserts `live_records` by `(sensor_id, external_key)`, but the original link writer queried only `external_key` and built a `Map<external_key, id>`. If an unrelated sensor reused the same external key, the last returned row could silently replace the intended endpoint. The E407 reconciler already rejected identical external keys *within a pair*, but an unrelated third sensor could still hijack a link at persistence time.

## Correction

1. Carry `fromSensorId` and `toSensorId` from the reconciler into the link contract.
2. Select `id,sensor_id,external_key` from persisted records and resolve each endpoint using the exact composite tuple.
3. Fail closed when either endpoint is missing, duplicated under the same composite identity, or resolves to the same UUID.
4. Preserve E407's conservative shared-reference semantics. This does **not** establish a payment, a causal state transition, or that two public records refer to the same underlying transaction.

## Validation

Five synthetic local Node 22 mirror checks passed: unrelated third-sensor key collision, missing scoped endpoint, duplicate composite identity, self-link rejection, and distinct sensors sharing one external key. Repository regression file `tests/reconcile-e408.test.mjs` contains corresponding cases. Existing E407 positive fixture updated to include sensor identity.

**Limitations:** The isolated mirror is not exact repository execution. Full repository tests, TypeScript build, GitHub Actions, live DB collision prevalence, and persisted-link history audit are **NOT YET VERIFIED**. GitHub's 29 October billing alert reported 2,000/2,000 included Actions minutes consumed; no manual CI run was initiated. `[skip ci]` was used to avoid quota exposure.

## Next gates

Run `node --experimental-strip-types --test tests/reconcile-e407.test.mjs tests/reconcile-e408.test.mjs` and `npm run build` on a checked-out branch or after the confirmed quota reset. Conduct a separately authorized read-only audit of persisted links for cross-sensor key collisions and old E407-style unsupported links. Do not delete historical links automatically.

## Claim boundary

**SUPPORTED in isolated synthetic mirror:** composite endpoint resolution prevents the demonstrated key-collision misbinding and abstains on ambiguous endpoints. **NOT YET PROVEN:** integration correctness, real collision frequency, or accuracy of existing live public-money links.
