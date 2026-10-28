import * as cheerio from "cheerio";
import { parseCpppHomeRow, type CpppHomeRow } from "./cppp-home-rows.ts";

export type CpppPublicationKind = "tender" | "corrigendum";
export interface CpppSectionRow extends CpppHomeRow {
  publicationKind: CpppPublicationKind;
  href?: string;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * A four-column row alone cannot distinguish the official Latest Tenders
 * section from Latest Corrigendum. Require an explicit local table header.
 * Preserve both publication types and their original references (including
 * short corrigendum IDs), but never count corrigenda as new tender notices.
 */
export function extractCpppHomeSections(html: string): CpppSectionRow[] {
  const $ = cheerio.load(html);
  const results = new Map<string, CpppSectionRow>();
  $("table").each((_, table) => {
    const rows = $(table).children("thead,tbody").children("tr")
      .add($(table).children("tr")).toArray();
    const cellsOf = (row: typeof rows[number]): string[] =>
      $(row).children("th,td").toArray().map(cell => clean($(cell).text()));
    const headerIndex = rows.findIndex(row => {
      const cells = cellsOf(row);
      return cells.length === 4 &&
        /^(?:Tender Title|Corrigendum Title)$/i.test(cells[0]) &&
        /^Reference No\.?$/i.test(cells[1]) &&
        /^Closing Date$/i.test(cells[2]) &&
        /^Bid Opening Date$/i.test(cells[3]);
    });
    if (headerIndex < 0) return;
    const kind: CpppPublicationKind =
      /^Corrigendum Title$/i.test(cellsOf(rows[headerIndex])[0]) ? "corrigendum" : "tender";
    for (const row of rows.slice(headerIndex + 1)) {
      const parsed = parseCpppHomeRow(cellsOf(row));
      if (!parsed) continue;
      const href = $(row).children("td").first().find("a[href]").first().attr("href");
      const result: CpppSectionRow = { ...parsed, publicationKind: kind };
      if (href) result.href = href;
      results.set(JSON.stringify([kind, parsed.reference, parsed.title]), result);
    }
  });
  return [...results.values()].slice(0, 150);
}

export function officialCpppDetailUrl(href: string | undefined, fallback: string): string {
  if (!href) return fallback;
  try {
    const url = new URL(href, fallback);
    if (url.protocol === "https:" &&
      (url.hostname === "gov.in" || url.hostname.endsWith(".gov.in"))) return url.toString();
  } catch {
    // Malformed or script href cannot serve as primary-source evidence.
  }
  return fallback;
}
