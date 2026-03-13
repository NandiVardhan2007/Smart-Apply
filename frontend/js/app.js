/* ── SmartApply Shared JS ─────────────────────────────────────────────── */

const API_BASE = '/api';

// ── API Client ──────────────────────────────────────────────────────────────
const api = {
  async request(method, path, body = null, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    const token = localStorage.getItem('sa_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers, credentials: 'include' };
    if (body && !(body instanceof FormData)) {
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      delete headers['Content-Type'];
      config.body = body;
    }

    const res = await fetch(API_BASE + path, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, detail: data.detail || 'Request failed', data };
    return data;
  },

  get:    (path, opts)  => api.request('GET', path, null, opts),
  post:   (path, body)  => api.request('POST', path, body),
  put:    (path, body)  => api.request('PUT', path, body),
  delete: (path)        => api.request('DELETE', path),
  upload: (path, form)  => api.request('POST', path, form),
};

// ── Auth Helpers ────────────────────────────────────────────────────────────
const auth = {
  save(token, user) {
    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
  },
  get token()  { return localStorage.getItem('sa_token'); },
  get user()   { try { return JSON.parse(localStorage.getItem('sa_user')); } catch { return null; } },
  get isAuth() { return !!this.token; },

  requireAuth(redirect = 'login.html') {
    if (!this.isAuth) { window.location.href = redirect; return false; }
    return true;
  },
  requireGuest(redirect = 'dashboard.html') {
    if (this.isAuth) { window.location.href = redirect; return false; }
    return true;
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch {}
    this.clear();
    window.location.href = 'index.html';
  }
};

// ── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:16px">${icons[type]||'•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Form helpers ────────────────────────────────────────────────────────────
function setLoading(btn, loading, text = null) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    if (text) btn.setAttribute('data-original', btn.querySelector('.btn-text')?.textContent || btn.textContent);
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    const orig = btn.getAttribute('data-original');
    if (orig) {
      const span = btn.querySelector('.btn-text');
      if (span) span.textContent = orig;
    }
  }
}

function showError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.classList.add('hidden'));
  document.querySelectorAll('.form-group').forEach(e => e.classList.remove('has-error'));
}

function markFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const group = input.closest('.form-group');
  if (group) {
    group.classList.add('has-error');
    const err = group.querySelector('.field-error');
    if (err) err.textContent = msg;
  }
}

// Password strength
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0-4
}

function renderStrength(bars, password) {
  const score = checkPasswordStrength(password);
  bars.forEach((bar, i) => {
    bar.className = 'pw-bar';
    if (i < score) {
      if (score <= 1) bar.classList.add('weak');
      else if (score <= 2) bar.classList.add('medium');
      else bar.classList.add('strong');
    }
  });
}

// ── URL params ──────────────────────────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ── Navbar hydration ────────────────────────────────────────────────────────
function hydrateNavbar() {
  const user = auth.user;
  const nav = document.getElementById('nav-actions');
  if (!nav) return;
  if (user) {
    nav.innerHTML = `
      <a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>
      <button onclick="auth.logout()" class="btn btn-ghost btn-sm">Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Login</a>
      <a href="signup.html" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }
}

// ── Format helpers ──────────────────────────────────────────────────────────
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Tag input helper ────────────────────────────────────────────────────────
function initTagInput(containerId, hiddenId, initial = []) {
  const container = document.getElementById(containerId);
  const hidden = document.getElementById(hiddenId);
  let tags = [...initial];

  function render() {
    container.innerHTML = '';
    tags.forEach((tag, i) => {
      const el = document.createElement('span');
      el.className = 'badge badge-primary';
      el.style.cursor = 'default';
      el.innerHTML = `${escHtml(tag)} <button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px;font-size:13px">×</button>`;
      el.querySelector('button').addEventListener('click', () => {
        tags.splice(i, 1);
        hidden.value = JSON.stringify(tags);
        render();
      });
      container.appendChild(el);
    });
    // Add input
    const input = document.createElement('input');
    input.placeholder = 'Type & press Enter';
    input.style.cssText = 'background:none;border:none;outline:none;color:var(--text);font-size:14px;min-width:120px;padding:4px;';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !tags.includes(val)) {
          tags.push(val);
          hidden.value = JSON.stringify(tags);
          render();
        }
      }
    });
    container.appendChild(input);
    hidden.value = JSON.stringify(tags);
  }

  render();
  return { getTags: () => tags };
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateNavbar();
});
