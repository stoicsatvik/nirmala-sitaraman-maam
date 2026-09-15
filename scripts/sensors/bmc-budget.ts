import { PDFParse } from "pdf-parse";
import {
  makeObservedRecord,
  recordKey,
  type SensorDefinition,
  type SensorResult
} from "../lib/ingestion";

const BMC_STANDING_2026_27 =
  "https://portal.mcgm.gov.in/irj/go/km/docs/documents/MCGM%20Department%20List/Chief%20Accountant%20%28Finance%29/Budget/Budget%20Estimate%202026-2027/STANDING%20COMMITTEE%202026-2027.pdf";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numeric(value: string): number | undefined {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function wardMetadata(name: string): { wardNumber?: string; wardName?: string; location?: string } {
  const wardNumber = name.match(/Ward\s*(?:No\.?|Number)?\s*([0-9]{1,3})/i)?.[1];
  const wardName =
    name.match(/\bin\s+([A-Z](?:\s*\/\s*(?:North|South|East|West))?)\s+Ward\b/i)?.[1]?.replace(/\s+/g, " ") ??
    name.match(/\b([A-Z](?:\s*\/\s*(?:North|South|East|West))?)\s+Ward\b/i)?.[1]?.replace(/\s+/g, " ");

  const pieces = [
    wardNumber ? `Ward No. ${wardNumber}` : undefined,
    wardName ? `${wardName} Ward` : undefined,
    "Mumbai",
    "Maharashtra"
  ].filter(Boolean);

  return {
    wardNumber,
    wardName,
    location: pieces.length > 2 ? pieces.join(", ") : undefined
  };
}

function looksLikeWorkRow(row: string[]): boolean {
  return /^\d{9}$/.test(row[0] ?? "") && /^\d{8,12}$/.test(row[1] ?? "") && (row[2]?.length ?? 0) > 15;
}

export async function runBmcBudgetSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  let parser: PDFParse | undefined;

  try {
    parser = new PDFParse({ url: new URL(BMC_STANDING_2026_27) });
    const tableResult = await parser.getTable();
    const records: ReturnType<typeof makeObservedRecord>[] = [];

    for (const page of tableResult.pages) {
      for (const table of page.tables) {
        for (const rawRow of table) {
          const row = rawRow.map(clean);
          if (!looksLikeWorkRow(row)) continue;

          const glCode = row[0];
          const costCenter = row[1];
          const workName = row[2];
          const executingAccount = row[3] || undefined;
          const proposedThousands = numeric(row[4] ?? "");
          const approvedThousands = numeric(row[5] ?? "");

          if (approvedThousands === undefined && proposedThousands === undefined) continue;

          const provisionThousands = approvedThousands ?? proposedThousands!;
          const ward = wardMetadata(workName);

          records.push(
            makeObservedRecord({
              externalKey: recordKey(sensor.id, glCode, costCenter, workName.slice(0, 120)),
              sensorId: sensor.id,
              title: workName,
              authority: sensor.authority,
              jurisdiction: "Mumbai",
              fiscalYear: "2026-27",
              state: "budgeted",
              amountInr: provisionThousands * 1_000,
              sourceUrl: BMC_STANDING_2026_27,
              sourceDocument: BMC_STANDING_2026_27,
              locationText: ward.location,
              geographicPrecision: ward.location ? "locality" : "unknown",
              scheme: "BMC Standing Committee Budget Estimate 2026-27",
              ministry: executingAccount ?? "Brihanmumbai Municipal Corporation",
              note: `Standing Committee approved provision: ₹${provisionThousands.toLocaleString("en-IN")} thousand${proposedThousands !== undefined ? `; Municipal Commissioner proposed ₹${proposedThousands.toLocaleString("en-IN")} thousand` : ""}. This is a budget provision, not proof of payment or completion.`,
              raw: {
                page: page.num,
                glCode,
                costCenter,
                executingAccount,
                proposedThousands,
                approvedThousands,
                wardNumber: ward.wardNumber,
                wardName: ward.wardName,
                sourceRow: row
              }
            })
          );
        }
      }
    }

    const deduped = [...new Map(records.map((record) => [record.externalKey, record])).values()];

    return {
      sensor,
      fetchedAt,
      ok: true,
      records: deduped.slice(0, 5_000),
      error:
        deduped.length === 0
          ? "Official BMC FY 2026-27 Standing Committee PDF was reachable, but no strict GL-code/cost-centre work rows were extracted. No rows were guessed."
          : undefined
    };
  } catch (error) {
    return {
      sensor,
      fetchedAt,
      ok: false,
      records: [],
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
