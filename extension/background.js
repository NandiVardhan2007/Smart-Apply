// SmartApply Extension – Background Service Worker v2

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SmartApply] Extension installed/updated');
});

// Relay BOT_LOG / BOT_STATS / BOT_STATUS from content → popup
// Use a single listener — no duplication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (['BOT_LOG', 'BOT_STATS', 'BOT_STATUS'].includes(message.type)) {
    // Only relay to popup, not back to content scripts
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  sendResponse({ ok: true });
  return false;
});
