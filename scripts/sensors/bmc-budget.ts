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

function makeBmcRecord(input: {
  sensor: SensorDefinition;
  glCode: string;
  costCenter: string;
  workName: string;
  executingAccount?: string;
  proposedThousands?: number;
  approvedThousands?: number;
  page?: number;
  sourceRow: unknown;
}) {
  const provisionThousands = input.approvedThousands ?? input.proposedThousands;
  if (provisionThousands === undefined || !Number.isFinite(provisionThousands) || provisionThousands < 0) return undefined;

  const ward = wardMetadata(input.workName);

  return makeObservedRecord({
    externalKey: recordKey(input.sensor.id, input.glCode, input.costCenter, input.workName.slice(0, 120)),
    sensorId: input.sensor.id,
    title: input.workName,
    authority: input.sensor.authority,
    jurisdiction: "Mumbai",
    fiscalYear: "2026-27",
    state: "budgeted",
    amountInr: provisionThousands * 1_000,
    sourceUrl: BMC_STANDING_2026_27,
    sourceDocument: BMC_STANDING_2026_27,
    locationText: ward.location,
    geographicPrecision: ward.location ? "locality" : "unknown",
    scheme: "BMC Standing Committee Budget Estimate 2026-27",
    ministry: input.executingAccount ?? "Brihanmumbai Municipal Corporation",
    note: `Standing Committee approved/provisioned amount used: ₹${provisionThousands.toLocaleString("en-IN")} thousand${input.proposedThousands !== undefined ? `; Municipal Commissioner proposed ₹${input.proposedThousands.toLocaleString("en-IN")} thousand` : ""}. This is a budget provision, not proof of payment or completion.`,
    raw: {
      page: input.page,
      glCode: input.glCode,
      costCenter: input.costCenter,
      executingAccount: input.executingAccount,
      proposedThousands: input.proposedThousands,
      approvedThousands: input.approvedThousands,
      wardNumber: ward.wardNumber,
      wardName: ward.wardName,
      sourceRow: input.sourceRow
    }
  });
}

function extractTextRows(text: string, sensor: SensorDefinition): ReturnType<typeof makeObservedRecord>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);

  const records: ReturnType<typeof makeObservedRecord>[] = [];

  for (let index = 0; index < lines.length - 5; index += 1) {
    const glCode = lines[index];
    const costCenter = lines[index + 1];
    if (!/^\d{9}$/.test(glCode) || !/^\d{8,12}$/.test(costCenter)) continue;

    const nextRowOffset = lines
      .slice(index + 2, index + 40)
      .findIndex((line, offset, subset) => /^\d{9}$/.test(line) && /^\d{8,12}$/.test(subset[offset + 1] ?? ""));
    const end = nextRowOffset >= 0 ? index + 2 + nextRowOffset : Math.min(lines.length, index + 40);
    const chunk = lines.slice(index + 2, end);

    const amountIndexes = chunk
      .map((line, chunkIndex) => ({ chunkIndex, value: numeric(line) }))
      .filter((item) => item.value !== undefined && item.value! >= 0 && item.value! < 10_000_000)
      .slice(0, 2);

    if (amountIndexes.length < 1) continue;

    const firstAmountIndex = amountIndexes[0].chunkIndex;
    const nameAndAccount = chunk.slice(0, firstAmountIndex).filter((line) => !/^Page\s+\d+/i.test(line));
    if (nameAndAccount.length === 0) continue;

    let executingAccount: string | undefined;
    if (nameAndAccount.length > 1) {
      const candidate = nameAndAccount[nameAndAccount.length - 1];
      if (candidate.length <= 80 && !/Ward\s*(?:No\.?|Number)?\s*\d+/i.test(candidate)) {
        executingAccount = candidate;
        nameAndAccount.pop();
      }
    }

    const workName = clean(nameAndAccount.join(" "));
    if (workName.length < 18 || /^Name of Work$/i.test(workName)) continue;

    const proposedThousands = amountIndexes[0]?.value;
    const approvedThousands = amountIndexes[1]?.value ?? proposedThousands;
    const record = makeBmcRecord({
      sensor,
      glCode,
      costCenter,
      workName,
      executingAccount,
      proposedThousands,
      approvedThousands,
      sourceRow: [glCode, costCenter, ...chunk]
    });
    if (record) records.push(record);
  }

  return records;
}

export async function runBmcBudgetSensor(sensor: SensorDefinition): Promise<SensorResult> {
  const fetchedAt = new Date().toISOString();
  let parser: PDFParse | undefined;

  try {
    parser = new PDFParse({ url: new URL(BMC_STANDING_2026_27) });
    const records: ReturnType<typeof makeObservedRecord>[] = [];

    const tableResult = await parser.getTable();
    for (const page of tableResult.pages) {
      for (const table of page.tables) {
        for (const rawRow of table) {
          const row = rawRow.map(clean);
          if (!looksLikeWorkRow(row)) continue;

          const record = makeBmcRecord({
            sensor,
            glCode: row[0],
            costCenter: row[1],
            workName: row[2],
            executingAccount: row[3] || undefined,
            proposedThousands: numeric(row[4] ?? ""),
            approvedThousands: numeric(row[5] ?? ""),
            page: page.num,
            sourceRow: row
          });
          if (record) records.push(record);
        }
      }
    }

    const textResult = await parser.getText();
    records.push(...extractTextRows(textResult.text, sensor));

    const deduped = [...new Map(records.map((record) => [record.externalKey, record])).values()];

    return {
      sensor,
      fetchedAt,
      ok: true,
      records: deduped.slice(0, 5_000),
      error:
        deduped.length === 0
          ? "Official BMC FY 2026-27 Standing Committee PDF was reachable, but neither table nor strict text parsing produced a work row. No rows were guessed."
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
