import * as cheerio from "cheerio";
import { classifyMaharashtraPublication } from "../lib/maharashtra-publication";
import {
  fetchText,
  makeObservedRecord,
  recordKey,
  type SensorDefinition,
  type SensorResult
} from "../lib/ingestion";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function runMaharashtraBudgetSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();

  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const records: ReturnType<typeof makeObservedRecord>[] = [];

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      const anchorText = clean($(element).text());
      const rowText = clean($(element).closest("tr").text());
      const admitted = classifyMaharashtraPublication(href, rowText, sensor.sourceUrl);
      if (!admitted) return;
      const { title, sourceUrl } = admitted;
      records.push(
        makeObservedRecord({
          externalKey: recordKey(sensor.id, title, sourceUrl),
          sensorId: sensor.id,
          title,
          authority: sensor.authority,
          jurisdiction: "Maharashtra",
          fiscalYear: "2026-27",
          state: "budgeted",
          sourceUrl,
          sourceDocument: sourceUrl,
          geographicPrecision: "state",
          note: "Numbered official Maharashtra programme-budget PDF link discovered. PDF contents and monetary line items are NOT independently verified by this link-only collector.",
          raw: { anchorText, rowText }
        })
      );
    });

    const deduped = [...new Map(records.map((record) => [record.sourceUrl, record])).values()].slice(0, 100);

    return {
      sensor, fetchedAt, ok: true, records: deduped,
      error: deduped.length === 0
        ? "Programme-budget index reachable, but no numbered official PDF rows were admissible. No budget evidence was inferred."
        : undefined
    };
  } catch (error) {
    return {
      sensor,
      fetchedAt,
      ok: false,
      records: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
