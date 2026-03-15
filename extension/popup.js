// SmartApply Extension – Popup v5

const SERVER_URL = 'https://smart-apply-7zty.onrender.com';
const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.remove('hidden');
const hide = id => $(id)?.classList.add('hidden');

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Log (deduplicated) ────────────────────────────────────────────────────────
let logEntries = [];
function addLog(msg, type = 'info') {
  // Prevent duplicate consecutive entries
  if (logEntries.length && logEntries[0].msg === msg) return;
  logEntries.unshift({ time: timeStr(), msg, type });
  if (logEntries.length > 150) logEntries.pop();
  renderLog();
}
function renderLog() {
  const el = $('activity-log');
  if (!el) return;
  el.innerHTML = logEntries.map(e =>
    `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-${e.type}">${esc(e.msg)}</span></div>`
  ).join('');
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let stats = { applied: 0, skipped: 0, errors: 0, letters: 0 };

function updateStats(s) {
  stats = { ...stats, ...s };
  $('stat-applied').textContent = stats.applied;
  $('stat-skipped').textContent = stats.skipped;
  $('stat-errors').textContent  = stats.errors;
  $('stat-letters').textContent = stats.letters;
  $('ai-stat-letters').textContent = stats.letters;
}

function setStatus(text, type = 'idle') {
  const bar = $('status-bar'); const dot = $('status-dot'); const txt = $('status-text');
  if (!bar) return;
  bar.className = `status-bar status-${type}`;
  if (dot) { dot.className = `sdot sdot-${type === 'running' ? 'running' : type === 'success' ? 'ok' : type === 'error' ? 'err' : 'idle'}`; }
  if (txt) txt.textContent = text;
}

const storageGet = keys => new Promise(r => chrome.storage.local.get(keys, r));
const storageSet = obj  => new Promise(r => chrome.storage.local.set(obj, r));

async function apiCall(serverUrl, path, method = 'GET', body = null, token = null) {
  const url = serverUrl.replace(/\/$/, '') + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
  return { ok: resp.ok, status: resp.status, data };
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
    });
  });
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = $('login-email').value.trim();
  const password = $('login-password').value;
  if (!email || !password) { showLoginError('Enter email and password.'); return; }

  $('btn-login').disabled = true;
  show('login-spinner');
  $('btn-login').querySelector('.btn-text').textContent = 'Signing in…';
  hide('login-error');

  try {
    const { ok, data } = await apiCall(SERVER_URL, '/api/auth/login', 'POST', { email, password });
    if (!ok) { showLoginError(data.detail || 'Email or password is wrong. Try again.'); return; }
    await storageSet({ serverUrl: SERVER_URL, token: data.access_token, userEmail: data.user?.email || email, loggedIn: true });
    await loadDashboard(SERVER_URL, data.access_token, data.user?.email || email);
  } catch (err) {
    showLoginError(`Cannot reach server: ${err.message}`);
  } finally {
    $('btn-login').disabled = false;
    hide('login-spinner');
    $('btn-login').querySelector('.btn-text').textContent = 'Sign In';
  }
}

