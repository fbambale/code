'use strict';

function renderUsersView(container) {
  container.innerHTML = `
    <div class="toolbar">
      <div><h2>Users</h2></div>
      <div>
        <button id="user-refresh" class="btn">Refresh</button>
      </div>
    </div>
    <div class="grid cols-3">
      <div class="span-3">
        <p class="muted">After a user signs up and verifies email, an admin should assign a role and branch below.</p>
      </div>
      <label>User ID<input id="u-id" placeholder="Paste auth user UUID" /></label>
      <label>Full Name<input id="u-name" /></label>
      <label>Role<select id="u-role">
        <option value="1">admin</option>
        <option value="2">staff</option>
        <option value="3">viewer</option>
      </select></label>
      <label>Branch<select id="u-branch"></select></label>
      <div>
        <button id="u-save" class="btn primary">Save Profile</button>
      </div>
    </div>

    <h3>All Users</h3>
    <table class="table" id="users-table"><thead><tr>
      <th>User ID</th><th>Name</th><th>Role</th><th>Branch</th>
    </tr></thead><tbody></tbody></table>
  `;
}

async function refreshUsers() {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  const { data: branches } = await listBranches();
  const byId = Object.fromEntries((branches||[]).map(b => [b.id, `${b.name} (${b.code})`]));
  const { data, error } = await listUsers();
  if (error) { tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`; return; }
  tbody.innerHTML = (data||[]).map(u => `
    <tr>
      <td>${u.user_id}</td>
      <td>${u.full_name ?? ''}</td>
      <td>${u.roles?.name ?? ''}</td>
      <td>${u.branch_id ? (byId[u.branch_id] || u.branch_id) : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No users</td></tr>';
}

async function loadBranchesForUsers() {
  const sel = document.getElementById('u-branch');
  const { data } = await listBranches();
  sel.innerHTML = '<option value="">Select branch</option>' + (data||[]).map(b => `<option value="${b.id}">${b.name} (${b.code})</option>`).join('');
}

function attachUsersHandlers() {
  document.getElementById('user-refresh').addEventListener('click', refreshUsers);
  document.getElementById('u-save').addEventListener('click', async () => {
    const user_id = document.getElementById('u-id').value.trim();
    const full_name = document.getElementById('u-name').value.trim();
    const role_id = parseInt(document.getElementById('u-role').value, 10);
    const branch_id = document.getElementById('u-branch').value || null;
    if (!user_id) { showToast('User ID required'); return; }
    if (!full_name) { showToast('Full name required'); return; }
    const { error } = await setUserProfile(user_id, { full_name, role_id, branch_id });
    if (error) { showToast(error.message, 'error'); return; }
    showToast('User profile saved');
    refreshUsers();
  });
}

async function initUsersView() {
  const container = document.getElementById('view-users');
  renderUsersView(container);
  await loadBranchesForUsers();
  attachUsersHandlers();
  refreshUsers();
}

window.initUsersView = initUsersView;
