'use strict';

function renderReportsView(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div><h2>Reports</h2></div>
      <div></div>
    </div>
    <div class="grid cols-3">
      <label>From<input type="date" id="r-from"></label>
      <label>To<input type="date" id="r-to"></label>
      <div>
        <button id="r-run" class="btn primary">Run</button>
      </div>
    </div>

    <div id="reports-output"></div>
  `;
}

async function runReports() {
  // Example counts by branch and recent registrations
  const out = document.getElementById('reports-output');
  out.innerHTML = 'Loading...';
  const [{ data: clientsData, error }, { data: branches }] = await Promise.all([
    listClients({ limit: 1000, offset: 0 }),
    listBranches(),
  ]);
  if (error) { out.textContent = error.message; return; }
  const byId = Object.fromEntries((branches||[]).map(b => [b.id, `${b.name} (${b.code})`]));
  const byBranch = {};
  (clientsData||[]).forEach(c => { const key = byId[c.branch_id] || 'N/A'; byBranch[key] = (byBranch[key]||0) + 1; });
  out.innerHTML = `
    <h3>Client counts by branch (visible scope)</h3>
    <ul>${Object.entries(byBranch).map(([label, n]) => `<li>${label}: ${n}</li>`).join('')}</ul>
    <h3>Recent registrations</h3>
    <ul>${(clientsData||[]).slice(0, 10).map(c => `<li>${c.first_name} ${c.last_name} — ${new Date(c.created_at).toLocaleString()} — ${byId[c.branch_id] || 'N/A'}</li>`).join('')}</ul>
  `;
}

function attachReportsHandlers() {
  document.getElementById('r-run').addEventListener('click', runReports);
}

async function initReportsView() {
  const container = document.getElementById('view-reports');
  renderReportsView(container);
  attachReportsHandlers();
}

window.initReportsView = initReportsView;
