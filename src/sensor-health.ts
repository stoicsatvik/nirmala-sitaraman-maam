/** Collector health describes reachability and emitted rows, not evidentiary validity. */
export type SensorHealthInput = Readonly<{
  id: string;
  ok: boolean;
  recordCount: number;
  error?: string | null;
}>;

export type SensorCoverage = Readonly<{
  total: number;
  reachable: number;
  yieldingRows: number;
  zeroRows: number;
  reachableWithWarnings: number;
  unreachable: number;
  emittedRows: number;
}>;

export function summarizeSensorCoverage(sensors: readonly SensorHealthInput[]): SensorCoverage {
  const seen = new Set<string>();
  let reachable = 0;
  let yieldingRows = 0;
  let zeroRows = 0;
  let reachableWithWarnings = 0;
  let emittedRows = 0;
  for (const sensor of sensors) {
    if (!sensor.id || seen.has(sensor.id)) throw new Error("duplicate or missing sensor identity");
    seen.add(sensor.id);
    if (!Number.isSafeInteger(sensor.recordCount) || sensor.recordCount < 0) {
      throw new Error(`invalid record count for ${sensor.id}`);
    }
    if (sensor.ok) reachable += 1;
    if (sensor.recordCount > 0) yieldingRows += 1;
    else zeroRows += 1;
    if (sensor.ok && sensor.error) reachableWithWarnings += 1;
    emittedRows += sensor.recordCount;
  }
  return {
    total: sensors.length,
    reachable,
    yieldingRows,
    zeroRows,
    reachableWithWarnings,
    unreachable: sensors.length - reachable,
    emittedRows
  };
}

export function sensorCollectionStatus(sensor: SensorHealthInput): "error" | "limited" | "no rows" | "rows emitted" {
  if (!sensor.ok) return "error";
  if (sensor.error) return "limited";
  if (sensor.recordCount === 0) return "no rows";
  return "rows emitted";
}
