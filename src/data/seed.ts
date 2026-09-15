import type { AllocationSlice, LedgerEdge, LedgerNode, SourceRecord } from "../types";

export const fiscalYear = "2026–27";

export const sources: SourceRecord[] = [
  {
    id: "budget-glance-2026",
    title: "Budget at a Glance 2026–2027",
    publisher: "Ministry of Finance, Government of India",
    url: "https://www.indiabudget.gov.in/doc/Budget_at_Glance/budget_at_a_glance.pdf",
    fiscalYear,
    retrievedAt: "2026-09-16",
    evidenceStatus: "observed"
  },
  {
    id: "expenditure-profile-2026",
    title: "Expenditure Profile 2026–2027",
    publisher: "Ministry of Finance, Government of India",
    url: "https://www.indiabudget.gov.in/doc/eb/vol1.pdf",
    fiscalYear,
    retrievedAt: "2026-09-16",
    evidenceStatus: "observed"
  },
  {
    id: "receipt-budget-2026",
    title: "Receipt Budget 2026–2027",
    publisher: "Ministry of Finance, Government of India",
    url: "https://www.indiabudget.gov.in/doc/rec/allrec.pdf",
    fiscalYear,
    retrievedAt: "2026-09-16",
    evidenceStatus: "observed"
  }
];

// Official "Rupee Goes To" percentages from Budget at a Glance 2026–27.
// Figures are rounded by the source and therefore represent broad allocation attribution,
// not literal tracing of an individual's tax payment.
export const allocations: AllocationSlice[] = [
  {
    id: "states-share",
    label: "States' share of taxes",
    paisePerRupee: 22,
    description: "States' share of Union taxes and duties.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "finance-commission",
    label: "Finance Commission & other transfers",
    paisePerRupee: 7,
    description: "Finance Commission grants and other transfers.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "css",
    label: "Centrally Sponsored Schemes",
    paisePerRupee: 8,
    description: "Schemes implemented with states under centrally sponsored structures.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "interest",
    label: "Interest payments",
    paisePerRupee: 20,
    description: "Interest paid on government liabilities.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "defence",
    label: "Defence",
    paisePerRupee: 11,
    description: "Broad defence allocation in the official Rupee Goes To graphic.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "subsidies",
    label: "Major subsidies",
    paisePerRupee: 6,
    description: "Major subsidy expenditure.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "central-sector",
    label: "Central Sector Schemes",
    paisePerRupee: 17,
    description: "Central Sector Schemes, excluding capital outlay on defence and major subsidies as noted by the source.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "pension",
    label: "Civil pension",
    paisePerRupee: 2,
    description: "Civil pension expenditure.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  },
  {
    id: "other",
    label: "Other expenditure",
    paisePerRupee: 7,
    description: "Other expenditure grouped by the official Budget at a Glance graphic.",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed",
    moneyState: "budgeted"
  }
];

export const ledgerNodes: LedgerNode[] = [
  {
    id: "revenue",
    label: "Government revenue & financing",
    type: "revenue",
    note: "Taxes, non-tax revenue, capital receipts and borrowing are distinct sources."
  },
  {
    id: "consolidated-fund",
    label: "Consolidated Fund of India",
    type: "fund",
    note: "The product must not claim that an individual's exact rupee remains individually identifiable after entering pooled public funds."
  },
  {
    id: "appropriation",
    label: "Budget / appropriation",
    type: "allocation",
    note: "Budgeted amounts are not the same thing as actual expenditure."
  },
  {
    id: "ministry",
    label: "Ministry / department",
    type: "ministry"
  },
  {
    id: "scheme",
    label: "Scheme / programme",
    type: "scheme"
  },
  {
    id: "procurement",
    label: "Tender / procurement",
    type: "procurement"
  },
  {
    id: "vendor",
    label: "Vendor / payee",
    type: "vendor"
  },
  {
    id: "project",
    label: "Project / service",
    type: "project"
  },
  {
    id: "outcome",
    label: "Measured outcome / audit",
    type: "outcome"
  }
];

export const ledgerEdges: LedgerEdge[] = [
  {
    id: "e1",
    from: "revenue",
    to: "consolidated-fund",
    relation: "pooled into public accounts",
    state: "budgeted",
    sourceId: "receipt-budget-2026",
    evidenceStatus: "observed"
  },
  {
    id: "e2",
    from: "consolidated-fund",
    to: "appropriation",
    relation: "authorized through budget / appropriation",
    state: "budgeted",
    sourceId: "budget-glance-2026",
    evidenceStatus: "observed"
  },
  {
    id: "e3",
    from: "appropriation",
    to: "ministry",
    relation: "allocated to demand / department",
    state: "budgeted",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "observed"
  },
  {
    id: "e4",
    from: "ministry",
    to: "scheme",
    relation: "assigned to programme",
    state: "budgeted",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "observed"
  },
  {
    id: "e5",
    from: "scheme",
    to: "procurement",
    relation: "procurement evidence required",
    state: "procured",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "unknown"
  },
  {
    id: "e6",
    from: "procurement",
    to: "vendor",
    relation: "award / payment evidence required",
    state: "paid",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "unknown"
  },
  {
    id: "e7",
    from: "vendor",
    to: "project",
    relation: "delivery evidence required",
    state: "delivered",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "unknown"
  },
  {
    id: "e8",
    from: "project",
    to: "outcome",
    relation: "outcome / audit evidence required",
    state: "audited",
    sourceId: "expenditure-profile-2026",
    evidenceStatus: "unknown"
  }
];
