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

function isCpppDate(value: string): boolean {
  return /^\d{1,2}[-/]?[A-Za-z]{3}[-/]?20\d{2}$/.test(value.replace(/\s+/g, "")) || /^\d{1,2}[-/]\d{1,2}[-/]20\d{2}$/.test(value);
}

async function contractAwards(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const rows = $("table tr").toArray();
    const records = rows
      .map((row) => {
        const cells = $(row).find("td").toArray().map((cell) => $(cell).text().replace(/\s+/g, " ").trim());

        // A real CPPP AOC result row is expected to carry:
        // S.No | AOC Date | e-Published Date | Title + Ref/Tender ID | Organisation Chain | AOC No
        // Navigation/search rows previously matched loose words such as "tender" and were false positives.
        if (cells.length < 6 || !/^\d+$/.test(cells[0]) || !isCpppDate(cells[1]) || !isCpppDate(cells[2])) return null;

        const title = cells[3];
        const organisation = cells[4];
        const aocNo = cells[5];
        if (!title || !organisation || !aocNo) return null;

        const reference = title.match(/(?:GEM\/20\d{4}\/B\/\d+|20\d{4}_[A-Z]+_\d+(?:_\d+)?|[A-Z0-9][A-Z0-9/_-]{5,})/i)?.[0];
        const link = $(row).find("a[href]").first().attr("href");
        const sourceUrl = link ? new URL(link, sensor.sourceUrl).toString() : sensor.sourceUrl;

        return makeObservedRecord({
          externalKey: recordKey(sensor.id, aocNo, reference, title),
          sensorId: sensor.id,
          title: title.slice(0, 500),
          authority: sensor.authority,
          jurisdiction: "India",
          fiscalYear: "2026-27",
          state: "procured",
          sourceUrl,
          tenderReference: reference,
          ministry: organisation.slice(0, 300),
          note: `CPPP Award of Contract row. AOC date: ${cells[1]}; e-published: ${cells[2]}; AOC no: ${aocNo}. Vendor/value fields are not asserted unless exposed in a linked primary award detail.`,
          raw: { cells, aocDate: cells[1], ePublishedDate: cells[2], organisation, aocNo }
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
        ? "CPPP award surface is reachable, but the ungated response contains no strict AOC result rows. Search/captcha-gated awards are not fabricated."
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
