import { createHash } from "node:crypto";

export type SensorScope = "union" | "state" | "municipal";
export type SensorKind = "budget" | "accounts" | "sanctions" | "payments" | "procurement" | "audit" | "outcome";
export type RecordState =
  | "budgeted"
  | "revised"
  | "sanctioned"
  | "released"
  | "procured"
  | "paid"
  | "delivered"
  | "audited";

export interface SensorDefinition {
  id: string;
  label: string;
  scope: SensorScope;
  kind: SensorKind;
  authority: string;
  sourceUrl: string;
  expectedFreshness: string;
}

export interface PublicMoneyRecord {
  externalKey: string;
  sensorId: string;
  title: string;
  authority: string;
  jurisdiction: string;
  fiscalYear?: string;
  state: RecordState;
  amountInr?: number;
  publishedAt?: string;
  observedAt: string;
  sourceUrl: string;
  sourceDocument?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  geographicPrecision?: "source_coordinate" | "address" | "locality" | "district" | "state" | "unknown";
  vendor?: string;
  tenderReference?: string;
  scheme?: string;
  ministry?: string;
  note?: string;
  raw?: Record<string, unknown>;
  evidenceHash: string;
}

export interface SensorResult {
  sensor: SensorDefinition;
  fetchedAt: string;
  ok: boolean;
  records: PublicMoneyRecord[];
  error?: string;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function recordKey(...parts: Array<string | number | undefined>): string {
  return parts.filter((part) => part !== undefined && part !== "").join(":").replace(/\s+/g, "-").toLowerCase();
}

export function normalizeMoney(text: string): number | undefined {
  const clean = text.replace(/[₹,\s]/g, "").replace(/crores?/i, "").trim();
  const value = Number(clean.match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(value)) return undefined;
  return /crore/i.test(text) ? value * 10_000_000 : value;
}

function publicHeaders(url: string): Record<string, string> {
  const origin = new URL(url).origin;
  return {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/json,text/plain,application/pdf;q=0.9,*/*;q=0.8",
    "accept-language": "en-IN,en;q=0.9,hi;q=0.7",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: `${origin}/`,
    "x-public-ledger-client": "PublicLedgerIndia/0.2"
  };
}

export async function fetchText(url: string): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: publicHeaders(url),
        redirect: "follow",
        signal: AbortSignal.timeout(25_000)
      });

      if (response.ok) return response.text();

      const error = new Error(`${response.status} ${response.statusText} from ${url}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

export function makeObservedRecord(input: Omit<PublicMoneyRecord, "observedAt" | "evidenceHash">): PublicMoneyRecord {
  const observedAt = new Date().toISOString();
  const evidenceHash = sha256(JSON.stringify({ ...input, observedAt: undefined }));
  return { ...input, observedAt, evidenceHash };
}
