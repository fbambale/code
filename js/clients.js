'use strict';

function renderClientsView(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div>
        <input id="clients-search" class="input-inline" placeholder="Search name, email, national ID" />
        <button id="clients-refresh" class="btn">Refresh</button>
      </div>
      <div>
        <button id="client-new" class="btn primary">New Client</button>
      </div>
    </div>

    <div id="client-form" class="grid cols-3 hidden">
      <label>First name<input id="c-first" /></label>
      <label>Last name<input id="c-last" /></label>
      <label>National ID<input id="c-nid" /></label>
      <label>Email<input id="c-email" type="email" /></label>
      <label>Phone<input id="c-phone" /></label>
      <label>Gender<select id="c-gender"><option value="">-</option><option>male</option><option>female</option><option>other</option></select></label>
      <label>Date of Birth<input id="c-dob" type="date" /></label>
      <label>Branch<select id="c-branch"></select></label>
      <label>Address<textarea id="c-address"></textarea></label>
      <label class="span-3">Notes<textarea id="c-notes"></textarea></label>
      <div>
        <button id="c-save" class="btn primary">Save</button>
        <button id="c-cancel" class="btn">Cancel</button>
      </div>
    </div>

    <table class="table" id="clients-table">
      <thead><tr>
        <th>Name</th><th>Email</th><th>National ID</th><th>Branch</th><th>Created</th><th></th>
      </tr></thead>
      <tbody></tbody>
    </table>
  `;
}

async function loadBranchesInto(select) {
  const { data } = await listBranches();
  select.innerHTML = `<option value="">Select branch</option>` + (data||[]).map(b => `<option value="${b.id}">${b.name} (${b.code})</option>`).join('');
}

let clientsState = { offset: 0, limit: 25, search: '' };
let branchesById = {};

async function refreshClients() {
  const tbody = document.querySelector('#clients-table tbody');
  tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
  // Load branches to map id -> name
  const { data: bdata } = await listBranches();
  branchesById = Object.fromEntries((bdata||[]).map(b => [b.id, `${b.name} (${b.code})`]));
  const { data, error } = await listClients({ search: clientsState.search, offset: clientsState.offset, limit: clientsState.limit });
  if (error) { tbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`; return; }
  tbody.innerHTML = (data||[]).map(c => {
    const bLabel = branchesById[c.branch_id] || '';
    return `
    <tr>
      <td>${c.first_name} ${c.last_name}</td>
      <td>${c.email ?? ''}</td>
      <td>${c.national_id}</td>
      <td>${bLabel}</td>
      <td>${new Date(c.created_at).toLocaleString()}</td>
      <td class="row-actions">
        <button class="btn" data-edit="${c.id}">Edit</button>
        <button class="btn danger" data-del="${c.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">No clients found</td></tr>';
  // Attach actions
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openClientForm(btn.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => confirmDeleteClient(btn.dataset.del)));
}

function toggleClientForm(show) {
  document.getElementById('client-form').classList.toggle('hidden', !show);
}

async function openClientForm(clientId = null) {
  toggleClientForm(true);
  const branchSelect = document.getElementById('c-branch');
  await loadBranchesInto(branchSelect);
  const saveBtn = document.getElementById('c-save');
  saveBtn.dataset.clientId = clientId || '';
  if (clientId) {
    // load single client
    const { data, error } = await listClients();
    const c = (data||[]).find(x => x.id === clientId);
    if (!c) return;
    document.getElementById('c-first').value = c.first_name;
    document.getElementById('c-last').value = c.last_name;
    document.getElementById('c-nid').value = c.national_id;
    document.getElementById('c-email').value = c.email || '';
    document.getElementById('c-phone').value = c.phone || '';
    document.getElementById('c-gender').value = c.gender || '';
    document.getElementById('c-dob').value = c.dob || '';
    document.getElementById('c-branch').value = c.branch_id || '';
    document.getElementById('c-address').value = c.address || '';
    document.getElementById('c-notes').value = c.notes || '';
  } else {
    ['c-first','c-last','c-nid','c-email','c-phone','c-gender','c-dob','c-address','c-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('c-branch').value = '';
  }
}

function validateClientForm() {
  const { isValidEmail, isValidName } = window.validators;
  const first = document.getElementById('c-first').value.trim();
  const last = document.getElementById('c-last').value.trim();
  const nid = document.getElementById('c-nid').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  const branch = document.getElementById('c-branch').value;
  if (!isValidName(first) || !isValidName(last)) return 'Names must be letters/spaces/hyphens (2–50).';
  if (!/^([A-Z0-9]{6,20})$/.test(nid)) return 'National ID must be 6–20 upper-case letters/numbers.';
  if (email && !isValidEmail(email)) return 'Invalid email.';
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) return 'Invalid phone.';
  if (!branch) return 'Select a branch.';
  return null;
}

async function saveClientFromForm() {
  const err = validateClientForm();
  if (err) { showToast(err, 'warn'); return; }
  const payload = {
    first_name: document.getElementById('c-first').value.trim(),
    last_name: document.getElementById('c-last').value.trim(),
    national_id: document.getElementById('c-nid').value.trim(),
    email: document.getElementById('c-email').value.trim() || null,
    phone: document.getElementById('c-phone').value.trim() || null,
    gender: document.getElementById('c-gender').value || null,
    dob: document.getElementById('c-dob').value || null,
    branch_id: document.getElementById('c-branch').value,
    address: document.getElementById('c-address').value.trim() || null,
    notes: document.getElementById('c-notes').value.trim() || null,
  };
  const clientId = document.getElementById('c-save').dataset.clientId;
  let res;
  if (clientId) res = await updateClient(clientId, payload);
  else res = await createClient(payload);
  if (res.error) { showToast(res.error.message, 'error'); return; }
  showToast('Client saved');
  toggleClientForm(false);
  refreshClients();
}

async function confirmDeleteClient(id) {
  if (!confirm('Delete this client?')) return;
  const { error } = await deleteClient(id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Client deleted');
  refreshClients();
}

function attachClientHandlers() {
  document.getElementById('clients-refresh').addEventListener('click', refreshClients);
  document.getElementById('clients-search').addEventListener('input', (e) => { clientsState.search = e.target.value.trim(); refreshClients(); });
  document.getElementById('client-new').addEventListener('click', () => openClientForm(null));
  document.getElementById('c-save').addEventListener('click', saveClientFromForm);
  document.getElementById('c-cancel').addEventListener('click', () => toggleClientForm(false));
}

async function initClientsView() {
  const container = document.getElementById('view-clients');
  renderClientsView(container);
  attachClientHandlers();
  await refreshClients();
}

window.initClientsView = initClientsView;
