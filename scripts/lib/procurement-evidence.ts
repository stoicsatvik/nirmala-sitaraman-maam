import * as cheerio from "cheerio";

export interface CpppTenderRow {
  title: string;
  reference: string;
  closingDate: string;
  openingDate: string;
  href?: string;
  sourceCells: string[];
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isPlausibleTenderReference(value: string): boolean {
  const ref = clean(value);
  return ref.length >= 5 && ref.length <= 120 &&
    /[0-9]/.test(ref) && /^[A-Za-z0-9][A-Za-z0-9/._ -]*$/.test(ref);
}

function isOfficialDate(value: string): boolean {
  const match = clean(value).match(/^(\d{1,2})-([A-Za-z]{3})-(20\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) return false;
  const months = new Set(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]);
  return Number(match[1]) >= 1 && Number(match[1]) <= 31 &&
    months.has(match[2].toUpperCase()) && Number(match[4]) >= 1 &&
    Number(match[4]) <= 12 && Number(match[5]) <= 59;
}

export function parseCpppTenderCells(cells: string[]): CpppTenderRow | undefined {
  if (cells.length !== 4) return undefined;
  const [numberedTitle, reference, closingDate, openingDate] = cells.map(clean);
  const titleMatch = numberedTitle.match(/^\d{1,3}\.\s+(.{8,500})$/);
  if (!titleMatch || !isPlausibleTenderReference(reference)) return undefined;
  if (!isOfficialDate(closingDate) || !isOfficialDate(openingDate)) return undefined;
  const title = titleMatch[1];
  if (/^(?:corrigendum|corregendum|corr[- ]|due date extension|tender date extension)/i.test(title)) return undefined;
  return { title, reference, closingDate, openingDate, sourceCells: cells };
}

/**
 * Only direct four-cell rows in a table with an explicit tender-header schema
 * qualify. Descendant td traversal previously misread layout/navigation tables
 * as 46 procurement records, and one false "verified" evidence-chain link.
 * Corrigenda and award rows are different publication states and are excluded.
 */
export function extractCpppTenderRows(html: string): CpppTenderRow[] {
  const $ = cheerio.load(html);
  const found = new Map<string, CpppTenderRow>();

  $("table").each((_, table) => {
    const rows = $(table).children("thead,tbody").children("tr")
      .add($(table).children("tr")).toArray();
    const cellsOf = (row: typeof rows[number]): string[] =>
      $(row).children("th,td").toArray().map(cell => clean($(cell).text()));

    const headerIndex = rows.findIndex(row => {
      const cells = cellsOf(row);
      return cells.length === 4 &&
        /^tender title$/i.test(cells[0]) &&
        /^reference no\.?$/i.test(cells[1]) &&
        /^closing date$/i.test(cells[2]) &&
        /^bid opening date$/i.test(cells[3]);
    });
    if (headerIndex < 0) return;

    for (const row of rows.slice(headerIndex + 1)) {
      const parsed = parseCpppTenderCells(cellsOf(row));
      if (!parsed) continue;
      const href = $(row).children("td").first().find("a[href]").first().attr("href");
      if (href) parsed.href = href;
      const key = parsed.reference.toUpperCase() + "\u0000" + parsed.title.toUpperCase();
      found.set(key, parsed);
    }
  });

  return [...found.values()].slice(0, 150);
}

export function resolveOfficialTenderUrl(href: string | undefined, fallback: string): string {
  if (!href) return fallback;
  try {
    const url = new URL(href, fallback);
    if (url.protocol === "https:" && (url.hostname === "gov.in" || url.hostname.endsWith(".gov.in"))) {
      return url.toString();
    }
  } catch {
    // A malformed or script URL is not evidence of a public tender detail.
  }
  return fallback;
}
