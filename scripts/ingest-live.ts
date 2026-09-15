import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { runAllSensors, sensors } from "./sensors/index";
import type { PublicMoneyRecord, SensorResult } from "./lib/ingestion";

const dryRun = process.argv.includes("--dry-run");
const snapshotPath = new URL("../public/data/live/latest.json", import.meta.url);

function dbRow(record: PublicMoneyRecord) {
  return {
    external_key: record.externalKey,
    sensor_id: record.sensorId,
    title: record.title,
    authority: record.authority,
    jurisdiction: record.jurisdiction,
    fiscal_year: record.fiscalYear ?? null,
    state: record.state,
    amount_inr: record.amountInr ?? null,
    published_at: record.publishedAt ?? null,
    observed_at: record.observedAt,
    source_url: record.sourceUrl,
    source_document: record.sourceDocument ?? null,
    location_text: record.locationText ?? null,
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    geographic_precision: record.geographicPrecision ?? null,
    vendor: record.vendor ?? null,
    tender_reference: record.tenderReference ?? null,
    scheme: record.scheme ?? null,
    ministry: record.ministry ?? null,
    note: record.note ?? null,
    evidence_hash: record.evidenceHash,
    raw: record.raw ?? {},
    last_seen_at: new Date().toISOString()
  };
}

async function persistToSupabase(results: SensorResult[]) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log("Supabase secrets not configured; snapshot only.");
    return;
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();
  const totalRecords = results.reduce((sum, result) => sum + result.records.length, 0);
  const successful = results.filter((result) => result.ok).length;

  const { data: run, error: runError } = await db
    .from("ingestion_runs")
    .insert({ started_at: startedAt, sensor_count: results.length })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    const sensorRows = sensors.map((sensor) => {
      const result = results.find((item) => item.sensor.id === sensor.id);
      return {
        id: sensor.id,
        label: sensor.label,
        authority: sensor.authority,
        scope: sensor.scope,
        kind: sensor.kind,
        source_url: sensor.sourceUrl,
        expected_freshness: sensor.expectedFreshness,
        last_attempt_at: result?.fetchedAt ?? startedAt,
        last_success_at: result?.ok ? result.fetchedAt : null,
        last_record_count: result?.records.length ?? 0,
        last_error: result?.error ?? null,
        updated_at: new Date().toISOString()
      };
    });

    const { error: sensorError } = await db.from("sensors").upsert(sensorRows, { onConflict: "id" });
    if (sensorError) throw sensorError;

    for (const result of results) {
      if (!result.ok || result.records.length === 0) continue;
      const rows = result.records.map(dbRow);
      const { data: persisted, error } = await db
        .from("live_records")
        .upsert(rows, { onConflict: "sensor_id,external_key" })
        .select("id,external_key,evidence_hash,observed_at");
      if (error) throw error;

      const originalByKey = new Map(result.records.map((record) => [record.externalKey, record]));
      const historyRows = (persisted ?? []).map((row) => ({
        live_record_id: row.id,
        evidence_hash: row.evidence_hash,
        observed_at: row.observed_at,
        snapshot: originalByKey.get(row.external_key) ?? {}
      }));
      if (historyRows.length) {
        const { error: historyError } = await db
          .from("record_history")
          .upsert(historyRows, { onConflict: "live_record_id,evidence_hash", ignoreDuplicates: true });
        if (historyError) throw historyError;
      }
    }

    const status = successful === results.length ? "success" : successful > 0 ? "partial" : "failed";
    const { error: finishError } = await db
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        successful_sensor_count: successful,
        record_count: totalRecords,
        commit_sha: process.env.GITHUB_SHA ?? null
      })
      .eq("id", run.id);
    if (finishError) throw finishError;
  } catch (error) {
    await db
      .from("ingestion_runs")
      .update({ finished_at: new Date().toISOString(), status: "failed", metadata: { error: String(error) } })
      .eq("id", run.id);
    throw error;
  }
}

const results = await runAllSensors();
const snapshot = {
  generatedAt: new Date().toISOString(),
  semantics: {
    live: "Freshly polled public-source observations, not a claim of real-time banking or treasury telemetry.",
    amount: "Amounts are included only when parsed with sufficient confidence from the primary source.",
    geography: "Pinpoint coordinates are emitted only where supported by source evidence; text-only locations remain text-only."
  },
  summary: {
    sensors: results.length,
    healthySensors: results.filter((result) => result.ok).length,
    records: results.reduce((sum, result) => sum + result.records.length, 0)
  },
  sensors: results.map((result) => ({
    id: result.sensor.id,
    label: result.sensor.label,
    authority: result.sensor.authority,
    scope: result.sensor.scope,
    kind: result.sensor.kind,
    sourceUrl: result.sensor.sourceUrl,
    expectedFreshness: result.sensor.expectedFreshness,
    fetchedAt: result.fetchedAt,
    ok: result.ok,
    recordCount: result.records.length,
    error: result.error ?? null
  })),
  records: results.flatMap((result) => result.records)
};

await mkdir(new URL("../public/data/live/", import.meta.url), { recursive: true });
await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

console.log(
  `Ingestion complete: ${snapshot.summary.healthySensors}/${snapshot.summary.sensors} sensors healthy, ${snapshot.summary.records} observations.`
);

if (!dryRun) {
  await persistToSupabase(results);
}

if (snapshot.summary.healthySensors === 0) {
  process.exitCode = 1;
}
