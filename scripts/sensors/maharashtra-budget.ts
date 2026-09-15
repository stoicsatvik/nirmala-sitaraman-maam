import * as cheerio from "cheerio";
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
      const nearby = rowText || clean($(element).parent().parent().text()) || anchorText;
      const looksLikeProgrammePublication = /Publication|प्रकाशन|Accounts and Treasury|Goods and Services Tax|State Lottery|Local Fund|Insurance/i.test(nearby);
      const looksLikeDocument = /\.pdf(?:$|\?)/i.test(href) || /document|download|uploads|wp-content/i.test(href);
      if (!looksLikeProgrammePublication || !looksLikeDocument) return;

      const titleMatch = nearby.match(/(?:Publication|प्रकाशन)[^|]{0,180}/i)?.[0];
      const title = clean(titleMatch ?? nearby).slice(0, 400);
      if (!title) return;

      const sourceUrl = new URL(href, sensor.sourceUrl).toString();
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
          note: "Official Maharashtra FY 2026-27 programme-budget document discovered from the Finance Department index. This is publication-level evidence until line items are normalized.",
          raw: { anchorText, rowText }
        })
      );
    });

    const deduped = [...new Map(records.map((record) => [record.sourceUrl, record])).values()].slice(0, 100);

    if (deduped.length === 0) {
      const pageTitle = clean($("title").text()) || "Maharashtra programme budget 2026-27";
      deduped.push(
        makeObservedRecord({
          externalKey: recordKey(sensor.id, pageTitle),
          sensorId: sensor.id,
          title: pageTitle,
          authority: sensor.authority,
          jurisdiction: "Maharashtra",
          fiscalYear: "2026-27",
          state: "budgeted",
          sourceUrl: sensor.sourceUrl,
          geographicPrecision: "state",
          note: "Programme-budget index observed, but document links did not match the strict parser."
        })
      );
    }

    return { sensor, fetchedAt, ok: true, records: deduped };
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
