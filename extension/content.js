// content.js — SmartApply Extension Content Script
// Runs on linkedin.com pages. Receives START_BOT from popup, applies to jobs.

let botRunning = false;
let config = {};
let stats = { applied: 0, skipped: 0, failed: 0 };
let appliedIds = new Set();

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_BOT') {
    config = msg.config;
    if (!botRunning) startBot();
    sendResponse({ ok: true });
  }
  if (msg.type === 'STOP_BOT') {
    botRunning = false;
    log('Bot stopped.', 'warn');
    sendResponse({ ok: true });
  }
  return true;
});

// ── Entry point ───────────────────────────────────────────────────────────────
async function startBot() {
  botRunning = true;
  stats = { applied: 0, skipped: 0, failed: 0 };
  appliedIds = new Set();

  log(`Starting bot — searching "${config.term}" in ${config.loc}`, 'ok');

  // Build search URL with filters
  const params = new URLSearchParams({
    keywords: config.term,
    location: config.loc,
    sortBy: 'DD',
    f_TPR: config.datePosted || 'r2592000',
  });
  if (config.easyOnly) params.set('f_AL', 'true');

  const searchUrl = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  log(`Navigating to: ${searchUrl.substring(0, 80)}...`);
  window.location.href = searchUrl;
}

// ── Main loop — runs after page loads ─────────────────────────────────────────
async function runBotLoop() {
  if (!botRunning) return;

  log('Page loaded — scanning for job cards...');
  await sleep(2000);

  // Scroll to load all cards
  await scrollPage();

  const cards = getJobCards();
  log(`Found ${cards.length} job cards on this page.`);

  if (cards.length === 0) {
    log('No job cards found — check if you are on a LinkedIn jobs search page.', 'warn');
    botRunning = false;
    notifyDone();
    return;
  }

  for (let i = 0; i < cards.length && botRunning; i++) {
    if (stats.applied >= (config.maxJobs || 20)) {
      log(`Reached max jobs limit (${config.maxJobs}). Stopping.`, 'ok');
      break;
    }

    const card = cards[i];
    const jobId = card.getAttribute('data-occludable-job-id') ||
                  card.getAttribute('data-job-id') || 
                  card.querySelector('[data-occludable-job-id]')?.getAttribute('data-occludable-job-id');

    if (!jobId || appliedIds.has(jobId)) continue;
    appliedIds.add(jobId);

    try {
      await processJobCard(card, jobId);
    } catch (e) {
      log(`Error processing job ${jobId}: ${e.message}`, 'err');
      stats.failed++;
      notifyStats();
      await closeModal();
    }

    await sleep(1500 + Math.random() * 1000);
  }

  log(`Done! Applied: ${stats.applied} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`, 'ok');
  botRunning = false;
  notifyDone();
}

// ── Process one job card ──────────────────────────────────────────────────────
async function processJobCard(card, jobId) {
  // Click the card to open job details
  const link = card.querySelector('a[href*="/jobs/view/"]') || card.querySelector('a');
  if (!link) { stats.skipped++; return; }

  link.click();
  await sleep(2000);

  // Get job title and company from the detail pane
  const titleEl   = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24');
  const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
  const title   = titleEl?.textContent?.trim() || 'Unknown Title';
  const company = companyEl?.textContent?.trim() || 'Unknown Company';

  log(`[${stats.applied + stats.skipped + stats.failed + 1}] ${title} @ ${company}`);

  // Find Easy Apply button
  const easyApplyBtn = findEasyApplyButton();
  if (!easyApplyBtn) {
    log(`  → No Easy Apply button — skipping.`, 'warn');
    stats.skipped++;
    notifyStats();
    return;
  }

  easyApplyBtn.click();
  await sleep(1500);

  // Fill the Easy Apply modal
  const applied = await fillEasyApplyModal(title, company);
  if (applied) {
    log(`  → Applied ✓`, 'ok');
    stats.applied++;
    // Report to server
    await reportToServer(title, company, jobId);
  } else {
    log(`  → Could not complete application — skipping.`, 'warn');
    stats.skipped++;
    await closeModal();
  }
  notifyStats();
}

