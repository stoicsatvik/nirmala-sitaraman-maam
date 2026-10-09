import * as cheerio from "cheerio";
import {
  fetchText,
  makeObservedRecord,
  recordKey,
  type PublicMoneyRecord,
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

export interface CgaParsedRow {
  key: string;
  label: string;
  period: string;
  budgetEstimateCrore: number;
  actualCrore: number;
  sourceCells: string[];
}

/** Pure parser boundary used by both live ingestion and frozen-fixture tests. */
export function parseCgaReport(html: string): CgaParsedRow[] {
  const $ = cheerio.load(html);
  const period = extractReportPeriod($("body").text());
  if (!period) return [];

  const rows: CgaParsedRow[] = [];
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
      rows.push({
        key: definition.key,
        label: definition.label,
        period,
        budgetEstimateCrore: values[0],
        actualCrore: values[1],
        sourceCells: cells
      });
    }
  });

  return [...new Map(rows.map((row) => [row.key, row])).values()];
}

/** Deterministic provenance boundary: the same published row and URL produce the same evidence hash. */
export function cgaRowToRecord(
  sensor: SensorDefinition,
  row: CgaParsedRow,
  month: number,
  reportUrl: string
): PublicMoneyRecord {
  return makeObservedRecord({
    externalKey: recordKey(sensor.id, row.key, month, FY),
    sensorId: sensor.id,
    title: `${row.label} — actuals up to ${row.period}`,
    authority: sensor.authority,
    jurisdiction: "India",
    fiscalYear: "2026-27",
    state: "paid",
    amountInr: row.actualCrore * 10_000_000,
    sourceUrl: reportUrl,
    sourceDocument: reportUrl,
    ministry: "Union Government",
    note: `CGA provisional unaudited actual: ₹${row.actualCrore.toLocaleString("en-IN")} crore; FY budget estimate ₹${row.budgetEstimateCrore.toLocaleString("en-IN")} crore. Aggregate account figure, not an individual treasury transaction.`,
    raw: {
      period: row.period,
      month,
      actualCrore: row.actualCrore,
      budgetEstimateCrore: row.budgetEstimateCrore,
      sourceCells: row.sourceCells
    }
  });
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
    const parsed = parseCgaReport(reportHtml);
    const records = parsed.map((row) => cgaRowToRecord(sensor, row, latest.month, reportUrl));

    return {
      sensor,
      fetchedAt,
      ok: true,
      records,
      error: records.length === 0 ? `CGA report for month ${latest.month}, FY 2026-27 was found, but failed the strict period/row parser.` : undefined
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
