'use strict';

// UI helpers
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function setupAuthTabs() {
  const tabs = document.querySelectorAll('.tab');
  const forms = document.querySelectorAll('.form');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    forms.forEach(f => f.classList.toggle('hidden', f.dataset.tab !== btn.dataset.tab));
  }));
}

// Validation utilities
const DISPOSABLE_DOMAINS = new Set(['mailinator.com','10minutemail.com','tempmail.com','yopmail.com','guerrillamail.com']);
const COMMON_PASSWORDS = new Set(['password','123456','123456789','qwerty','abc123','111111','letmein','admin','welcome','iloveyou']);

function isValidEmail(email) {
  if (!email) return false;
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!re.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  if (/(test|example|dummy)/i.test(email)) return false;
  return true;
}

function isValidName(name) {
  if (!name) return false;
  if (name.length < 2 || name.length > 50) return false;
  return /^[A-Za-z][A-Za-z\s\-]{1,49}$/.test(name);
}

function passwordStrengthInfo(pw) {
  const info = { ok: true, score: 0, fails: [] };
  if (!pw || pw.length < 12) { info.ok = false; info.fails.push('At least 12 characters'); }
  if (!/[a-z]/.test(pw)) { info.ok = false; info.fails.push('At least one lowercase letter'); }
  if (!/[A-Z]/.test(pw)) { info.ok = false; info.fails.push('At least one uppercase letter'); }
  if (!/[0-9]/.test(pw)) { info.ok = false; info.fails.push('At least one number'); }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) { info.ok = false; info.fails.push('At least one special character'); }
  if (/\s/.test(pw)) { info.ok = false; info.fails.push('No spaces'); }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) { info.ok = false; info.fails.push('Avoid common passwords'); }
  // score 0-100
  let score = Math.min(100, pw.length * 5);
  if (/[a-z]/.test(pw)) score += 5;
  if (/[A-Z]/.test(pw)) score += 5;
  if (/[0-9]/.test(pw)) score += 5;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) score += 5;
  info.score = Math.min(100, score);
  return info;
}

function setupPasswordMeter(inputSel, meterSel, listSel) {
  const input = document.querySelector(inputSel);
  const meter = document.querySelector(meterSel);
  const list = document.querySelector(listSel);
  if (!input || !meter || !list) return;
  const baseRules = [
    'At least 12 characters',
    'At least one uppercase letter',
    'At least one lowercase letter',
    'At least one number',
    'At least one special character',
    'No spaces',
  ];
  list.innerHTML = baseRules.map(r => `<li>${r}</li>`).join('');
  input.addEventListener('input', () => {
    const { ok, score, fails } = passwordStrengthInfo(input.value);
    meter.style.setProperty('--pct', `${score}%`);
    meter.style.setProperty('--col', ok ? '#22c55e' : '#f59e0b');
    [...list.children].forEach(li => {
      li.style.color = fails.includes(li.textContent) ? '#f59e0b' : '#9ca3af';
    });
  });
}

// Navigation
function setActiveView(viewId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${viewId}`));
}
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setActiveView(btn.dataset.view)));
  setActiveView('clients');
}

// Auth handlers on index.html
function attachAuthHandlers() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.textContent = '';
    if (!isValidEmail(email)) { err.textContent = 'Enter a valid, non-disposable email.'; return; }
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await signIn(email, password);
    if (error) { err.textContent = error.message || 'Login failed'; btn.disabled = false; return; }
    // Auto-create receptionist profile if none exists and an admin exists
    try { await ensureStaffProfileIfNoProfile(); } catch {}
    window.location.href = 'dashboard.html';
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const err = document.getElementById('signup-error');
    err.textContent = '';
    if (!isValidName(fullName)) { err.textContent = 'Full name must be 2–50 letters, spaces, or hyphens.'; return; }
    if (!isValidEmail(email)) { err.textContent = 'Enter a valid, non-disposable email.'; return; }
    const info = passwordStrengthInfo(password);
    if (!info.ok) { err.textContent = 'Password does not meet the required criteria.'; return; }
    const btn = signupForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await signUp(email, password, { full_name: fullName });
    btn.disabled = false;
    if (error) { err.textContent = error.message || 'Signup failed'; return; }
    showToast('Check your email to verify your account.');
  });
}

// Export validators for other modules
window.validators = { isValidEmail, isValidName, passwordStrengthInfo };
window.showToast = showToast;
window.setActiveView = setActiveView;
window.setupAuthTabs = setupAuthTabs;
window.setupPasswordMeter = setupPasswordMeter;