// ── Easy Apply modal handler ──────────────────────────────────────────────────
async function fillEasyApplyModal(jobTitle, company) {
  const maxSteps = 10;
  for (let step = 0; step < maxSteps && botRunning; step++) {
    await sleep(1000);

    const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal]');
    if (!modal) return false;

    // Check if submit button is present (final step)
    const submitBtn = findButton(modal, ['Submit application', 'Submit']);
    if (submitBtn) {
      submitBtn.click();
      await sleep(1500);
      // Check for success
      const successEl = document.querySelector('.artdeco-inline-feedback--success, .jobs-post-apply-experience');
      if (successEl || !document.querySelector('.jobs-easy-apply-modal')) return true;
      return true; // assume success if modal closed
    }

    // Fill all inputs on current step
    await fillFormFields(modal, jobTitle, company);

    // Click Next
    const nextBtn = findButton(modal, ['Next', 'Continue', 'Review']);
    if (nextBtn) {
      nextBtn.click();
      await sleep(1200);
    } else {
      // No next/submit — something unexpected
      return false;
    }
  }
  return false;
}

async function fillFormFields(modal, jobTitle, company) {
  // Text inputs
  const inputs = modal.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea');
  for (const input of inputs) {
    if (input.value.trim()) continue; // already filled
    const label = getFieldLabel(input);
    if (!label) continue;
    const answer = await getAnswer(label, jobTitle, company);
    if (answer) {
      input.focus();
      input.value = answer;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
  }

  // Select dropdowns
  const selects = modal.querySelectorAll('select');
  for (const select of selects) {
    if (select.value && select.value !== '') continue;
    const label = getFieldLabel(select);
    const answer = await getAnswer(label, jobTitle, company);
    if (answer) {
      // Try to find an option that matches
      const opt = Array.from(select.options).find(o =>
        o.text.toLowerCase().includes(answer.toLowerCase()) ||
        answer.toLowerCase().includes(o.text.toLowerCase())
      );
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);
      }
    }
  }

  // Radio buttons — pick Yes/first option for required ones
  const radioGroups = {};
  modal.querySelectorAll('input[type="radio"]').forEach(r => {
    const name = r.name || r.getAttribute('data-test-text-selectable-option__input');
    if (name && !radioGroups[name]) radioGroups[name] = [];
    if (name) radioGroups[name].push(r);
  });
  for (const [, radios] of Object.entries(radioGroups)) {
    const checked = radios.find(r => r.checked);
    if (checked) continue;
    // Pick "Yes" or first option
    const yesOpt = radios.find(r => (r.nextElementSibling?.textContent || '').trim().toLowerCase() === 'yes');
    const pick = yesOpt || radios[0];
    if (pick) {
      pick.click();
      await sleep(150);
    }
  }
}

