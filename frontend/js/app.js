/* ── SmartApply Shared JS ─────────────────────────────────────────────── */

const API_BASE = '/api';

// ── Security: disable right-click and devtools shortcuts ─────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toLowerCase() === 'u')
  ) {
    e.preventDefault();
    return false;
  }
});

// ── Google OAuth token handler ────────────────────────────────────────────────
// Runs immediately (before DOMContentLoaded) on EVERY page.
// The backend redirects to dashboard.html?oauth_token=<jwt> after Google login.
// We grab the token, save it, clean the URL, then let the page continue normally.
(function handleOAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('oauth_token');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Save token + minimal user object so auth.isAuth becomes true
    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify({
      email: payload.email || '',
      id:    payload.sub   || '',
    }));
  } catch (_) {
    // If decode fails just store the token raw — auth will still work
    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify({}));
  }

  // Remove ?oauth_token from the URL bar without reloading
  const clean = window.location.pathname + window.location.hash;
  window.history.replaceState({}, '', clean);

  // If we landed on login or signup, redirect to dashboard
  const page = window.location.pathname.split('/').pop();
  if (!page || page === 'login.html' || page === 'signup.html') {
    window.location.href = 'dashboard.html';
  }
  // Otherwise we're already on the right page — just let it load normally
})();

// ── API client ────────────────────────────────────────────────────────────────
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
  get:    (path, opts) => api.request('GET', path, null, opts),
  post:   (path, body) => api.request('POST', path, body),
  put:    (path, body) => api.request('PUT', path, body),
  delete: (path)       => api.request('DELETE', path),
  upload: (path, form) => api.request('POST', path, form),
};

// ── Auth ──────────────────────────────────────────────────────────────────────
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

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '<i class="fa-solid fa-circle-check"></i>', error: '<i class="fa-solid fa-circle-xmark"></i>', info: '<i class="fa-solid fa-circle-info"></i>' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    const span = btn.querySelector('.btn-text');
    if (span) btn.setAttribute('data-original', span.textContent);
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

function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
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

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function hydrateNavbar() {
  const user = auth.user;
  const nav = document.getElementById('nav-actions');
  if (!nav) return;
  if (user) {
    nav.innerHTML = `
      <a href="dashboard.html" class="btn btn-ghost btn-sm"><i class="fa-solid fa-gauge"></i> Dashboard</a>
      <button onclick="auth.logout()" class="btn btn-ghost btn-sm"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm">Login</a>
      <a href="signup.html" class="btn btn-primary btn-sm">Get Started</a>
    `;
  }
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return '—';
  const str = isoString.endsWith('Z') || isoString.includes('+') ? isoString : isoString + 'Z';
  const diff = Date.now() - new Date(str).getTime();
  if (isNaN(diff)) return '—';
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(isoString);
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const str = isoString.endsWith('Z') || isoString.includes('+') ? isoString : isoString + 'Z';
  try {
    return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

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
      el.innerHTML = `${escHtml(tag)} <button type="button" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:4px;font-size:13px" aria-label="Remove">×</button>`;
      el.querySelector('button').addEventListener('click', () => {
        tags.splice(i, 1);
        hidden.value = JSON.stringify(tags);
        render();
      });
      container.appendChild(el);
    });
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