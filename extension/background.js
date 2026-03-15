// ════════════════════════════════════════════════════════════════
//  SmartApply Extension – Background Service Worker v2
// ════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartApply] Extension installed/updated');
});

// Relay BOT_LOG / BOT_STATS / BOT_STATUS from content → popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (['BOT_LOG', 'BOT_STATS', 'BOT_STATUS'].includes(message.type)) {
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  // API proxy: content script can ask background to make API calls
  if (message.type === 'API_CALL') {
    const { url, method, body, token } = message.payload || {};
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method: method || 'GET', headers };
    if (body) opts.body = JSON.stringify(body);

    fetch(url, opts)
      .then(r => r.json())
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  sendResponse({ ok: true });
  return false;
});
