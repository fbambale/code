'use strict';

function renderBranchesView(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div><h2>Branches</h2></div>
      <div>
        <button id="branch-new" class="btn primary">New Branch</button>
      </div>
    </div>
    <div id="branch-form" class="grid cols-3 hidden">
      <label>Code<input id="b-code" placeholder="e.g., NRB" /></label>
      <label>Name<input id="b-name" placeholder="Nairobi" /></label>
      <label>Email<input id="b-email" type="email" /></label>
      <label>Phone<input id="b-phone" placeholder="+2547..." /></label>
      <label class="span-3">Address<textarea id="b-address"></textarea></label>
      <div>
        <button id="b-save" class="btn primary">Save</button>
        <button id="b-cancel" class="btn">Cancel</button>
      </div>
    </div>
    <table class="table" id="branches-table"><thead><tr>
      <th>Code</th><th>Name</th><th>Email</th><th>Phone</th><th></th>
    </tr></thead><tbody></tbody></table>
  `;
}

let branchesCache = [];

async function refreshBranches() {
  const tbody = document.querySelector('#branches-table tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  const { data, error } = await listBranches();
  if (error) { tbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`; return; }
  branchesCache = data || [];
  tbody.innerHTML = branchesCache.map(b => `
    <tr>
      <td>${b.code}</td>
      <td>${b.name}</td>
      <td>${b.email ?? ''}</td>
      <td>${b.phone ?? ''}</td>
      <td class="row-actions">
        <button class="btn" data-edit="${b.id}">Edit</button>
        <button class="btn danger" data-del="${b.id}">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">No branches</td></tr>';
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openBranchForm(btn.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => confirmDeleteBranch(btn.dataset.del)));
}

function toggleBranchForm(show) {
  document.getElementById('branch-form').classList.toggle('hidden', !show);
}

function validateBranch() {
  const code = document.getElementById('b-code').value.trim();
  const name = document.getElementById('b-name').value.trim();
  const email = document.getElementById('b-email').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  if (!/^[A-Z0-9_-]{2,10}$/.test(code)) return 'Code must be 2–10 chars (A-Z, 0-9, _ or -).';
  if (name.length < 3 || name.length > 80) return 'Name must be 3–80 chars.';
  if (email && !window.validators.isValidEmail(email)) return 'Invalid email';
  if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) return 'Invalid phone';
  return null;
}

async function openBranchForm(branchId = null) {
  toggleBranchForm(true);
  const saveBtn = document.getElementById('b-save');
  saveBtn.dataset.branchId = branchId || '';
  if (branchId) {
    const b = branchesCache.find(x => x.id === branchId);
    if (!b) return;
    document.getElementById('b-code').value = b.code;
    document.getElementById('b-name').value = b.name;
    document.getElementById('b-email').value = b.email || '';
    document.getElementById('b-phone').value = b.phone || '';
    document.getElementById('b-address').value = b.address || '';
  } else {
    ['b-code','b-name','b-email','b-phone','b-address'].forEach(id => document.getElementById(id).value = '');
  }
}

async function saveBranch() {
  const err = validateBranch();
  if (err) { showToast(err); return; }
  const payload = {
    code: document.getElementById('b-code').value.trim(),
    name: document.getElementById('b-name').value.trim(),
    email: document.getElementById('b-email').value.trim() || null,
    phone: document.getElementById('b-phone').value.trim() || null,
    address: document.getElementById('b-address').value.trim() || null,
  };
  const id = document.getElementById('b-save').dataset.branchId;
  let res;
  if (id) res = await updateBranch(id, payload); else res = await createBranch(payload);
  if (res.error) { showToast(res.error.message, 'error'); return; }
  showToast('Branch saved');
  toggleBranchForm(false);
  refreshBranches();
}

async function confirmDeleteBranch(id) {
  if (!confirm('Delete this branch?')) return;
  const { error } = await deleteBranch(id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Branch deleted');
  refreshBranches();
}

function attachBranchHandlers() {
  document.getElementById('branch-new').addEventListener('click', () => openBranchForm());
  document.getElementById('b-save').addEventListener('click', saveBranch);
  document.getElementById('b-cancel').addEventListener('click', () => toggleBranchForm(false));
}

async function initBranchesView() {
  const container = document.getElementById('view-branches');
  renderBranchesView(container);
  attachBranchHandlers();
  refreshBranches();
}

window.initBranchesView = initBranchesView;
