import "./live.css";

type LiveSensor = {
  id: string;
  label: string;
  authority: string;
  scope: string;
  kind: string;
  sourceUrl: string;
  expectedFreshness: string;
  fetchedAt: string;
  ok: boolean;
  recordCount: number;
  error: string | null;
};

type LiveRecord = {
  externalKey: string;
  sensorId: string;
  title: string;
  authority: string;
  jurisdiction: string;
  fiscalYear?: string;
  state: string;
  amountInr?: number;
  observedAt: string;
  sourceUrl: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  vendor?: string;
  tenderReference?: string;
};

type LiveSnapshot = {
  generatedAt: string | null;
  semantics: Record<string, string>;
  summary: { sensors: number; healthySensors: number; records: number };
  sensors: LiveSensor[];
  records: LiveRecord[];
};

type CoverageStatus = "live" | "partial" | "model" | "blocked";

type CoverageRow = {
  layer: string;
  status: CoverageStatus;
  detail: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyTime(value: string | null): string {
  if (!value) return "not polled yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: value >= 1_000_000_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000_000_000 ? 2 : 0
  }).format(value);
}

function coverageStatusClass(status: CoverageStatus): string {
  if (status === "live") return "status-observed";
  if (status === "model") return "status-calculated";
  if (status === "partial") return "status-estimated";
  return "status-unknown";
}

