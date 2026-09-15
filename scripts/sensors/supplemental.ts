import * as cheerio from "cheerio";
import { fetchText, makeObservedRecord, recordKey, type SensorDefinition, type SensorResult } from "../lib/ingestion";

export const supplementalSensors: SensorDefinition[] = [
  {
    id: "cppp-contract-awards",
    label: "CPPP contract awards",
    scope: "union",
    kind: "procurement",
    authority: "Government of India eProcurement System",
    sourceUrl: "https://www.eprocure.gov.in/epublish/app?page=ResultOfTenders&service=page",
    expectedFreshness: "publication driven, availability checked hourly"
  },
  {
    id: "union-output-outcomes",
    label: "Union Output Outcome Monitoring Framework 2026-27",
    scope: "union",
    kind: "outcome",
    authority: "Ministry of Finance, Government of India",
    sourceUrl: "https://www.indiabudget.gov.in/doc/OutcomeBudgetE2026_2027.pdf",
    expectedFreshness: "budget-year framework, availability checked hourly"
  }
];

async function contractAwards(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const rows = $("table tr").toArray();
    const records = rows
      .map((row) => {
        const cells = $(row).find("td").toArray().map((cell) => $(cell).text().replace(/\s+/g, " ").trim());
        if (cells.length < 4) return null;
        const joined = cells.join(" | ");
        if (!/AOC|award|contract|tender/i.test(joined)) return null;
        const title = cells[3] || cells[2] || joined;
        const reference = joined.match(/(?:GEM\/20\d{4}\/B\/\d+|20\d{4}_[A-Z]+_\d+(?:_\d+)?|[A-Z0-9][A-Z0-9/_-]{5,})/i)?.[0];
        return makeObservedRecord({
          externalKey: recordKey(sensor.id, reference, title),
          sensorId: sensor.id,
          title: title.slice(0, 500),
          authority: sensor.authority,
          jurisdiction: "India",
          fiscalYear: "2026-27",
          state: "procured",
          sourceUrl: sensor.sourceUrl,
          tenderReference: reference,
          note: joined.slice(0, 1200),
          raw: { cells }
        });
      })
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .slice(0, 100);

    return {
      sensor,
      fetchedAt,
      ok: true,
      records,
      error: records.length === 0
        ? "CPPP award surface is reachable, but public award search exposes no ungated result rows without search/captcha input. No award rows were fabricated."
        : undefined
    };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function outcomeFramework(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(sensor.sourceUrl, {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "accept-language": "en-IN,en;q=0.9",
        referer: "https://www.indiabudget.gov.in/",
        range: "bytes=0-4095",
        "x-public-ledger-client": "PublicLedgerIndia/0.2"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000)
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "unknown";
    return {
      sensor,
      fetchedAt,
      ok: true,
      records: [
        makeObservedRecord({
          externalKey: recordKey(sensor.id, "2026-27"),
          sensorId: sensor.id,
          title: "Output Outcome Monitoring Framework 2026-27",
          authority: sensor.authority,
          jurisdiction: "India",
          fiscalYear: "2026-27",
          state: "budgeted",
          sourceUrl: sensor.sourceUrl,
          sourceDocument: sensor.sourceUrl,
          note: "Official outcome-target framework is reachable. This is target evidence, not proof that outcomes were achieved. Achieved-outcome records require separate primary evidence.",
          raw: { contentType, httpStatus: response.status }
        })
      ]
    };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runSupplementalSensors(): Promise<SensorResult[]> {
  return Promise.all(
    supplementalSensors.map((sensor) => {
      if (sensor.id === "cppp-contract-awards") return contractAwards(sensor);
      return outcomeFramework(sensor);
    })
  );
}
