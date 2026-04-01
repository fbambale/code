'use strict';

// Supabase initialization
const SUPABASE_URL = 'https://ghqvwricjjdgikbpyfsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocXZ3cmljampkZ2lrYnB5ZnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjQ5NDMsImV4cCI6MjA4NTAwMDk0M30.CJLRWU8WUE45pO9uwndnwiJ28W35a9LF8aFv5ndfs-Q';

// Load Supabase CDN
const sbScript = document.createElement('script');
sbScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
document.head.appendChild(sbScript);

let supabaseClient;
sbScript.onload = () => {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};

// First-run helpers: admin bootstrap without SQL editor
async function hasAnyAdmin() {
  await ensureReady();
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('user_id, role_id, roles:role_id(name)')
    .eq('roles.name', 'admin')
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function bootstrapAdminIfNone(fullNameFallback = 'Administrator') {
  await ensureReady();
  const exists = await hasAnyAdmin();
  if (exists) return { created: false };
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { created: false, error: { message: 'Not signed in' } };
  // Try to upsert admin profile for current user
  const payload = { user_id: user.id, full_name: user.user_metadata?.full_name || fullNameFallback, role_id: 1, branch_id: null };
  const { data, error } = await supabaseClient.from('profiles').upsert(payload).select('*').single();
  if (error) return { created: false, error };
  return { created: true, data };
}

async function ensureReady() {
  if (supabaseClient) return;
  await new Promise(resolve => {
    const id = setInterval(() => {
      if (supabaseClient) { clearInterval(id); resolve(); }
    }, 50);
  });
}

// Auth
async function signUp(email, password, userMeta = {}) {
  await ensureReady();
  return supabaseClient.auth.signUp({ email, password, options: { data: userMeta, emailRedirectTo: window.location.origin + '/index.html' } });
}
async function signIn(email, password) {
  await ensureReady();
  return supabaseClient.auth.signInWithPassword({ email, password });
}
async function signOut() {
  await ensureReady();
  await supabaseClient.auth.signOut();
}
async function getSession() {
  await ensureReady();
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}
async function ensureSessionOrRedirect() {
  const session = await getSession();
  if (!session) window.location.href = 'index.html';
}

// Auto-create staff profile on first login if admin exists and user has none
async function ensureStaffProfileIfNoProfile() {
  await ensureReady();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { created: false, reason: 'no-user' };
  // Check if profile exists
  const { data: existing, error: selErr } = await supabaseClient.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (selErr && selErr.code === 'PGRST116') {
    // ignore no rows error
  }
  if (existing) return { created: false, reason: 'profile-exists' };
  // Require at least one admin present to avoid complete self-service escalation
  const adminExists = await hasAnyAdmin();
  if (!adminExists) return { created: false, reason: 'no-admin' };
  // Fetch role id for 'staff' dynamically in case ids differ
  const { data: rolesData } = await supabaseClient.from('roles').select('id,name').eq('name','staff').limit(1);
  const staffRoleId = rolesData && rolesData[0]?.id ? rolesData[0].id : 2;
  const payload = { user_id: user.id, full_name: user.user_metadata?.full_name || 'Reception', role_id: staffRoleId, branch_id: null };
  const { data, error } = await supabaseClient.from('profiles').upsert(payload).select('*').single();
  if (error) return { created: false, error };
  return { created: true, data };
}

// Helpers: current user profile/role
async function getMyProfile() {
  await ensureReady();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabaseClient.from('profiles').select('user_id, full_name, role_id, branch_id, roles:role_id(name)').eq('user_id', user.id).maybeSingle();
  if (error) return null;
  return data;
}

function requireRole(profile, allowed) {
  return profile && profile.roles && allowed.includes(profile.roles.name);
}

// Data access layers
// Branches
async function listBranches() {
  await ensureReady();
  return supabaseClient.from('branches').select('*').order('name');
}
async function createBranch(payload) {
  await ensureReady();
  return supabaseClient.from('branches').insert(payload).select('*').single();
}
async function updateBranch(id, payload) {
  await ensureReady();
  return supabaseClient.from('branches').update(payload).eq('id', id).select('*').single();
}
async function deleteBranch(id) {
  await ensureReady();
  return supabaseClient.from('branches').delete().eq('id', id);
}

// Clients
async function listClients({ search = '', limit = 25, offset = 0 } = {}) {
  await ensureReady();
  let q = supabaseClient.from('clients').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (search) {
    q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,national_id.ilike.%${search}%`);
  }
  return q;
}
async function createClient(payload) {
  await ensureReady();
  const { data: { user } } = await supabaseClient.auth.getUser();
  payload.created_by = user?.id ?? null;
  return supabaseClient.from('clients').insert(payload).select('*').single();
}
async function updateClient(id, payload) {
  await ensureReady();
  payload.updated_at = new Date().toISOString();
  return supabaseClient.from('clients').update(payload).eq('id', id).select('*').single();
}
async function deleteClient(id) {
  await ensureReady();
  return supabaseClient.from('clients').delete().eq('id', id);
}

// Users (profiles + roles)
async function listUsers() {
  await ensureReady();
  return supabaseClient.from('profiles').select('user_id, full_name, branch_id, role_id, roles:role_id(name)');
}
async function setUserProfile(user_id, { full_name, role_id, branch_id }) {
  await ensureReady();
  return supabaseClient.from('profiles').upsert({ user_id, full_name, role_id, branch_id }).select('*').single();
}

// Hard admin mapping: ensure this email is always admin on login
const HARD_ADMIN_EMAIL = 'francescobambale@gmail.com';
async function ensureHardAdminProfile() {
  await ensureReady();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { ensured: false, reason: 'no-user' };
  const email = (user.email || '').toLowerCase();
  if (email !== HARD_ADMIN_EMAIL.toLowerCase()) return { ensured: false, reason: 'not-hard-admin' };
  const payload = {
    user_id: user.id,
    full_name: user.user_metadata?.full_name || 'Administrator',
    role_id: 1, // admin
    branch_id: null,
  };
  const { data, error } = await supabaseClient.from('profiles').upsert(payload).select('*').single();
  if (error) return { ensured: false, error };
  return { ensured: true, data };
}

window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getSession = getSession;
window.ensureSessionOrRedirect = ensureSessionOrRedirect;
window.ensureStaffProfileIfNoProfile = ensureStaffProfileIfNoProfile;
window.getMyProfile = getMyProfile;
window.requireRole = requireRole;
window.listBranches = listBranches;
window.createBranch = createBranch;
window.updateBranch = updateBranch;
window.deleteBranch = deleteBranch;
window.listClients = listClients;
window.createClient = createClient;
window.updateClient = updateClient;
window.deleteClient = deleteClient;
window.listUsers = listUsers;
window.setUserProfile = setUserProfile;
window.hasAnyAdmin = hasAnyAdmin;
window.bootstrapAdminIfNone = bootstrapAdminIfNone;
window.ensureHardAdminProfile = ensureHardAdminProfile;
