import * as cheerio from "cheerio";
import {
  fetchText,
  makeObservedRecord,
  recordKey,
  type SensorDefinition,
  type SensorResult
} from "../lib/ingestion";

const sensors: SensorDefinition[] = [
  {
    id: "cga-monthly-accounts",
    label: "Union Government monthly accounts",
    scope: "union",
    kind: "accounts",
    authority: "Controller General of Accounts",
    sourceUrl: "https://cga.gov.in/Page/Monthly-Accounts-Review.aspx",
    expectedFreshness: "monthly, polled hourly"
  },
  {
    id: "pfms-sanctions-releases",
    label: "PFMS sanctions and releases",
    scope: "union",
    kind: "sanctions",
    authority: "Public Financial Management System",
    sourceUrl: "https://pfms.nic.in/",
    expectedFreshness: "source dependent, availability checked hourly"
  },
  {
    id: "cppp-procurement",
    label: "Central Public Procurement Portal",
    scope: "union",
    kind: "procurement",
    authority: "Government of India eProcurement System",
    sourceUrl: "https://eprocure.gov.in/epublish/app",
    expectedFreshness: "continuous publication, polled hourly"
  },
  {
    id: "gem-bids",
    label: "Government e-Marketplace bids",
    scope: "union",
    kind: "procurement",
    authority: "Government e Marketplace",
    sourceUrl: "https://bidplus-global.gem.gov.in/",
    expectedFreshness: "near-publication, polled hourly"
  },
  {
    id: "cag-audits",
    label: "CAG audit reports",
    scope: "union",
    kind: "audit",
    authority: "Comptroller and Auditor General of India",
    sourceUrl: "https://cag.gov.in/en/audit-report",
    expectedFreshness: "publication driven, polled hourly"
  },
  {
    id: "maharashtra-program-budget",
    label: "Maharashtra programme budget",
    scope: "state",
    kind: "budget",
    authority: "Finance Department, Government of Maharashtra",
    sourceUrl: "https://finance.maharashtra.gov.in/en/document-category/program-budget-2026-27-part-1/",
    expectedFreshness: "publication driven, polled hourly"
  },
  {
    id: "bmc-budget",
    label: "BMC budget publications",
    scope: "municipal",
    kind: "budget",
    authority: "Brihanmumbai Municipal Corporation",
    sourceUrl: "https://www.mcgm.gov.in/irj/portal/anonymous?NavigationTarget=navurl%3A%2F%2Ff3befed572b418f7e1e2a087db58f448",
    expectedFreshness: "publication driven, polled hourly"
  },
  {
    id: "bmc-tenders",
    label: "BMC tenders",
    scope: "municipal",
    kind: "procurement",
    authority: "Brihanmumbai Municipal Corporation",
    sourceUrl: "https://portal.mcgm.gov.in/irj/portal/anonymous/qltendersswm_new",
    expectedFreshness: "publication driven, polled hourly"
  }
];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function jurisdictionFor(sensor: SensorDefinition): string {
  if (sensor.scope === "union") return "India";
  if (sensor.scope === "state") return "Maharashtra";
  return "Mumbai";
}