function buildCoverage(snapshot: LiveSnapshot): CoverageRow[] {
  const sensorById = new Map(snapshot.sensors.map((sensor) => [sensor.id, sensor]));
  const cga = sensorById.get("cga-monthly-accounts");
  const pfms = sensorById.get("pfms-sanctions-releases");
  const awardSensor = sensorById.get("cppp-contract-awards");
  const cag = sensorById.get("cag-audits");
  const outcome = sensorById.get("union-output-outcomes");
  const maharashtra = sensorById.get("maharashtra-program-budget");
  const bmcBudget = sensorById.get("bmc-budget");
  const bmcTenders = sensorById.get("bmc-tenders");
  const tenderSensorIds = new Set(["cppp-procurement", "gem-bids", "bmc-tenders"]);

  const tenderRecords = snapshot.records.filter((record) => tenderSensorIds.has(record.sensorId));
  const awardRecords = snapshot.records.filter((record) => record.sensorId === "cppp-contract-awards");
  const vendorRecords = snapshot.records.filter((record) => Boolean(record.vendor));
  const paymentRecords = snapshot.records.filter((record) => record.state === "paid");
  const locationRecords = snapshot.records.filter((record) => Boolean(record.locationText));
  const pinpointRecords = snapshot.records.filter(
    (record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
  );

  return [
    {
      layer: "Union Budget allocation",
      status: "live",
      detail: "FY 2026–27 budget allocation model is loaded with primary-source provenance."
    },
    {
      layer: "Citizen ‘my tax’ attribution",
      status: "model",
      detail: "Working proportional attribution. It deliberately does not claim literal tracing of an individual tax rupee."
    },
    {
      layer: "Budget → ministry → scheme graph",
      status: "model",
      detail: "Graph/state architecture exists; real edges replace modelled edges only when evidence supports them."
    },
    {
      layer: "Sanctions / releases",
      status: pfms && pfms.recordCount > 0 ? "live" : "blocked",
      detail: pfms?.recordCount
        ? `${pfms.recordCount} public PFMS observations.`
        : `PFMS public extraction currently exposes no stable machine-readable sanction stream${pfms?.error ? ` (${pfms.error})` : ""}.`
    },
    {
      layer: "CGA actual expenditure",
      status: cga && cga.recordCount > 0 ? "live" : "blocked",
      detail: cga?.recordCount
        ? `${cga.recordCount} provisional monthly actual-expenditure aggregates ingested from CGA.`
        : "No verified CGA actual-expenditure rows in the latest poll."
    },
    {
      layer: "Tenders",
      status: tenderRecords.length > 0 ? "live" : "partial",
      detail: tenderRecords.length
        ? `${tenderRecords.length} current tender observations across public procurement sensors.`
        : "CPPP/GeM/BMC tender surfaces are monitored, but the latest poll yielded no structured tender rows."
    },
    {
      layer: "Contract awards",
      status: awardRecords.length > 0 ? "live" : "blocked",
      detail: awardRecords.length
        ? `${awardRecords.length} award records ingested.`
        : `CPPP award search is monitored but remains search/captcha gated${awardSensor?.error ? ` (${awardSensor.error})` : ""}.`
    },
    {
      layer: "Vendor / payee",
      status: vendorRecords.length > 0 ? "live" : "partial",
      detail: vendorRecords.length
        ? `${vendorRecords.length} records currently identify a vendor/payee from primary evidence.`
        : "Schema and UI support vendors/payees; no vendor is inferred when the public record does not expose one."
    },
    {
      layer: "Government payments",
      status: paymentRecords.length > 0 ? "partial" : "blocked",
      detail: paymentRecords.length
        ? `${paymentRecords.length} aggregate CGA actual-spend records are live. Transaction-level treasury/bank payments are not publicly streamed.`
        : "No verified payment/expenditure record in the current snapshot."
    },
    {
      layer: "Project / location",
      status: locationRecords.length > 0 ? "partial" : "blocked",
      detail: locationRecords.length
        ? `${locationRecords.length} records carry source-backed locality text.`
        : "Location fields exist, but the current snapshot has no project-locality records."
    },
    {
      layer: "CAG findings",
      status: cag && cag.recordCount > 0 ? "partial" : "blocked",
      detail: cag?.recordCount
        ? `${cag.recordCount} verified CAG report-detail records discovered; finding/paragraph-level extraction is still separate.`
        : "No verified CAG report-detail records in the latest poll."
    },
    {
      layer: "Outcomes",
      status: outcome && outcome.recordCount > 0 ? "partial" : "blocked",
      detail: outcome?.recordCount
        ? "Official Output Outcome Monitoring Framework is tracked as target evidence, not as achieved-outcome proof."
        : `Outcome framework is monitored${outcome?.error ? ` (${outcome.error})` : ""}; achieved outcomes still require separate evidence.`
    },
    {
      layer: "Maharashtra",
      status: maharashtra && maharashtra.recordCount > 0 ? "partial" : "blocked",
      detail: maharashtra?.recordCount
        ? "FY 2026–27 Maharashtra Finance publication is under live source monitoring; detailed line-item normalization is still partial."
        : "Maharashtra source did not yield a verified observation in the latest poll."
    },
    {
      layer: "Mumbai / BMC / ward",
      status: (bmcBudget?.recordCount ?? 0) + (bmcTenders?.recordCount ?? 0) > 0 ? "partial" : "blocked",
      detail: `BMC budget and tender surfaces are monitored. Budget observations: ${bmcBudget?.recordCount ?? 0}; tender observations: ${bmcTenders?.recordCount ?? 0}.`
    },
    {
      layer: "Live polling",
      status: snapshot.generatedAt ? "live" : "blocked",
      detail: snapshot.generatedAt
        ? `GitHub Actions polls the sensor network hourly. Latest completed snapshot: ${prettyTime(snapshot.generatedAt)}.`
        : "No completed live poll yet."
    },
    {
      layer: "Geographic pinpointing",
      status: pinpointRecords.length > 0 ? "live" : "blocked",
      detail: pinpointRecords.length
        ? `${pinpointRecords.length} records have evidence-backed coordinates.`
        : "0 verified coordinate pins. The system refuses to invent coordinates from broad district/state labels."
    }
  ];
}

export async function mountLiveTracking(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#live-tracking");
  if (!host) return;

  try {
    const response = await fetch(`/data/live/latest.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
    const snapshot = (await response.json()) as LiveSnapshot;
    const coverage = buildCoverage(snapshot);

    const coverageRows = coverage
      .map(
        (row) => `
          <tr>
            <td><strong>${escapeHtml(row.layer)}</strong></td>
            <td><span class="status ${coverageStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.detail)}</td>
          </tr>`
      )
      .join("");

    const sensorRows = snapshot.sensors
      .map(
        (sensor) => `
          <tr>
            <td><strong>${escapeHtml(sensor.label)}</strong><br><span class="muted">${escapeHtml(sensor.authority)}</span></td>
            <td>${escapeHtml(sensor.scope)} / ${escapeHtml(sensor.kind)}</td>
            <td><span class="status ${sensor.ok ? "status-observed" : "status-unknown"}">${sensor.ok ? "polling" : "error"}</span></td>
            <td>${sensor.recordCount}</td>
            <td>${escapeHtml(prettyTime(sensor.fetchedAt))}</td>
            <td><a class="source-link" href="${escapeHtml(sensor.sourceUrl)}" target="_blank" rel="noreferrer">Source ↗</a></td>
          </tr>`
      )
      .join("");

    const recentRecords = snapshot.records
      .slice(0, 20)
      .map(
        (record) => `
          <article class="live-record">
            <div class="allocation-topline">
              <span class="status status-observed">${escapeHtml(record.state)}</span>
              <span class="muted">${escapeHtml(record.jurisdiction)}</span>
            </div>
            <h3>${escapeHtml(record.title)}</h3>
            ${typeof record.amountInr === "number" ? `<div class="attribution">${formatINR(record.amountInr)}</div>` : ""}
            ${record.tenderReference ? `<p><strong>Ref:</strong> ${escapeHtml(record.tenderReference)}</p>` : ""}
            ${record.vendor ? `<p><strong>Vendor:</strong> ${escapeHtml(record.vendor)}</p>` : ""}
            ${record.locationText ? `<p><strong>Location:</strong> ${escapeHtml(record.locationText)}</p>` : ""}
            <div class="card-footer">
              <span>${escapeHtml(prettyTime(record.observedAt))}</span>
              <a class="source-link" href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noreferrer">Evidence ↗</a>
            </div>
          </article>`
      )
      .join("");

    host.innerHTML = `
      <div class="section-heading">
        <div>
          <div class="eyebrow">PUBLIC-SOURCE SENSOR NETWORK</div>
          <h2>Tracking status</h2>
        </div>
        <p class="section-note">Last poll: ${escapeHtml(prettyTime(snapshot.generatedAt))}</p>
      </div>
      <div class="model-banner">
        <div><span>Healthy sensors</span><strong>${snapshot.summary.healthySensors}/${snapshot.summary.sensors}</strong></div>
        <div><span>Current observations</span><strong>${snapshot.summary.records}</strong></div>
        <p>${escapeHtml(snapshot.semantics.live ?? "")}</p>
      </div>

      <div class="section-heading live-subheading">
        <div><div class="eyebrow">COVERAGE MATRIX</div><h3>What is actually tracked</h3></div>
        <p class="section-note">Status is computed from the latest snapshot, not hard-coded green ticks.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tracking layer</th><th>Status</th><th>Current evidence</th></tr></thead>
          <tbody>${coverageRows}</tbody>
        </table>
      </div>

      <div class="section-heading live-subheading">
        <div><div class="eyebrow">SOURCE HEALTH</div><h3>Collectors</h3></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sensor</th><th>Scope</th><th>Status</th><th>Records</th><th>Polled</th><th>Evidence</th></tr></thead>
          <tbody>${sensorRows || `<tr><td colspan="6" class="muted">Waiting for the first ingestion run.</td></tr>`}</tbody>
        </table>
      </div>
      ${recentRecords ? `<div class="live-record-grid">${recentRecords}</div>` : ""}
      <div class="hero-rule"><strong>Accuracy rule:</strong> location text is not converted into a map pin unless the source provides coordinates or a separately auditable geocoding step establishes them.</div>
    `;
  } catch (error) {
    host.innerHTML = `<div class="hero-rule"><strong>Live snapshot unavailable:</strong> ${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
  }
}
