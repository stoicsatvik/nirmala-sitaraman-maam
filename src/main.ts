import "./styles.css";
import { allocations, fiscalYear, ledgerEdges, ledgerNodes, sources } from "./data/seed";
import { mountLiveTracking } from "./live";
import type { AllocationSlice, EvidenceStatus } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

const sourceById = new Map(sources.map((source) => [source.id, source]));
const totalPaise = allocations.reduce((sum, item) => sum + item.paisePerRupee, 0);

if (totalPaise !== 100) {
  throw new Error(`Allocation seed must total 100 paise, got ${totalPaise}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function statusLabel(status: EvidenceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function allocationCard(item: AllocationSlice, contribution: number): string {
  const source = sourceById.get(item.sourceId);
  const attributed = contribution * (item.paisePerRupee / 100);
  const sourceLink = source
    ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Primary source ↗</a>`
    : `<span class="source-link muted">Source missing</span>`;

  return `
    <article class="allocation-card">
      <div class="allocation-topline">
        <span class="paise">${item.paisePerRupee}p</span>
        <span class="status status-${item.evidenceStatus}">${statusLabel(item.evidenceStatus)}</span>
      </div>
      <h3>${escapeHtml(item.label)}</h3>
      <div class="attribution">${formatINR(attributed)}</div>
      <p>${escapeHtml(item.description)}</p>
      <div class="card-footer">
        <span>${escapeHtml(item.moneyState)}</span>
        ${sourceLink}
      </div>
    </article>
  `;
}

function renderAllocations(contribution: number): void {
  const grid = document.querySelector<HTMLDivElement>("#allocation-grid");
  const total = document.querySelector<HTMLElement>("#contribution-total");

  if (!grid || !total) return;

  total.textContent = formatINR(contribution);
  grid.innerHTML = allocations.map((item) => allocationCard(item, contribution)).join("");
}

function renderGraph(): string {
  return ledgerNodes
    .map((node) => {
      const edge = ledgerEdges.find((candidate) => candidate.from === node.id);
      const evidence = edge?.evidenceStatus ?? "observed";
      const connector = edge
        ? `<div class="graph-edge">
            <span>${escapeHtml(edge.relation)}</span>
            <span class="status status-${evidence}">${statusLabel(evidence)}</span>
          </div>`
        : "";

      return `
        <div class="graph-step">
          <div class="graph-node">
            <div class="node-type">${escapeHtml(node.type)}</div>
            <strong>${escapeHtml(node.label)}</strong>
            ${node.note ? `<p>${escapeHtml(node.note)}</p>` : ""}
          </div>
          ${connector}
        </div>
      `;
    })
    .join("");
}

function renderSources(): string {
  return sources
    .map(
      (source) => `
      <tr>
        <td><strong>${escapeHtml(source.title)}</strong><br><span class="muted">${escapeHtml(source.publisher)}</span></td>
        <td>${escapeHtml(source.fiscalYear)}</td>
        <td><span class="status status-${source.evidenceStatus}">${statusLabel(source.evidenceStatus)}</span></td>
        <td>${escapeHtml(source.retrievedAt)}</td>
        <td><a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Open ↗</a></td>
      </tr>`
    )
    .join("");
}

app.innerHTML = `
  <header class="site-header">
    <a href="#top" class="brand">Public Ledger <span>India</span></a>
    <nav>
      <a href="#live-tracking">Live sensors</a>
      <a href="#my-100">My ₹100</a>
      <a href="#money-graph">Money graph</a>
      <a href="#evidence">Evidence</a>
    </nav>
    <span class="live-dot"><i></i> public-source polling</span>
  </header>

  <main id="top">
    <section class="hero">
      <div class="eyebrow">UNION BUDGET · FY ${fiscalYear}</div>
      <h1>Follow public money.<br><span>Not political claims.</span></h1>
      <p class="hero-copy">
        A provenance-first ledger that separates what was budgeted, released, procured, paid, delivered and audited.
        Every number should terminate in evidence or be labelled unknown.
      </p>
      <div class="hero-rule">
        <strong>Non-negotiable:</strong> individual tax rupees are not literally traceable after they enter pooled public funds.
        “My ₹100” is proportional attribution, not a claim that your exact rupee paid for a specific item.
      </div>
    </section>

    <section class="section" id="live-tracking">
      <div class="hero-rule">Loading public-source sensor snapshot…</div>
    </section>

    <section class="section" id="my-100">
      <div class="section-heading">
        <div>
          <div class="eyebrow">CITIZEN VIEW</div>
          <h2>Where would my tax contribution map?</h2>
        </div>
        <div class="tax-input-wrap">
          <label for="tax-paid">Your annual tax contribution</label>
          <div class="tax-input">
            <span>₹</span>
            <input id="tax-paid" inputmode="decimal" type="number" min="0" step="1000" value="100000" />
          </div>
        </div>
      </div>

      <div class="model-banner">
        <div>
          <span>Modelled contribution</span>
          <strong id="contribution-total">₹1,00,000</strong>
        </div>
        <p>Allocation proportions use the Government of India's official 2026–27 “Rupee Goes To” graphic. Source figures are rounded.</p>
      </div>

      <div class="allocation-grid" id="allocation-grid"></div>
    </section>

    <section class="section graph-section" id="money-graph">
      <div class="section-heading">
        <div>
          <div class="eyebrow">SYSTEM MODEL</div>
          <h2>The public-money graph</h2>
        </div>
        <p class="section-note">The graph intentionally breaks when evidence disappears. Missing evidence is data.</p>
      </div>
      <div class="graph-track">${renderGraph()}</div>
    </section>

    <section class="section" id="evidence">
      <div class="section-heading">
        <div>
          <div class="eyebrow">PROVENANCE</div>
          <h2>Evidence ledger</h2>
        </div>
        <p class="section-note">Primary documents first. Interpretation comes later.</p>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>FY</th>
              <th>Status</th>
              <th>Retrieved</th>
              <th>Document</th>
            </tr>
          </thead>
          <tbody>${renderSources()}</tbody>
        </table>
      </div>
    </section>

    <section class="section principles">
      <div>
        <div class="eyebrow">DATA CONTRACT</div>
        <h2>What the system refuses to blur</h2>
      </div>
      <div class="principle-grid">
        <article><strong>Budgeted ≠ spent</strong><p>An announcement is not an expenditure.</p></article>
        <article><strong>Payment ≠ outcome</strong><p>A paid invoice is not proof that citizens received value.</p></article>
        <article><strong>Missing ≠ zero</strong><p>Undisclosed or unreconciled data stays unknown.</p></article>
        <article><strong>Fact ≠ opinion</strong><p>Observed records, calculations, estimates and audit findings keep separate labels.</p></article>
      </div>
    </section>
  </main>

  <footer>
    <strong>Public Ledger India</strong>
    <span>Independent prototype. Not affiliated with the Government of India or any political party.</span>
  </footer>
`;

renderAllocations(100000);
void mountLiveTracking();

const taxInput = document.querySelector<HTMLInputElement>("#tax-paid");

taxInput?.addEventListener("input", () => {
  const value = Number(taxInput.value);
  renderAllocations(Number.isFinite(value) && value >= 0 ? value : 0);
});
