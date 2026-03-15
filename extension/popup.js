// ════════════════════════════════════════════════════════════════
//  SmartApply Extension – Popup v3
// ════════════════════════════════════════════════════════════════

const DEFAULT_SERVER = 'http://localhost:8000';
const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.remove('hidden');
const hide = id => $(id)?.classList.add('hidden');

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

let logEntries = [];
function addLog(msg, type='info') {
  logEntries.unshift({ time: timeStr(), msg, type });
  if (logEntries.length > 100) logEntries.pop();
  renderLog();
}
function renderLog() {
  const el = $('activity-log');
  if (!el) return;
  el.innerHTML = logEntries.map(e =>
    `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-${e.type}">${escHtml(e.msg)}</span></div>`
  ).join('');
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let stats = { applied:0, skipped:0, errors:0, letters:0 };
function updateStats(s) {
  stats = { ...stats, ...s };
  $('stat-applied').textContent = stats.applied;
  $('stat-skipped').textContent = stats.skipped;
  $('stat-errors').textContent  = stats.errors;
  $('stat-letters').textContent = stats.letters;
}

function setStatus(text, type='idle') {
  const banner = $('status-banner');
  if (!banner) return;
  banner.className = `status-banner status-${type}`;
  $('status-text').textContent = text;
  $('status-icon').textContent = { idle:'●', running:'◉', success:'✓', error:'✗' }[type] || '●';
}

const storageGet = keys => new Promise(r => chrome.storage.local.get(keys, r));
const storageSet = obj  => new Promise(r => chrome.storage.local.set(obj, r));

async function apiCall(serverUrl, path, method='GET', body=null, token=null) {
  const url = serverUrl.replace(/\/$/, '') + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
  return { ok: resp.ok, status: resp.status, data };
}

// ── Login ──────────────────────────────────────────────────────────
async function doLogin() {
  const serverUrl = $('server-url').value.trim() || DEFAULT_SERVER;
  const email     = $('login-email').value.trim();
  const password  = $('login-password').value;
  if (!email || !password) { showError('Enter email and password.'); return; }

  $('btn-login').disabled = true;
  $('login-spinner').classList.remove('hidden');
  $('btn-login').querySelector('.btn-text').textContent = 'Signing in…';
  hide('login-error');

  try {
    const { ok, data } = await apiCall(serverUrl, '/api/auth/login', 'POST', { email, password });
    if (!ok) { showError(data.detail || 'Login failed.'); return; }
    await storageSet({ serverUrl, token: data.access_token, userEmail: data.user?.email || email, loggedIn: true });
    await loadDashboard(serverUrl, data.access_token, data.user?.email || email);
  } catch (err) {
    showError(`Cannot reach server: ${err.message}`);
  } finally {
    $('btn-login').disabled = false;
    $('login-spinner').classList.add('hidden');
    $('btn-login').querySelector('.btn-text').textContent = 'Sign In';
  }
}

function showError(msg) {
  const el = $('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Dashboard ──────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(`screen-${name}`)?.classList.remove('hidden');
}

async function loadDashboard(serverUrl, token, email) {
  showScreen('main');
  $('user-email-display').textContent = email;
  addLog('Logged in. Loading profile…', 'info');
  await loadProfile(serverUrl, token);
  await loadSettings();
  $('last-refresh').textContent = `Refreshed ${timeStr()}`;
}

async function loadProfile(serverUrl, token) {
  try {
    const { ok, data } = await apiCall(serverUrl, '/api/profile/me', 'GET', null, token);
    if (!ok) { addLog(`Profile error: ${data.detail}`, 'err'); return; }

    const profile  = data.profile  || {};
    const prefs    = data.job_preferences || {};

    const name    = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';
    $('profile-avatar').textContent = name[0]?.toUpperCase() || '?';
    $('profile-name').textContent   = name;
    $('profile-meta').textContent   =
      `${profile.current_city || ''}${profile.current_city && profile.country ? ', ' : ''}${profile.country || ''}` +
      (profile.years_of_experience ? ` · ${profile.years_of_experience}yr exp` : '');

    const terms = prefs.search_terms || [];
    if (terms.length) $('profile-meta').textContent += ` | 🔍 ${terms.slice(0, 2).join(', ')}${terms.length > 2 ? '…' : ''}`;

    show('profile-card');

    const missing = [];
    if (!profile.first_name)   missing.push('First name');
    if (!profile.last_name)    missing.push('Last name');
    if (!profile.phone_number) missing.push('Phone');
    if (!terms.length)         missing.push('Search terms (Job Preferences)');

    if (missing.length) {
      $('profile-status-badge').innerHTML = '<span class="dot dot-yellow"></span> Incomplete';
      addLog(`⚠ Missing: ${missing.join(', ')}`, 'warn');
    } else {
      $('profile-status-badge').innerHTML = '<span class="dot dot-green"></span> Ready';
      addLog(`✓ Profile: ${name}`, 'ok');
      if (terms.length) addLog(`🔍 Will search: ${terms.slice(0, 3).join(', ')}`, 'info');
    }

    await storageSet({ profileData: data });
  } catch (err) {
    addLog(`Profile error: ${err.message}`, 'err');
  }
}

async function loadSettings() {
  const s = await storageGet(['dryRun','coverLetter','humanMode','maxApps']);
  $('opt-dry-run').checked      = s.dryRun      !== false;
  $('opt-cover-letter').checked = s.coverLetter  !== false;
  $('opt-human-mode').checked   = s.humanMode    !== false;
  $('opt-max-apps').value       = s.maxApps      || 20;
}

async function saveSettings() {
  await storageSet({
    dryRun:      $('opt-dry-run').checked,
    coverLetter: $('opt-cover-letter').checked,
    humanMode:   $('opt-human-mode').checked,
    maxApps:     parseInt($('opt-max-apps').value) || 20,
  });
}

// ── Start bot ─────────────────────────────────────────────────────
async function startBot() {
  const stored = await storageGet(['serverUrl','token','profileData','dryRun','coverLetter','humanMode','maxApps']);
  if (!stored.token)       { addLog('Not logged in', 'err'); return; }
  if (!stored.profileData) { addLog('Profile not loaded — click Refresh Profile', 'err'); return; }

  const profile  = stored.profileData.profile || {};
  const prefs    = stored.profileData.job_preferences || {};
  const accounts = stored.profileData.platform_accounts || {};

  if (!profile.first_name) { addLog('First name missing in profile', 'err'); return; }

  const terms = (prefs.search_terms || []).filter(Boolean);
  if (!terms.length) {
    addLog('❌ No job search terms! Go to SmartApply → Profile → Job Preferences and add search terms', 'err');
    return;
  }

  await saveSettings();

  const config = {
    serverUrl:   stored.serverUrl,
    token:       stored.token,
    profile,
    jobPrefs:    prefs,
    accounts,
    dryRun:      stored.dryRun !== false,
    coverLetter: stored.coverLetter !== false,
    humanMode:   stored.humanMode !== false,
    maxApps:     parseInt(stored.maxApps) || 20,
    userEmail:   stored.userEmail,
    _resumeTermIndex: 0,
  };

  await storageSet({ botConfig: config, botRunning: true, botStats: { applied:0, skipped:0, errors:0, letters:0 } });

  setStatus('Starting…', 'running');
  show('btn-stop'); hide('btn-start');

  const firstTerm = terms[0];
  addLog(`Bot starting — searching: "${firstTerm}"`, 'ok');
  addLog(`${config.dryRun ? '🔒 Dry Run' : '🚀 LIVE'} mode`, 'info');

  const searchUrl = buildSearchUrl(prefs, 0);
  addLog(`Opening: ${searchUrl.slice(0, 65)}...`, 'info');

  try {
    const liTabs = await chrome.tabs.query({ url: '*://www.linkedin.com/jobs/*' });
    if (liTabs.length > 0) {
      await chrome.tabs.update(liTabs[0].id, { url: searchUrl, active: true });
      addLog(`Navigating existing tab to search results…`, 'ok');
    } else {
      chrome.tabs.create({ url: searchUrl });
      addLog('Opened LinkedIn Jobs search tab. Bot will start automatically.', 'ok');
    }
  } catch (err) {
    addLog(`Tab error: ${err.message} — storage polling will start it`, 'warn');
  }
}

function buildSearchUrl(jobPrefs, index) {
  const terms    = (jobPrefs?.search_terms || []).filter(Boolean);
  const keyword  = terms[index] || 'Software Engineer';
  const location = jobPrefs?.search_location || 'India';

  const params = new URLSearchParams({ keywords: keyword, location, f_LF: 'f_AL', sortBy: 'DD' });

  const expMap = { 'Internship':'1','Entry level':'2','Associate':'3','Mid-Senior level':'4','Director':'5','Executive':'6' };
  const expLevels = (jobPrefs?.experience_level || []).map(e => expMap[e]).filter(Boolean);
  if (expLevels.length) params.set('f_E', expLevels.join(','));

  const workMap = { 'On-site':'1','Remote':'2','Hybrid':'3' };
  const workTypes = (jobPrefs?.on_site || []).map(w => workMap[w]).filter(Boolean);
  if (workTypes.length) params.set('f_WT', workTypes.join(','));

  const dateMap = { 'Past 24 hours':'r86400','Past week':'r604800','Past month':'r2592000' };
  const dateFilter = dateMap[jobPrefs?.date_posted];
  if (dateFilter) params.set('f_TPR', dateFilter);

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function stopBot() {
  const stored = await storageGet(['serverUrl','token']);
  await storageSet({ botRunning: false });
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/jobs/*' });
    for (const tab of tabs) chrome.tabs.sendMessage(tab.id, { type:'BOT_STOP' }).catch(()=>{});
  } catch {}
  setStatus('Stopped', 'idle'); hide('btn-stop'); show('btn-start');
  addLog('Bot stopped', 'warn');
}

// ── Message listener ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BOT_LOG')    addLog(msg.text, msg.level || 'info');
  if (msg.type === 'BOT_STATS')  updateStats(msg.stats);
  if (msg.type === 'BOT_STATUS') {
    if (msg.running) { setStatus('Bot running…', 'running'); }
    else { setStatus('Done ✓', 'success'); hide('btn-stop'); show('btn-start'); }
  }
});

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  const stored = await storageGet(['loggedIn','serverUrl','token','userEmail','botRunning']);
  if (stored.loggedIn && stored.token) {
    await loadDashboard(stored.serverUrl, stored.token, stored.userEmail);
    if (stored.botRunning) {
      setStatus('Bot running…', 'running'); show('btn-stop'); hide('btn-start');
    }
  } else {
    showScreen('login');
    const sv = await storageGet(['serverUrl']);
    if (sv.serverUrl) $('server-url').value = sv.serverUrl;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  $('btn-login').addEventListener('click', doLogin);
  $('login-password').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
  $('btn-logout').addEventListener('click', async () => {
    await storageSet({ loggedIn:false, token:null, profileData:null, botRunning:false });
    logEntries=[]; showScreen('login');
  });
  $('btn-start').addEventListener('click', startBot);
  $('btn-stop').addEventListener('click', stopBot);
  $('btn-clear-log').addEventListener('click', () => { logEntries=[]; renderLog(); });
  $('btn-refresh-profile').addEventListener('click', async () => {
    const s = await storageGet(['serverUrl','token']);
    if (s.token) { addLog('Refreshing…','info'); await loadProfile(s.serverUrl, s.token); $('last-refresh').textContent=`Refreshed ${timeStr()}`; }
  });
  ['opt-dry-run','opt-cover-letter','opt-human-mode'].forEach(id => $(id)?.addEventListener('change',saveSettings));
  $('opt-max-apps')?.addEventListener('change',saveSettings);
});
