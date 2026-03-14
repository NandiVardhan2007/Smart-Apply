// popup.js — SmartApply Extension Popup

let serverUrl = '';
let authToken = '';
let running = false;
let stats = { applied: 0, skipped: 0, failed: 0 };
let logLines = [];

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await getStorage([
    'serverUrl','authToken','userEmail','searchTerm','searchLoc',
    'maxJobs','easyOnly','datePosted','botRunning','stats','logLines'
  ]);

  if (stored.serverUrl && stored.authToken) {
    serverUrl = stored.serverUrl;
    authToken = stored.authToken;
    fillForm(stored);
    showMain(stored.userEmail || stored.serverUrl);
    if (stored.stats)    { stats = stored.stats; renderStats(); }
    if (stored.logLines) { logLines = stored.logLines; renderLog(); }
    if (stored.botRunning) setRunning(true);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'BOT_LOG')   addLog(msg.text, msg.level);
    if (msg.type === 'BOT_STATS') { stats = msg.stats; renderStats(); saveStorage({ stats }); }
    if (msg.type === 'BOT_DONE')  setRunning(false);
  });
});

function fillForm(stored) {
  if (stored.searchTerm) document.getElementById('search-term').value = stored.searchTerm;
  if (stored.searchLoc)  document.getElementById('search-loc').value  = stored.searchLoc;
  if (stored.maxJobs)    document.getElementById('max-jobs').value    = stored.maxJobs;
  if (stored.datePosted) document.getElementById('date-posted').value = stored.datePosted;
  if (typeof stored.easyOnly !== 'undefined') {
    document.getElementById('easy-only').checked = stored.easyOnly;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function connect() {
  const url   = document.getElementById('server-url').value.trim().replace(/\/$/, '');
  const token = document.getElementById('auth-token').value.trim();
  const msgEl = document.getElementById('connect-msg');
  const btn   = document.getElementById('connect-btn');

  msgEl.style.display = 'block';

  if (!url) {
    msgEl.textContent = '⚠ Please enter your server URL.';
    msgEl.style.color = '#fca5a5';
    return;
  }
  if (!token) {
    msgEl.textContent = '⚠ Please paste your auth token (copy it from the dashboard using the 📋 Copy Token button).';
    msgEl.style.color = '#fca5a5';
    return;
  }
  if (!url.startsWith('http')) {
    msgEl.textContent = '⚠ URL must start with https://';
    msgEl.style.color = '#fca5a5';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  msgEl.textContent = 'Saving settings…';
  msgEl.style.color = '#94a3b8';

  // Save immediately — don't require a server round-trip which can fail due to CORS in popup context
  serverUrl = url;
  authToken = token;
  await saveStorage({ serverUrl, authToken });

  // Try to verify in background (non-blocking)
  verifyInBackground(url, token);

  btn.disabled = false;
  btn.textContent = 'Connect & Save';
  showMain(url);
  addLog('Settings saved. Verifying connection…', 'ok');
}

async function verifyInBackground(url, token) {
  try {
    const res = await fetch(`${url}/api/profile/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const profile = await res.json();
      const email = profile.email || profile.full_name || 'Connected ✓';
      await saveStorage({ userEmail: email });
      document.getElementById('user-email').textContent = email;
      addLog(`Connected as: ${email}`, 'ok');
    } else {
      addLog(`Server returned ${res.status} — check your token is correct.`, 'warn');
    }
  } catch (e) {
    addLog(`Could not reach server (${e.message}) — check the URL.`, 'warn');
  }
}

function disconnect() {
  chrome.storage.local.clear(() => location.reload());
}

// ── Bot control ───────────────────────────────────────────────────────────────
async function startBot() {
  const term     = document.getElementById('search-term').value.trim();
  const loc      = document.getElementById('search-loc').value.trim() || 'India';
  const maxJobs  = parseInt(document.getElementById('max-jobs').value) || 20;
  const easyOnly = document.getElementById('easy-only').checked;
  const datePosted = document.getElementById('date-posted').value;

  if (!term) { addLog('⚠ Please enter a job search term first.', 'err'); return; }

  await saveStorage({ searchTerm: term, searchLoc: loc, maxJobs, easyOnly, datePosted, botRunning: true });
  stats = { applied: 0, skipped: 0, failed: 0 };
  renderStats();
  setRunning(true);
  addLog(`Starting: "${term}" in ${loc}`, 'ok');

  // Find existing LinkedIn tab or open one
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  let tab;
  if (tabs.length > 0) {
    tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
  } else {
    tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
    // Wait for it to load before sending message
    await waitForTab(tab.id);
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_BOT',
      config: { term, loc, maxJobs, easyOnly, datePosted, serverUrl, authToken }
    });
  } catch (e) {
    // Content script may not be ready yet — inject it
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await sleep(500);
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_BOT',
        config: { term, loc, maxJobs, easyOnly, datePosted, serverUrl, authToken }
      });
    } catch (e2) {
      addLog('Could not start on LinkedIn tab: ' + e2.message, 'err');
      setRunning(false);
    }
  }
}

async function stopBot() {
  await saveStorage({ botRunning: false });
  setRunning(false);
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_BOT' }).catch(() => {});
  }
  addLog('Bot stopped.', 'warn');
}

function openLinkedIn() {
  chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
}

function waitForTab(tabId) {
  return new Promise(resolve => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000); // extra settle
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 8000); // fallback
  });
}

// ── UI ────────────────────────────────────────────────────────────────────────
function showMain(label) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-section').style.display = 'block';
  if (label) document.getElementById('user-email').textContent = label;
}

function setRunning(isRunning) {
  running = isRunning;
  document.getElementById('run-btn').style.display  = isRunning ? 'none'  : 'block';
  document.getElementById('stop-btn').style.display = isRunning ? 'block' : 'none';
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  dot.className    = 'dot' + (isRunning ? ' running' : '');
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
  if (!el) return;
  el.innerHTML = logLines.map(l => {
    const cls = l.level ? ` class="${l.level}"` : '';
    return `<div${cls}>[${l.ts}] ${esc(l.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function clearLog() { logLines = []; renderLog(); saveStorage({ logLines }); }

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Storage ───────────────────────────────────────────────────────────────────
function saveStorage(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }
function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
