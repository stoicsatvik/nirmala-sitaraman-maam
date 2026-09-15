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

export async function mountLiveTracking(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#live-tracking");
  if (!host) return;

  try {
    const response = await fetch(`/data/live/latest.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
    const snapshot = (await response.json()) as LiveSnapshot;

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
