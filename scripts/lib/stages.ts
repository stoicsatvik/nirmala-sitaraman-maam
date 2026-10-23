/**
 * A published invitation to bid is not a contract award.
 * Legacy snapshots labelled tender-list observations as "procured".
 * Interpret those records conservatively without rewriting historical evidence.
 */
export const TENDER_NOTICE_SENSOR_IDS = new Set([
  "cppp-procurement",
  "gem-bids",
  "bmc-tenders"
]);

export function stageForObservation(sensorId: string, state: string): string {
  if (state === "procured" && TENDER_NOTICE_SENSOR_IDS.has(sensorId)) {
    return "tender_published";
  }
  return state;
}
