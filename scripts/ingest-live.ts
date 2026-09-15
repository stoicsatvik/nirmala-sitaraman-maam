import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { reconcileRecords, type ReconciledLink } from "./lib/reconcile";
import { runAllSensors, sensors } from "./sensors/index";
import { runBmcBudgetSensor } from "./sensors/bmc-budget";
import { runMaharashtraBudgetSensor } from "./sensors/maharashtra-budget";
import { runSupplementalSensors, supplementalSensors } from "./sensors/supplemental";
import type { PublicMoneyRecord, SensorResult } from "./lib/ingestion";

const dryRun = process.argv.includes("--dry-run");
const snapshotPath = new URL("../public/data/live/latest.json", import.meta.url);
const allSensorDefinitions = [...sensors, ...supplementalSensors];

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

async function persistToSupabase(results: SensorResult[], links: ReconciledLink[]) {
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
    const sensorRows = allSensorDefinitions.map((sensor) => {
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

    if (links.length > 0) {
      const keys = [...new Set(links.flatMap((link) => [link.fromExternalKey, link.toExternalKey]))];
      const { data: linkedRecords, error: lookupError } = await db
        .from("live_records")
        .select("id,external_key")
        .in("external_key", keys);
      if (lookupError) throw lookupError;

      const idByKey = new Map((linkedRecords ?? []).map((row) => [row.external_key, row.id]));
      const linkRows = links.flatMap((link) => {
        const fromId = idByKey.get(link.fromExternalKey);
        const toId = idByKey.get(link.toExternalKey);
        if (!fromId || !toId || fromId === toId) return [];
        return [
          {
            from_live_record_id: fromId,
            to_live_record_id: toId,
            relation: link.relation,
            match_basis: link.basis,
            confidence: link.confidence,
            reference: link.reference
          }
        ];
      });

      if (linkRows.length > 0) {
        const { error: linksError } = await db
          .from("record_links")
          .upsert(linkRows, {
            onConflict: "from_live_record_id,to_live_record_id,match_basis,reference",
            ignoreDuplicates: true
          });
        if (linksError) throw linksError;
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
        commit_sha: process.env.GITHUB_SHA ?? null,
        metadata: { reconciled_links: links.length }
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

const baseResults = await runAllSensors();
const bmcBudgetDefinition = sensors.find((sensor) => sensor.id === "bmc-budget");
const maharashtraBudgetDefinition = sensors.find((sensor) => sensor.id === "maharashtra-program-budget");

const [bmcBudgetResult, maharashtraBudgetResult, supplementalResults] = await Promise.all([
  bmcBudgetDefinition ? runBmcBudgetSensor(bmcBudgetDefinition) : Promise.resolve(undefined),
  maharashtraBudgetDefinition ? runMaharashtraBudgetSensor(maharashtraBudgetDefinition) : Promise.resolve(undefined),
  runSupplementalSensors()
]);

const results = [
  ...baseResults.filter(
    (result) => result.sensor.id !== "bmc-budget" && result.sensor.id !== "maharashtra-program-budget"
  ),
  ...(maharashtraBudgetResult ? [maharashtraBudgetResult] : []),
  ...(bmcBudgetResult ? [bmcBudgetResult] : []),
  ...supplementalResults
];

const records = results.flatMap((result) => result.records);
const links = reconcileRecords(records);

const snapshot = {
  generatedAt: new Date().toISOString(),
  semantics: {
    live: "Freshly polled public-source observations, not a claim of real-time banking or treasury telemetry.",
    amount: "Amounts are included only when parsed with sufficient confidence from the primary source.",
    geography: "Pinpoint coordinates are emitted only where supported by source evidence; text-only locations remain text-only.",
    reconciliation: "Verified graph links are created only from exact public identifiers. Fuzzy matches are not promoted to evidence-chain links."
  },
  summary: {
    sensors: results.length,
    healthySensors: results.filter((result) => result.ok).length,
    records: records.length,
    reconciledLinks: links.length
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
  records,
  links
};

await mkdir(new URL("../public/data/live/", import.meta.url), { recursive: true });
await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

console.log(
  `Ingestion complete: ${snapshot.summary.healthySensors}/${snapshot.summary.sensors} sensors healthy, ${snapshot.summary.records} observations, ${snapshot.summary.reconciledLinks} exact links.`
);

if (!dryRun) {
  await persistToSupabase(results, links);
}

if (snapshot.summary.healthySensors === 0) {
  process.exitCode = 1;
}