// ── AI answer helper ──────────────────────────────────────────────────────────
const answerCache = {};
async function getAnswer(label, jobTitle, company) {
  if (!label) return null;
  const key = label.toLowerCase().trim();

  // Common answers from cache
  if (answerCache[key]) return answerCache[key];

  // Local heuristics first — covers 90% of questions
  const lower = key;
  if (/years.*(experience|exp)/i.test(lower) || /experience.*years/i.test(lower)) return '0';
  if (/\b(phone|mobile|contact)\b/i.test(lower)) return '';
  if (/salary|compensation|expected/i.test(lower)) return '0';
  if (/\bnotice\b/i.test(lower) || /notice period/i.test(lower)) return '0';
  if (/city|location|where/i.test(lower)) return config.loc || 'India';
  if (/linkedin/i.test(lower)) return 'https://www.linkedin.com/';
  if (/github/i.test(lower)) return 'https://github.com/';
  if (/website|portfolio/i.test(lower)) return '';
  if (/\b(authorize|authorised|authorized|eligible|legally)\b/i.test(lower)) return 'Yes';
  if (/\b(sponsor)\b/i.test(lower)) return 'No';
  if (/\b(relocat)\b/i.test(lower)) return 'Yes';
  if (/\b(remote|hybrid|onsite)\b/i.test(lower)) return 'Yes';
  if (/\b(first name|fname)\b/i.test(lower)) return getStoredProfile('first_name') || '';
  if (/\b(last name|lname|surname)\b/i.test(lower)) return getStoredProfile('last_name') || '';
  if (/\bemail\b/i.test(lower)) return getStoredProfile('email') || '';

  // Ask AI if connected to server
  if (config.serverUrl && config.authToken) {
    try {
      const res = await fetch(`${config.serverUrl}/api/ai/answer-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.authToken,
        },
        body: JSON.stringify({ question: label, job_title: jobTitle, company }),
      });
      if (res.ok) {
        const data = await res.json();
        const ans = data.answer || data.text || '';
        if (ans) { answerCache[key] = ans; return ans; }
      }
    } catch (e) { /* offline, ignore */ }
  }

  return null;
}

function getStoredProfile(field) {
  // Try to get from chrome storage synchronously — we pre-load on start
  return window._smartapplyProfile?.[field] || null;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function getJobCards() {
  return Array.from(document.querySelectorAll(
    'li[data-occludable-job-id], li[data-job-id], li.jobs-search-results__list-item'
  ));
}

function findEasyApplyButton() {
  const btns = document.querySelectorAll('button, .jobs-apply-button');
  for (const btn of btns) {
    const txt = btn.textContent?.trim() || '';
    if (/easy apply/i.test(txt)) return btn;
  }
  // Also check for the specific class
  return document.querySelector('.jobs-apply-button--top-card, [data-job-id] .jobs-apply-button') || null;
}

function findButton(container, labels) {
  const btns = container.querySelectorAll('button');
  for (const btn of btns) {
    const txt = btn.textContent?.trim() || '';
    if (labels.some(l => txt.toLowerCase().includes(l.toLowerCase()))) return btn;
  }
  return null;
}

function getFieldLabel(el) {
  // Try aria-label, associated label, or placeholder
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent?.trim();
  }
  // Walk up to find a label
  let parent = el.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    const label = parent.querySelector('label, legend, .fb-dash-form-element__label');
    if (label && label !== el) return label.textContent?.trim();
    parent = parent.parentElement;
  }
  return el.placeholder || el.name || null;
}

async function closeModal() {
  const dismissBtn = document.querySelector('button[aria-label="Dismiss"], button[aria-label="Close"]');
  if (dismissBtn) {
    dismissBtn.click();
    await sleep(500);
    // Confirm discard if asked
    const discardBtn = findButton(document, ['Discard', 'Leave', 'Abandon']);
    if (discardBtn) { discardBtn.click(); await sleep(500); }
  }
}

async function scrollPage() {
  return new Promise(resolve => {
    let totalScrolled = 0;
    const step = 400;
    const interval = setInterval(() => {
      window.scrollBy(0, step);
      totalScrolled += step;
      if (totalScrolled >= 3000 || totalScrolled >= document.body.scrollHeight) {
        clearInterval(interval);
        window.scrollTo(0, 0);
        resolve();
      }
    }, 300);
  });
}

// ── Server reporting ──────────────────────────────────────────────────────────
async function reportToServer(title, company, jobId) {
  if (!config.serverUrl || !config.authToken) return;
  try {
    await fetch(`${config.serverUrl}/api/jobs/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.authToken,
      },
      body: JSON.stringify({
        platform: 'LinkedIn',
        job_title: title,
        company,
        job_link: `https://www.linkedin.com/jobs/view/${jobId}`,
        result: 'Applied',
      }),
    });
  } catch (e) { /* non-critical */ }
}

// ── Notify popup ──────────────────────────────────────────────────────────────
function log(text, level = '') {
  console.log(`[SmartApply] ${text}`);
  chrome.runtime.sendMessage({ type: 'BOT_LOG', text, level }).catch(() => {});
}
function notifyStats() {
  chrome.runtime.sendMessage({ type: 'BOT_STATS', stats }).catch(() => {});
}
function notifyDone() {
  chrome.runtime.sendMessage({ type: 'BOT_DONE' }).catch(() => {});
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Auto-run when navigated to jobs search page by bot ────────────────────────
(async () => {
  // Load profile from storage for form filling
  chrome.storage.local.get(['botRunning', 'serverUrl', 'authToken', 'searchTerm', 'searchLoc', 'maxJobs', 'easyOnly', 'datePosted'], async (data) => {
    if (!data.botRunning) return;
    if (!window.location.href.includes('/jobs/search/')) return;

    // Restore config
    config = {
      serverUrl: data.serverUrl || '',
      authToken: data.authToken || '',
      term:       data.searchTerm || '',
      loc:        data.searchLoc || 'India',
      maxJobs:    data.maxJobs || 20,
      easyOnly:   data.easyOnly !== false,
      datePosted: data.datePosted || 'r2592000',
    };

    botRunning = true;

    // Pre-load profile for form filling
    if (config.serverUrl && config.authToken) {
      try {
        const res = await fetch(`${config.serverUrl}/api/profile/me`, {
          headers: { 'Authorization': 'Bearer ' + config.authToken }
        });
        if (res.ok) {
          window._smartapplyProfile = await res.json();
        }
      } catch (e) {}
    }

    // Wait for page to fully load
    await sleep(3000);
    log('Page detected — starting job application loop.', 'ok');
    runBotLoop();
  });
})();
