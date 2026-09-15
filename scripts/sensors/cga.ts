import * as cheerio from "cheerio";
import {
  fetchText,
  makeObservedRecord,
  recordKey,
  type SensorDefinition,
  type SensorResult
} from "../lib/ingestion";

const FISCAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const FY = "2026-2027";
const DISCOVERY_URL = `https://cga.nic.in/MonthlyReport/Published/4/${FY}.aspx`;

const expenditureLabels: Array<{ pattern: RegExp; key: string; label: string }> = [
  { pattern: /total\s+expenditure/i, key: "total-expenditure", label: "Total Expenditure" },
  { pattern: /revenue\s+expenditure/i, key: "revenue-expenditure", label: "Revenue Expenditure" },
  { pattern: /capital\s+expenditure/i, key: "capital-expenditure", label: "Capital Expenditure" },
  { pattern: /interest\s+payments/i, key: "interest-payments", label: "Interest Payments" },
  { pattern: /loans\s+disbursed/i, key: "loans-disbursed", label: "Loans Disbursed" },
  { pattern: /total\s+major\s+subsidies/i, key: "major-subsidies", label: "Total Major Subsidies" }
];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function latestPublishedMonth(html: string): { month: number; url: string } | undefined {
  const $ = cheerio.load(html);
  const available = new Map<number, string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const match = href.match(/\/MonthlyReport\/Published\/(\d{1,2})\/2026-2027\.aspx/i);
    if (!match) return;
    const month = Number(match[1]);
    if (!FISCAL_MONTH_ORDER.includes(month)) return;
    available.set(month, new URL(href, DISCOVERY_URL).toString());
  });

  const latest = [...available.keys()].sort(
    (a, b) => FISCAL_MONTH_ORDER.indexOf(b) - FISCAL_MONTH_ORDER.indexOf(a)
  )[0];

  if (!latest) return undefined;
  return { month: latest, url: available.get(latest)! };
}

function reportUrlFromMonthPage(html: string, monthPageUrl: string): string | undefined {
  const $ = cheerio.load(html);
  const iframe = $("iframe[src]")
    .toArray()
    .map((element) => $(element).attr("src"))
    .find((src) => src && /writereaddata\/MonthAccount/i.test(src));

  if (iframe) return new URL(iframe, monthPageUrl).toString();

  const fallback = html.match(/(?:https?:\/\/[^\"'<>\s]+)?\/writereaddata\/MonthAccount\/[^\"'<>\s]+/i)?.[0];
  return fallback ? new URL(fallback, monthPageUrl).toString() : undefined;
}

function numbersAfterLabel(cells: string[], labelIndex: number): number[] {
  const values: number[] = [];
  for (const cell of cells.slice(labelIndex + 1)) {
    if (/%/.test(cell)) continue;
    for (const match of cell.replace(/,/g, "").matchAll(/-?\d+(?:\.\d+)?/g)) {
      const value = Number(match[0]);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  return values;
}

function extractReportPeriod(text: string): string | undefined {
  return clean(text).match(/AS AT THE END\s+OF\s+([A-Z]+\s+20\d{2})/i)?.[1];
}

export async function runCgaSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();

  try {
    const discoveryHtml = await fetchText(DISCOVERY_URL);
    const latest = latestPublishedMonth(discoveryHtml);
    if (!latest) {
      return {
        sensor,
        fetchedAt,
        ok: true,
        records: [],
        error: "CGA is reachable, but no FY 2026-27 monthly-report links were discovered."
      };
    }

    const monthHtml = latest.url === DISCOVERY_URL ? discoveryHtml : await fetchText(latest.url);
    const reportUrl = reportUrlFromMonthPage(monthHtml, latest.url);
    if (!reportUrl) {
      return {
        sensor,
        fetchedAt,
        ok: true,
        records: [],
        error: `CGA month ${latest.month} is published, but its embedded account report URL was not found.`
      };
    }

    const reportHtml = await fetchText(reportUrl);
    const $ = cheerio.load(reportHtml);
    const bodyText = clean($("body").text());
    const period = extractReportPeriod(bodyText) ?? `month ${latest.month}, FY 2026-27`;
    const records: ReturnType<typeof makeObservedRecord>[] = [];

    $("tr").each((_, row) => {
      const cells = $(row).find("th,td").toArray().map((cell) => clean($(cell).text())).filter(Boolean);
      if (cells.length < 3) return;
      const joined = cells.join(" ");

      for (const definition of expenditureLabels) {
        if (!definition.pattern.test(joined)) continue;
        const labelIndex = cells.findIndex((cell) => definition.pattern.test(cell));
        if (labelIndex < 0) continue;
        const values = numbersAfterLabel(cells, labelIndex);
        if (values.length < 2) continue;

        const budgetCrore = values[0];
        const actualCrore = values[1];
        records.push(
          makeObservedRecord({
            externalKey: recordKey(sensor.id, definition.key, latest.month, FY),
            sensorId: sensor.id,
            title: `${definition.label} — actuals up to ${period}`,
            authority: sensor.authority,
            jurisdiction: "India",
            fiscalYear: "2026-27",
            state: "paid",
            amountInr: actualCrore * 10_000_000,
            sourceUrl: reportUrl,
            sourceDocument: reportUrl,
            ministry: "Union Government",
            note: `CGA provisional unaudited actual: ₹${actualCrore.toLocaleString("en-IN")} crore; FY budget estimate ₹${budgetCrore.toLocaleString("en-IN")} crore. Aggregate account figure, not an individual treasury transaction.`,
            raw: {
              period,
              month: latest.month,
              actualCrore,
              budgetEstimateCrore: budgetCrore,
              sourceCells: cells
            }
          })
        );
      }
    });

    const deduped = [...new Map(records.map((record) => [record.externalKey, record])).values()];
    return {
      sensor,
      fetchedAt,
      ok: true,
      records: deduped,
      error: deduped.length === 0 ? `CGA report for ${period} was found, but no expenditure rows matched the strict parser.` : undefined
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
