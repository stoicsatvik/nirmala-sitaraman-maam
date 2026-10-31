/** Snapshot recency is distinct from source reachability and row correctness. */
export type SnapshotFreshness = Readonly<{
  state: "fresh" | "stale" | "unknown";
  ageMinutes: number | null;
}>;

export const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function assessSnapshotFreshness(
  generatedAt: string | null,
  nowMs: number,
  maxAgeMs: number = MAX_SNAPSHOT_AGE_MS
): SnapshotFreshness {
  const unknown: SnapshotFreshness = { state: "unknown", ageMinutes: null };
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return unknown;
  if (!generatedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(generatedAt)) return unknown;
  const observedMs = Date.parse(generatedAt);
  if (!Number.isFinite(observedMs)) return unknown;
  // Date.parse may normalize impossible calendar dates (e.g. 30 February).
  if (new Date(observedMs).toISOString().slice(0, 19) !== generatedAt.slice(0, 19)) return unknown;
  const ageMs = nowMs - observedMs;
  if (ageMs < -MAX_FUTURE_CLOCK_SKEW_MS) return unknown;
  return {
    state: ageMs > maxAgeMs ? "stale" : "fresh",
    ageMinutes: Math.floor(Math.max(0, ageMs) / 60000)
  };
}
