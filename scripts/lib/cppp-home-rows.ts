/**
 * Strict admission gate for the four-column "Latest Tenders" and "Latest
 * Corrigendum" rows on the public CPPP home page. Navigation, login forms,
 * parent tables and arbitrary HTML are not procurement observations.
 *
 * This is a structural gate, not an independent verification of a tender.
 */
export interface CpppHomeRow {
  title: string;
  reference: string;
  closingDate: string;
  openingDate: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function validPortalDate(value: string): boolean {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(20\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i.exec(value);
  if (!match) return false;
  const month = MONTHS.findIndex((item) => item.toLowerCase() === match[2].toLowerCase());
  const day = Number(match[1]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 0 || hour < 1 || hour > 12 || minute > 59) return false;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return day >= 1 && day <= lastDay;
}

/** Return null rather than treating a loosely matched page cell as evidence. */
export function parseCpppHomeRow(cells: readonly string[]): CpppHomeRow | null {
  if (cells.length !== 4) return null;
  const [title, reference, closingDate, openingDate] = cells.map((value) => value.trim().replace(/\s+/g, " "));
  if (!/^\d{1,3}\.\s+\S/u.test(title) || title.length > 500) return null;
  if (reference.length < 5 || reference.length > 160 || !/[0-9]/.test(reference)) return null;
  if (/[<>{}=;\\]|\b(?:javascript|document\.|function\s*\(|captcha|window\.|formSubmit\s*\()\b/i.test(title + " " + reference)) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._\/()\-]*$/u.test(reference)) return null;
  if (!validPortalDate(closingDate) || !validPortalDate(openingDate)) return null;
  return { title, reference, closingDate, openingDate };
}
