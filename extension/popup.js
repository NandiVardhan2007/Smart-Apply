// popup.js — SmartApply Extension (no inline handlers)

let serverUrl = '';
let authToken = '';
let running   = false;
let stats     = { applied: 0, skipped: 0, failed: 0 };
let logLines  = [];

// ── Wire up ALL event listeners here (CSP requires no inline onclick) ─────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('connect-btn')   .addEventListener('click', connect);
  document.getElementById('run-btn')       .addEventListener('click', startBot);
  document.getElementById('stop-btn')      .addEventListener('click', stopBot);
  document.getElementById('linkedin-btn')  .addEventListener('click', openLinkedIn);
  document.getElementById('disconnect-btn').addEventListener('click', disconnect);
  document.getElementById('clear-log-btn') .addEventListener('click', clearLog);

  // Restore saved state
  const s = await getStorage([
    'serverUrl','authToken','userEmail','searchTerm','searchLoc',
    'maxJobs','easyOnly','datePosted','botRunning','stats','logLines'
  ]);

  if (s.serverUrl && s.authToken) {
    serverUrl = s.serverUrl;
    authToken = s.authToken;
    restoreForm(s);
    showMain(s.userEmail || s.serverUrl);
    if (s.stats)    { stats = s.stats; renderStats(); }
    if (s.logLines) { logLines = s.logLines; renderLog(); }
    if (s.botRunning) setRunning(true);
  }

  // Relay messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'BOT_LOG')   addLog(msg.text, msg.level);
    if (msg.type === 'BOT_STATS') { stats = msg.stats; renderStats(); saveStorage({ stats }); }
    if (msg.type === 'BOT_DONE')  setRunning(false);
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function connect() {
  const url   = (document.getElementById('server-url').value || '').trim().replace(/\/$/, '');
  const token = (document.getElementById('auth-token').value || '').trim();
  const btn   = document.getElementById('connect-btn');

  if (!url) { showMsg('Please enter your server URL.', 'err'); return; }
  if (!token) { showMsg('Please paste your auth token.\nGet it from the dashboard → 📋 Copy Token button.', 'err'); return; }
  if (!url.startsWith('http')) { showMsg('URL must start with https://', 'err'); return; }

  btn.disabled    = true;
  btn.textContent = 'Saving…';
  showMsg('Saving…', '');

  serverUrl = url;
  authToken = token;
  await saveStorage({ serverUrl, authToken });

  btn.disabled    = false;
  btn.textContent = 'Connect & Save';

  showMain(url);
  addLog('Settings saved ✓', 'ok');

  // Verify connection in background
  verifyConnection(url, token);
}

async function verifyConnection(url, token) {
  try {
    const res = await fetch(`${url}/api/profile/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const p = await res.json();
      const label = p.email || p.full_name || p.username || 'Connected ✓';
      await saveStorage({ userEmail: label });
      document.getElementById('user-email').textContent = label;
      addLog('Verified: ' + label, 'ok');
    } else {
      addLog(`Server returned ${res.status} — double-check your token.`, 'warn');
    }
  } catch (e) {
    addLog('Could not reach server: ' + e.message, 'warn');
  }
}

function disconnect() {
  chrome.storage.local.clear(() => location.reload());
}

// ── Bot control ───────────────────────────────────────────────────────────────
async function startBot() {
  const term      = (document.getElementById('search-term').value || '').trim();
  const loc       = (document.getElementById('search-loc').value  || '').trim() || 'India';
  const maxJobs   = parseInt(document.getElementById('max-jobs').value) || 20;
  const easyOnly  = document.getElementById('easy-only').checked;
  const datePosted = document.getElementById('date-posted').value;

  if (!term) { addLog('⚠ Enter a job search term first.', 'err'); return; }

  await saveStorage({ searchTerm: term, searchLoc: loc, maxJobs, easyOnly, datePosted, botRunning: true });
  stats = { applied: 0, skipped: 0, failed: 0 };
  renderStats();
  setRunning(true);
  addLog(`Starting: "${term}" in ${loc}`, 'ok');

  const cfg = { term, loc, maxJobs, easyOnly, datePosted, serverUrl, authToken };

  // Get or open LinkedIn tab
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  let tab;
  if (tabs.length > 0) {
    tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
  } else {
    tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
    await waitForTabLoad(tab.id);
  }

  // Send message; if content script not injected yet, inject it first
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'START_BOT', config: cfg });
  } catch (_) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await sleep(600);
      await chrome.tabs.sendMessage(tab.id, { type: 'START_BOT', config: cfg });
    } catch (e2) {
      addLog('Failed to start: ' + e2.message, 'err');
      setRunning(false);
    }
  }
}

async function stopBot() {
  await saveStorage({ botRunning: false });
  setRunning(false);
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  tabs.forEach(t => chrome.tabs.sendMessage(t.id, { type: 'STOP_BOT' }).catch(() => {}));
  addLog('Bot stopped.', 'warn');
}

function openLinkedIn() {
  chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showMain(label) {
  document.getElementById('auth-section').style.display  = 'none';
  document.getElementById('main-section').style.display  = 'block';
  if (label) document.getElementById('user-email').textContent = label;
}

function showMsg(text, type) {
  const el = document.getElementById('connect-msg');
  el.textContent  = text;
  el.style.display = 'block';
  el.style.color  = type === 'err' ? '#fca5a5' : '#94a3b8';
}

function setRunning(isRunning) {
  running = isRunning;
  document.getElementById('run-btn') .style.display = isRunning ? 'none'  : 'block';
  document.getElementById('stop-btn').style.display = isRunning ? 'block' : 'none';
  document.getElementById('status-dot') .className  = 'dot' + (isRunning ? ' running' : '');
  document.getElementById('status-text').textContent = isRunning ? 'Running…' : 'Ready';
  saveStorage({ botRunning: isRunning });
}

function renderStats() {
  document.getElementById('stat-applied').textContent = stats.applied;
  document.getElementById('stat-skipped').textContent = stats.skipped;
  document.getElementById('stat-failed') .textContent = stats.failed;
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
    const c = l.level ? ` class="${l.level}"` : '';
    return `<div${c}>[${l.ts}] ${esc(l.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function clearLog() { logLines = []; renderLog(); saveStorage({ logLines }); }

function restoreForm(s) {
  if (s.searchTerm) document.getElementById('search-term').value  = s.searchTerm;
  if (s.searchLoc)  document.getElementById('search-loc').value   = s.searchLoc;
  if (s.maxJobs)    document.getElementById('max-jobs').value     = s.maxJobs;
  if (s.datePosted) document.getElementById('date-posted').value  = s.datePosted;
  if (typeof s.easyOnly !== 'undefined') document.getElementById('easy-only').checked = s.easyOnly;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function saveStorage(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }
function getStorage(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function check(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(check);
        setTimeout(resolve, 1000);
      }
    }
    chrome.tabs.onUpdated.addListener(check);
    setTimeout(resolve, 8000); // fallback
  });
}
