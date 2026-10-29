import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCpppHomeSections, officialCpppDetailUrl } from "../scripts/lib/cppp-home-sections.ts";

const dates = ["03-Nov-2026 05:00 PM", "04-Nov-2026 05:00 PM"];
const header = (first: string) =>
  '<tr><td>' + first + '</td><td>Reference No</td><td>Closing Date</td><td>Bid Opening Date</td></tr>';
const row = (title: string, ref: string) =>
  '<tr><td>' + title + '</td><td>' + ref + '</td><td>' + dates[0] + '</td><td>' + dates[1] + '</td></tr>';

test("E361: nested wrapper does not duplicate direct tender; corrigenda remain distinct", () => {
  const html = '<table><tr><td>Navigation</td><td><table>' +
    header("Tender Title") + row("1. Contract for catering", "2026/IRCTC/TSV/06/OCTOBER/46") +
    '</table></td></tr></table>' +
    '<table>' + header("Corrigendum Title") +
    row("1. Corrigendum 01", "HK1") +
    row("2. Corregendum 01", "HK1") + '</table>';
  const parsed = extractCpppHomeSections(html);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed.map(x => x.publicationKind), ["tender", "corrigendum", "corrigendum"]);
  assert.equal(parsed[1].reference, "HK1");
  assert.equal(parsed[2].reference, "HK1");
  assert.notEqual(parsed[1].title, parsed[2].title);
});

test("E361: four-cell navigation and unheaded listings cannot masquerade as a tender section", () => {
  const html = '<table>' +
    row("1. Contract for catering", "2026/IRCTC/TSV/06/OCTOBER/46") + '</table>' +
    '<table>' + header("Advanced Search") +
    row("1. Contract for catering", "2026/IRCTC/TSV/06/OCTOBER/46") + '</table>';
  assert.deepEqual(extractCpppHomeSections(html), []);
});

test("E361: malformed and external links are not accepted as official detail evidence", () => {
  const base = "https://www.eprocure.gov.in/epublish/app?service=home";
  assert.equal(officialCpppDetailUrl("javascript:popup('x')", base), base);
  assert.equal(officialCpppDetailUrl("https://example.com/fake", base), base);
  assert.match(officialCpppDetailUrl("/epublish/app?page=detail", base), /^https:\/\/www\.eprocure\.gov\.in\//);
});


test("E386: unrelated government hosts cannot impersonate CPPP tender detail evidence", () => {
  const base = "https://www.eprocure.gov.in/epublish/app?service=home";
  assert.equal(officialCpppDetailUrl("https://other-department.gov.in/not-a-cppp-tender", base), base);
  assert.equal(officialCpppDetailUrl("https://gov.in/unrelated", base), base);
  assert.equal(officialCpppDetailUrl("https://www.eprocure.gov.in.example.com/epublish/app", base), base);
  assert.equal(officialCpppDetailUrl("https://eprocure.gov.in/epublish/app?page=detail", base), "https://eprocure.gov.in/epublish/app?page=detail");
  assert.equal(officialCpppDetailUrl("https://www.eprocure.gov.in/epublish/app?page=detail", base), "https://www.eprocure.gov.in/epublish/app?page=detail");
});