async function genericPublicationSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const title = clean($("title").first().text()) || sensor.label;
    const text = clean($("body").text()).slice(0, 4000);
    const state = sensor.kind === "audit" ? "audited" : "budgeted";
    const records = [
      makeObservedRecord({
        externalKey: recordKey(sensor.id, title),
        sensorId: sensor.id,
        title,
        authority: sensor.authority,
        jurisdiction: jurisdictionFor(sensor),
        fiscalYear: "2026-27",
        state,
        sourceUrl: sensor.sourceUrl,
        geographicPrecision: sensor.scope === "state" ? "state" : "unknown",
        note: "Publication endpoint observed. Structured extraction is conservative; source changes remain hash-verifiable.",
        raw: { excerpt: text }
      })
    ];
    return { sensor, fetchedAt, ok: true, records };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function pfmsAvailabilitySensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const title = clean($("title").first().text()) || sensor.label;
    return {
      sensor,
      fetchedAt,
      ok: true,
      records: [],
      error: `PFMS reachable (${title}), but this collector does not invent sanction/payment rows without a stable public machine-readable report endpoint.`
    };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function tableProcurementSensor(sensor: SensorDefinition, jurisdiction: string): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const records = $("table tr")
      .toArray()
      .map((row) => {
        const cells = $(row).find("td").toArray().map((cell) => clean($(cell).text()));
        if (cells.length < 2) return null;
        const title = cells[0] || cells[1];
        const reference = cells.find((cell) => /(?:GEM\/|20\d{2}_|tender|bid)/i.test(cell)) || cells[1] || undefined;
        if (!title || /tender title|reference no/i.test(title)) return null;
        const link = $(row).find("a[href]").first().attr("href");
        const sourceUrl = link ? new URL(link, sensor.sourceUrl).toString() : sensor.sourceUrl;
        const ward = title.match(/\b([A-Z]\/?(?:East|West|North|South)?|[A-Z])\s*ward\b/i)?.[0];
        return makeObservedRecord({
          externalKey: recordKey(sensor.id, reference, title),
          sensorId: sensor.id,
          title: title.slice(0, 500),
          authority: sensor.authority,
          jurisdiction,
          fiscalYear: "2026-27",
          state: "procured",
          sourceUrl,
          tenderReference: reference,
          locationText: ward ? `${ward}, Mumbai, Maharashtra` : undefined,
          geographicPrecision: ward ? "locality" : "unknown",
          note: cells.slice(2).join(" | ") || undefined,
          raw: { cells }
        });
      })
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .slice(0, 150);

    return { sensor, fetchedAt, ok: true, records };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function linkProcurementSensor(sensor: SensorDefinition, jurisdiction: string): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const records: ReturnType<typeof makeObservedRecord>[] = [];
    $("a[href]").each((_, element) => {
      const label = clean($(element).text());
      if (label.length < 12 || !/(tender|bid|GEM\/20\d{4}\/B\/|20\d{4}_MCGM_)/i.test(label)) return;
      const href = $(element).attr("href");
      if (!href) return;
      const reference = label.match(/(?:GEM\/20\d{4}\/B\/\d+|20\d{4}_MCGM_\d+(?:_\d+)?)/i)?.[0];
      const ward = label.match(/\b[A-Z]\/\w+\s+ward\b/i)?.[0] ?? label.match(/\b[A-Z]\s+ward\b/i)?.[0];
      records.push(
        makeObservedRecord({
          externalKey: recordKey(sensor.id, reference, label.slice(0, 160)),
          sensorId: sensor.id,
          title: label.slice(0, 500),
          authority: sensor.authority,
          jurisdiction,
          fiscalYear: "2026-27",
          state: "procured",
          sourceUrl: new URL(href, sensor.sourceUrl).toString(),
          tenderReference: reference,
          locationText: ward ? `${ward}, Mumbai, Maharashtra` : undefined,
          geographicPrecision: ward ? "locality" : "unknown"
        })
      );
    });
    const deduped = [...new Map(records.map((record) => [record.externalKey, record])).values()].slice(0, 150);
    return { sensor, fetchedAt, ok: true, records: deduped };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function cagSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const html = await fetchText(sensor.sourceUrl);
    const $ = cheerio.load(html);
    const records: ReturnType<typeof makeObservedRecord>[] = [];

    $("a[href]").each((_, element) => {
      const label = clean($(element).text());
      if (!label || label.length < 20 || !/report|audit|finance|compliance|performance/i.test(label)) return;
      const href = $(element).attr("href");
      if (!href) return;
      const sourceUrl = new URL(href, sensor.sourceUrl).toString();
      records.push(
        makeObservedRecord({
          externalKey: recordKey(sensor.id, label.slice(0, 120)),
          sensorId: sensor.id,
          title: label.slice(0, 300),
          authority: sensor.authority,
          jurisdiction: /maharashtra/i.test(label) ? "Maharashtra" : "India",
          state: "audited",
          sourceUrl,
          geographicPrecision: /maharashtra/i.test(label) ? "state" : "unknown",
          note: "CAG publication discovered from the official audit-report index."
        })
      );
    });

    const deduped = [...new Map(records.map((record) => [record.externalKey, record])).values()].slice(0, 100);
    return { sensor, fetchedAt, ok: true, records: deduped };
  } catch (error) {
    return { sensor, fetchedAt, ok: false, records: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function runAllSensors(): Promise<SensorResult[]> {
  return Promise.all(
    sensors.map((sensor) => {
      if (sensor.id === "pfms-sanctions-releases") return pfmsAvailabilitySensor(sensor);
      if (sensor.id === "cppp-procurement") return tableProcurementSensor(sensor, "India");
      if (sensor.id === "gem-bids") return linkProcurementSensor(sensor, "India");
      if (sensor.id === "bmc-tenders") return linkProcurementSensor(sensor, "Mumbai");
      if (sensor.id === "cag-audits") return cagSensor(sensor);
      return genericPublicationSensor(sensor);
    })
  );
}

export { sensors };
