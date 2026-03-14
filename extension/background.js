// background.js — SmartApply Extension Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartApply] Extension installed.');
});

// Relay messages between popup and content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'API_CALL') {
    handleApiCall(msg).then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async
  }
  if (msg.type === 'OPEN_LINKEDIN') {
    chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/search/' });
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(['botState', 'stats'], data => sendResponse(data));
    return true;
  }
});

async function handleApiCall({ url, method, body, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, {
    method: method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
