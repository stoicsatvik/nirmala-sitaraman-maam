export type EvidenceStatus =
  | "observed"
  | "calculated"
  | "estimated"
  | "audited"
  | "unknown";

export type MoneyState =
  | "budgeted"
  | "revised"
  | "sanctioned"
  | "released"
  | "procured"
  | "paid"
  | "delivered"
  | "audited";

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  fiscalYear: string;
  retrievedAt: string;
  evidenceStatus: EvidenceStatus;
}

export interface AllocationSlice {
  id: string;
  label: string;
  paisePerRupee: number;
  description: string;
  sourceId: string;
  evidenceStatus: EvidenceStatus;
  moneyState: MoneyState;
}

export interface LedgerEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  state: MoneyState;
  sourceId: string;
  evidenceStatus: EvidenceStatus;
}

export interface LedgerNode {
  id: string;
  label: string;
  type:
    | "revenue"
    | "fund"
    | "allocation"
    | "ministry"
    | "scheme"
    | "procurement"
    | "vendor"
    | "project"
    | "outcome";
  note?: string;
}
