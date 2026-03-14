// popup.js — SmartApply Extension Popup

let serverUrl = '';
let authToken = '';
let running = false;
let stats = { applied: 0, skipped: 0, failed: 0 };
let logLines = [];

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await getStorage(['serverUrl', 'authToken', 'userEmail', 'searchTerm', 'searchLoc', 'maxJobs', 'easyOnly', 'datePosted', 'botRunning', 'stats', 'logLines']);
  
  if (stored.serverUrl && stored.authToken) {
    serverUrl = stored.serverUrl;
    authToken = stored.authToken;
    document.getElementById('server-url').value = serverUrl;
    document.getElementById('auth-token').value = authToken;
    showMain();
    if (stored.userEmail) document.getElementById('user-email').textContent = stored.userEmail;
    if (stored.searchTerm) document.getElementById('search-term').value = stored.searchTerm;
    if (stored.searchLoc)  document.getElementById('search-loc').value = stored.searchLoc;
    if (stored.maxJobs)    document.getElementById('max-jobs').value = stored.maxJobs;
    if (stored.datePosted) document.getElementById('date-posted').value = stored.datePosted;
    if (typeof stored.easyOnly !== 'undefined') document.getElementById('easy-only').checked = stored.easyOnly;
    if (stored.stats)    { stats = stored.stats; renderStats(); }
    if (stored.logLines) { logLines = stored.logLines; renderLog(); }
    if (stored.botRunning) setRunning(true);
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'BOT_LOG')   addLog(msg.text, msg.level);
    if (msg.type === 'BOT_STATS') { stats = msg.stats; renderStats(); saveStorage({ stats }); }
    if (msg.type === 'BOT_DONE')  setRunning(false);
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function connect() {
  const url   = document.getElementById('server-url').value.trim().replace(/\/$/, '');
  const token = document.getElementById('auth-token').value.trim();
  const msg   = document.getElementById('connect-msg');

  if (!url || !token) { msg.textContent = 'Please fill in both fields.'; msg.style.color = '#fca5a5'; return; }

  msg.textContent = 'Connecting…'; msg.style.color = '#94a3b8';

  try {
    const res = await fetch(`${url}/api/profile/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const profile = await res.json();
    const email = profile.email || profile.username || 'Connected';

    serverUrl = url; authToken = token;
    await saveStorage({ serverUrl, authToken, userEmail: email });
    document.getElementById('user-email').textContent = email;
    showMain();
    addLog(`Connected to ${url}`, 'ok');
  } catch (e) {
    msg.textContent = 'Connection failed: ' + e.message;
    msg.style.color = '#fca5a5';
  }
}

function disconnect() {
  chrome.storage.local.clear(() => { location.reload(); });
}

// ── Bot control ───────────────────────────────────────────────────────────────
async function startBot() {
  const term    = document.getElementById('search-term').value.trim();
  const loc     = document.getElementById('search-loc').value.trim() || 'India';
  const maxJobs = parseInt(document.getElementById('max-jobs').value) || 20;
  const easyOnly = document.getElementById('easy-only').checked;
  const datePosted = document.getElementById('date-posted').value;

  if (!term) { addLog('Please enter a job search term.', 'err'); return; }

  // Save settings
  await saveStorage({ searchTerm: term, searchLoc: loc, maxJobs, easyOnly, datePosted, botRunning: true });
  stats = { applied: 0, skipped: 0, failed: 0 };
  renderStats();
  setRunning(true);

  // Get or create LinkedIn jobs tab
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  let tab;
  if (tabs.length > 0) {
    tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
  } else {
    tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
    await new Promise(r => setTimeout(r, 3000)); // wait for page load
  }

  // Send start command to content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_BOT',
      config: { term, loc, maxJobs, easyOnly, datePosted, serverUrl, authToken }
    });
    addLog(`Starting: searching "${term}" in ${loc}`, 'ok');
  } catch (e) {
    addLog('Could not reach LinkedIn tab. Make sure LinkedIn is open.', 'err');
    setRunning(false);
  }
}

async function stopBot() {
  await saveStorage({ botRunning: false });
  setRunning(false);
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_BOT' }).catch(() => {});
  }
  addLog('Bot stopped by user.', 'warn');
}

function openLinkedIn() {
  chrome.runtime.sendMessage({ type: 'OPEN_LINKEDIN' });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showMain() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-section').style.display = 'block';
}

function setRunning(isRunning) {
  running = isRunning;
  document.getElementById('run-btn').style.display  = isRunning ? 'none' : 'block';
  document.getElementById('stop-btn').style.display = isRunning ? 'block' : 'none';
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  dot.className  = 'dot' + (isRunning ? ' running' : '');
  text.textContent = isRunning ? 'Running…' : 'Ready';
  saveStorage({ botRunning: isRunning });
}

function renderStats() {
  document.getElementById('stat-applied').textContent = stats.applied;
  document.getElementById('stat-skipped').textContent = stats.skipped;
  document.getElementById('stat-failed').textContent  = stats.failed;
}

function addLog(text, level = '') {
  const ts = new Date().toLocaleTimeString();
  logLines.push({ ts, text, level });
  if (logLines.length > 200) logLines.shift();
  renderLog();
  saveStorage({ logLines });
}

function renderLog() {
  const el = document.getElementById('log');
  el.innerHTML = logLines.map(l => {
    const cls = l.level ? ` class="${l.level}"` : '';
    return `<div${cls}>[${l.ts}] ${escHtml(l.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function clearLog() { logLines = []; renderLog(); saveStorage({ logLines }); }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function saveStorage(obj) {
  return new Promise(r => chrome.storage.local.set(obj, r));
}
function getStorage(keys) {
  return new Promise(r => chrome.storage.local.get(keys, r));
}