function showLoginError(msg) {
  const el = $('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`screen-${name}`)?.classList.remove('hidden');
}

async function loadDashboard(serverUrl, token, email) {
  showScreen('main');
  $('user-email-display').textContent = email;
  addLog('Logged in — loading profile…', 'info');
  await loadProfile(serverUrl, token);
  await loadSettings();
  await loadResumes(serverUrl, token);
  $('last-refresh').textContent = `Refreshed ${timeStr()}`;
}

async function loadProfile(serverUrl, token) {
  try {
    const { ok, data } = await apiCall(serverUrl, '/api/profile/me', 'GET', null, token);
    if (!ok) { addLog(`Profile error: ${data.detail}`, 'err'); return; }

    const profile = data.profile || {};
    const prefs   = data.job_preferences || {};
    const name    = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';

    $('profile-avatar').textContent = name[0]?.toUpperCase() || '?';
    $('profile-name').textContent   = name;

    const loc = [profile.current_city, profile.country].filter(Boolean).join(', ');
    const yoe = profile.years_of_experience ? `${profile.years_of_experience}yr` : '';
    let metaText = [loc, yoe].filter(Boolean).join(' · ');
    const terms = prefs.search_terms || [];
    if (terms.length) metaText += ` · ${terms.slice(0,2).join(', ')}${terms.length>2?'…':''}`;
    $('profile-meta').textContent = metaText;
    show('profile-strip');

    const missing = [];
    if (!profile.first_name)   missing.push('First name');
    if (!profile.last_name)    missing.push('Last name');
    if (!profile.phone_number) missing.push('Phone');
    if (!terms.length)         missing.push('Search terms');

    const badge = $('profile-badge');
    if (missing.length) {
      badge.className = 'badge badge-yellow';
      $('badge-text').textContent = 'Incomplete';
      addLog(`⚠ Missing: ${missing.join(', ')}`, 'warn');
    } else {
      badge.className = 'badge badge-green';
      $('badge-text').textContent = 'Ready';
      addLog(`✓ Profile: ${name}`, 'ok');
    }
    await storageSet({ profileData: data });
  } catch (err) { addLog(`Profile error: ${err.message}`, 'err'); }
}

async function loadResumes(serverUrl, token) {
  const el = $('resume-list');
  if (!el) return;
  try {
    const { ok, data } = await apiCall(serverUrl, '/api/resume/list', 'GET', null, token);
    if (!ok || !data.resumes?.length) {
      el.innerHTML = '<div class="empty-state">No resumes uploaded yet.<br>Go to SmartApply → Resume to upload.</div>';
      return;
    }
    el.innerHTML = data.resumes.map((r, i) => {
      const label = r.label?.toLowerCase() || '';
      const tag = label.includes('crm')||label.includes('hubspot') ? 'CRM'
        : label.includes('java')||label.includes('dev') ? 'Dev'
        : label.includes('market') ? 'Marketing'
        : label.includes('finance')||label.includes('mba') ? 'Finance'
        : label.includes('analyst')||label.includes('power bi') ? 'Analytics'
        : 'General';
      return `<div class="resume-item">
        <div class="resume-icon">📄</div>
        <div class="resume-label" title="${r.label||r.filename||'Resume'}">${r.label||r.filename||'Resume '+(i+1)}</div>
        <span class="resume-tag">${tag}</span>
        <div class="resume-date">${r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : ''}</div>
      </div>`;
    }).join('');
    await storageSet({ resumeData: data.resumes });  // routing_keywords included per resume
  } catch (err) { el.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
}

async function loadSettings() {
  const s = await storageGet(['coverLetter','humanMode','maxApps','aiAnswers','aiSelect','smartResume']);
  $('opt-cover-letter').checked = s.coverLetter  !== false;
  $('opt-human-mode').checked   = s.humanMode    !== false;
  $('opt-ai-answers').checked   = s.aiAnswers    !== false;
  $('opt-ai-select').checked    = s.aiSelect     !== false;
  $('opt-smart-resume').checked = s.smartResume  !== false;
  const maxApps = s.maxApps || 20;
  $('opt-max-apps').value = maxApps;
  $('max-apps-display').textContent = maxApps;
}

async function saveSettings() {
  const maxApps = parseInt($('opt-max-apps').value) || 20;
  await storageSet({
    coverLetter:  $('opt-cover-letter').checked,
    humanMode:    $('opt-human-mode').checked,
    aiAnswers:    $('opt-ai-answers').checked,
    aiSelect:     $('opt-ai-select').checked,
    smartResume:  $('opt-smart-resume').checked,
    maxApps,
  });
}

// ── Start bot ─────────────────────────────────────────────────────────────────
async function startBot() {
  const stored = await storageGet(['serverUrl','token','profileData','coverLetter','humanMode','maxApps','aiAnswers','aiSelect','smartResume','resumeData']);
  if (!stored.token)       { addLog('Not logged in', 'err'); return; }
  if (!stored.profileData) { addLog('Profile not loaded — click Refresh Profile', 'err'); return; }

  const profile = stored.profileData.profile || {};
  const prefs   = stored.profileData.job_preferences || {};

  if (!profile.first_name) { addLog('First name missing in profile', 'err'); return; }

  const terms = (prefs.search_terms || []).filter(Boolean);
  if (!terms.length) { addLog('❌ No search terms! Add in Profile → Job Preferences', 'err'); return; }

  await saveSettings();

  const config = {
    serverUrl:    stored.serverUrl,
    token:        stored.token,
    profile,          // includes ai_memory for enriched question answering
    jobPrefs:     prefs,
    accounts:     stored.profileData.platform_accounts || {},
    coverLetter:  stored.coverLetter !== false,
    humanMode:    stored.humanMode   !== false,
    aiAnswers:    stored.aiAnswers   !== false,
    aiSelect:     stored.aiSelect    !== false,
    smartResume:  stored.smartResume !== false,
    maxApps:      parseInt(stored.maxApps) || 20,
    userEmail:    stored.userEmail,
    resumeList:   stored.resumeData || [],  // each resume has routing_keywords
    _resumeTermIndex: 0,
  };

  await storageSet({ botConfig: config, botRunning: true, botStats: { applied:0, skipped:0, errors:0, letters:0 } });
  setStatus('Starting…', 'running');
  show('btn-stop'); hide('btn-start');

  addLog(`🚀 LIVE | Max: ${config.maxApps}`, 'ok');
  addLog(`🔍 Searching: ${terms.slice(0,3).join(', ')}`, 'info');
  if (config.coverLetter) addLog('✦ AI cover letters: ON', 'ai');
  if (config.aiAnswers)   addLog('🤖 AI answers: ON', 'ai');
  if (config.aiSelect)    addLog('🎯 AI option picks: ON', 'ai');

  const searchUrl = buildSearchUrl(prefs, 0);
  try {
    const liTabs = await chrome.tabs.query({ url: '*://www.linkedin.com/jobs/*' });
    if (liTabs.length > 0) {
      await chrome.tabs.update(liTabs[0].id, { url: searchUrl, active: true });
    } else {
      chrome.tabs.create({ url: searchUrl });
    }
    addLog('Opening LinkedIn search…', 'info');
  } catch (err) { addLog(`Tab error: ${err.message}`, 'warn'); }
}

function buildSearchUrl(jobPrefs, index) {
  const terms    = (jobPrefs?.search_terms || []).filter(Boolean);
  const keyword  = terms[index] || 'Software Engineer';
  const location = jobPrefs?.search_location || 'India';
  const params   = new URLSearchParams({ keywords: keyword, location, f_LF: 'f_AL', sortBy: 'DD' });
  const expMap   = { 'Internship':'1','Entry level':'2','Associate':'3','Mid-Senior level':'4','Director':'5','Executive':'6' };
  const expLevels= (jobPrefs?.experience_level||[]).map(e=>expMap[e]).filter(Boolean);
  if (expLevels.length) params.set('f_E', expLevels.join(','));
  const workMap  = { 'On-site':'1','Remote':'2','Hybrid':'3' };
  const workTypes= (jobPrefs?.on_site||[]).map(w=>workMap[w]).filter(Boolean);
  if (workTypes.length) params.set('f_WT', workTypes.join(','));
  const dateMap  = { 'Past 24 hours':'r86400','Past week':'r604800','Past month':'r2592000' };
  const dateFilter = dateMap[jobPrefs?.date_posted];
  if (dateFilter) params.set('f_TPR', dateFilter);
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function stopBot() {
  await storageSet({ botRunning: false });
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/jobs/*' });
    for (const tab of tabs) chrome.tabs.sendMessage(tab.id, { type:'BOT_STOP' }).catch(()=>{});
  } catch {}
  setStatus('Stopped', 'idle');
  hide('btn-stop'); show('btn-start');
  addLog('Bot stopped', 'warn');
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BOT_LOG')    addLog(msg.text, msg.level || 'info');
  if (msg.type === 'BOT_STATS')  updateStats(msg.stats);
  if (msg.type === 'BOT_STATUS') {
    if (msg.running) { setStatus('Bot running…', 'running'); }
    else { setStatus('Done ✓', 'success'); hide('btn-stop'); show('btn-start'); }
  }
});

// ── Toggle password visibility ────────────────────────────────────────────────
function togglePw(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  initTabs();
  const stored = await storageGet(['loggedIn','serverUrl','token','userEmail','botRunning']);
  if (stored.loggedIn && stored.token) {
    await loadDashboard(stored.serverUrl, stored.token, stored.userEmail);
    if (stored.botRunning) { setStatus('Bot running…', 'running'); show('btn-stop'); hide('btn-start'); }
  } else {
    showScreen('login');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  $('btn-login').addEventListener('click', doLogin);
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('toggle-login-pw')?.addEventListener('click', () => togglePw('login-password'));

  $('btn-logout').addEventListener('click', async () => {
    await storageSet({ loggedIn: false, token: null, profileData: null, botRunning: false });
    logEntries = [];
    showScreen('login');
  });

  $('btn-start').addEventListener('click', startBot);
  $('btn-stop').addEventListener('click', stopBot);

  ['opt-cover-letter','opt-human-mode','opt-ai-answers','opt-ai-select','opt-smart-resume'].forEach(id => {
    $(id)?.addEventListener('change', saveSettings);
  });

  $('inc-max').addEventListener('click', () => {
    let v = parseInt($('opt-max-apps').value) || 20;
    v = Math.min(200, v + 5);
    $('opt-max-apps').value = v;
    $('max-apps-display').textContent = v;
    saveSettings();
  });
  $('dec-max').addEventListener('click', () => {
    let v = parseInt($('opt-max-apps').value) || 20;
    v = Math.max(1, v - 5);
    $('opt-max-apps').value = v;
    $('max-apps-display').textContent = v;
    saveSettings();
  });

  $('btn-refresh-profile').addEventListener('click', async () => {
    const s = await storageGet(['serverUrl','token']);
    if (s.token) { addLog('Refreshing profile…','info'); await loadProfile(s.serverUrl, s.token); $('last-refresh').textContent = `Refreshed ${timeStr()}`; }
  });

  $('btn-reload-resumes').addEventListener('click', async () => {
    const s = await storageGet(['serverUrl','token']);
    if (s.token) await loadResumes(s.serverUrl, s.token);
  });

  $('btn-clear-log').addEventListener('click', () => { logEntries = []; renderLog(); });
});
