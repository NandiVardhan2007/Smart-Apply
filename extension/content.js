// Cross-browser shim — must be first
if(typeof browser!=='undefined'&&typeof chrome==='undefined'){globalThis.chrome=browser;}

// ════════════════════════════════════════════════════════════════
//  SmartApply Extension – Content Script v3
// ════════════════════════════════════════════════════════════════

'use strict';

let BOT_RUNNING = false;
let CONFIG      = null;
let STATS       = { applied: 0, skipped: 0, errors: 0, letters: 0 };
let COVER_LETTER_CACHE = {};
let LOG_ENTRIES = [];
let _lastStorageRunning = false;
let _easyApplyFilterActive = false;

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════

(async () => {
  await sleep(1500);
  injectPanel();

  const stored = await storageGet(['botRunning', 'botConfig']);
  if (stored.botRunning && stored.botConfig) {
    panelLog('🤖 Auto-starting...', 'ok');
    await sleep(400);
    startBot(stored.botConfig);
  } else {
    panelLog('✅ SmartApply ready — click Start in the extension popup', 'ok');
    setStatus('idle');
  }

  setInterval(async () => {
    if (BOT_RUNNING) return;
    const s = await storageGet(['botRunning', 'botConfig']);
    if (s.botRunning && s.botConfig && !_lastStorageRunning) {
      _lastStorageRunning = true;
      panelLog('🤖 Start signal from popup', 'ok');
      await sleep(300);
      startBot(s.botConfig);
    } else if (!s.botRunning) {
      _lastStorageRunning = false;
    }
  }, 1500);
})();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'BOT_START' && !BOT_RUNNING) {
    panelLog('🤖 Start command received', 'ok');
    startBot(msg.config);
    sendResponse({ ok: true });
  }
  if (msg.type === 'BOT_STOP') {
    BOT_RUNNING = false;
    chrome.storage.local.set({ botRunning: false });
    panelLog('⏹ Stopped', 'warn');
    setStatus('idle');
    sendResponse({ ok: true });
  }
  return false;
});

// ════════════════════════════════════════════════════════════════
//  FLOATING PANEL
// ════════════════════════════════════════════════════════════════

function injectPanel() {
  if (document.getElementById('sa-panel')) return;
  const style = document.createElement('style');
  style.textContent = `
    #sa-panel{position:fixed;bottom:20px;right:20px;z-index:2147483647;width:340px;background:rgba(10,11,20,0.97);border:1px solid rgba(99,102,241,.4);border-radius:14px;box-shadow:0 10px 50px rgba(0,0,0,.8);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;font-size:12px;user-select:none;transition:opacity .2s;}
    #sa-panel.sa-mini #sa-body{display:none}
    #sa-head{display:flex;align-items:center;gap:7px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);cursor:move;}
    .sa-logo{font-size:15px;width:28px;height:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .sa-brand{font-weight:700;font-size:13px;flex:1;letter-spacing:-.2px}
    .sa-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .3s}
    .sd-idle{background:#475569}.sd-run{background:#6366f1;box-shadow:0 0 8px #6366f1;animation:sa-p 1.2s ease infinite}.sd-ok{background:#10b981;box-shadow:0 0 6px #10b981}.sd-err{background:#ef4444}
    @keyframes sa-p{0%,100%{opacity:1}50%{opacity:.3}}
    .sa-stxt{font-size:11px;color:#94a3b8;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sa-mbtn{background:none;border:none;color:#64748b;cursor:pointer;font-size:17px;padding:0 2px;line-height:1}.sa-mbtn:hover{color:#e2e8f0}
    #sa-body{padding:10px 14px;display:flex;flex-direction:column;gap:8px}
    #sa-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
    .sa-s{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:7px;padding:6px 4px;text-align:center}
    .sa-s span{display:block;font-size:17px;font-weight:700;line-height:1}.sa-s small{font-size:9px;color:#64748b;margin-top:2px;display:block}
    #sa-log{height:160px;overflow-y:auto;background:rgba(0,0,0,.35);border-radius:7px;padding:7px;font-family:'SF Mono',Consolas,monospace;font-size:10.5px;line-height:1.55;display:flex;flex-direction:column;gap:1px}
    #sa-log::-webkit-scrollbar{width:3px}#sa-log::-webkit-scrollbar-thumb{background:rgba(99,102,241,.35);border-radius:2px}
    .le{display:flex;gap:5px;align-items:flex-start}.lt{color:#475569;white-space:nowrap;flex-shrink:0;font-size:10px}
    .li{color:#a5b4fc}.lo{color:#6ee7b7}.lw{color:#fcd34d}.le2{color:#fca5a5}.la{color:#d8b4fe}
    #sa-cur{background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);border-radius:6px;padding:5px 8px;font-size:11px;color:#a5b4fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none}
    #sa-stop{width:100%;padding:7px;background:#ef4444;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:none}#sa-stop:hover{background:#dc2626}
  `;
  document.head.appendChild(style);
  const div = document.createElement('div');
  div.id = 'sa-panel';
  div.innerHTML = `<div id="sa-head"><div class="sa-logo">⚡</div><span class="sa-brand">SmartApply</span><div id="sa-sdot" class="sa-dot sd-idle"></div><span id="sa-stxt" class="sa-stxt">Idle</span><button class="sa-mbtn" id="sa-mbtn" title="Minimize">−</button></div><div id="sa-body"><div id="sa-stats"><div class="sa-s"><span id="sn-a">0</span><small>Applied</small></div><div class="sa-s"><span id="sn-s">0</span><small>Skipped</small></div><div class="sa-s"><span id="sn-e">0</span><small>Errors</small></div><div class="sa-s"><span id="sn-l">0</span><small>AI Ltrs</small></div></div><div id="sa-cur"></div><div id="sa-log"></div><button id="sa-stop">⏹ Stop Bot</button></div>`;
  document.body.appendChild(div);
  document.getElementById('sa-mbtn').onclick = e => { e.stopPropagation(); div.classList.toggle('sa-mini'); document.getElementById('sa-mbtn').textContent = div.classList.contains('sa-mini') ? '+' : '−'; };
  document.getElementById('sa-stop').onclick = () => { BOT_RUNNING = false; chrome.storage.local.set({ botRunning: false }); panelLog('⏹ Stopped', 'warn'); setStatus('idle'); };
  let drag=false, ox=0, oy=0;
  document.getElementById('sa-head').addEventListener('mousedown', e => { drag=true; const r=div.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top; e.preventDefault(); });
  document.addEventListener('mousemove', e => { if(!drag) return; div.style.left=(e.clientX-ox)+'px'; div.style.top=(e.clientY-oy)+'px'; div.style.right='auto'; div.style.bottom='auto'; });
  document.addEventListener('mouseup', ()=>{ drag=false; });
}

function panelLog(text, type='info') {
  const now = new Date().toLocaleTimeString('en-US',{hour12:false});
  const cls = {info:'li',ok:'lo',warn:'lw',err:'le2',ai:'la'}[type]||'li';
  LOG_ENTRIES.unshift({now,text,cls});
  if(LOG_ENTRIES.length>120) LOG_ENTRIES.pop();
  const box=document.getElementById('sa-log');
  if(box) box.innerHTML=LOG_ENTRIES.map(e=>`<div class="le"><span class="lt">${e.now}</span><span class="${e.cls}">${esc(e.text)}</span></div>`).join('');
  chrome.runtime.sendMessage({type:'BOT_LOG',text,level:type}).catch(()=>{});
}

function setStatus(state, text) {
  const labels={idle:'Idle',running:'Running…',ok:'Done ✓',err:'Error'};
  const d=document.getElementById('sa-sdot'); const t=document.getElementById('sa-stxt');
  if(d) d.className='sa-dot sd-'+state;
  if(t) t.textContent=text||labels[state]||state;
  const s=document.getElementById('sa-stop');
  if(s) s.style.display=state==='running'?'block':'none';
}

function setCurrentJob(text) {
  const el=document.getElementById('sa-cur');
  if(!el) return;
  if(text){ el.textContent='▶ '+text; el.style.display='block'; } else el.style.display='none';
}

function updateStats() {
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('sn-a',STATS.applied); s('sn-s',STATS.skipped); s('sn-e',STATS.errors); s('sn-l',STATS.letters);
  chrome.runtime.sendMessage({type:'BOT_STATS',stats:{...STATS}}).catch(()=>{});
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function storageGet(keys){ return new Promise(r=>chrome.storage.local.get(keys,r)); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function humanDelay(min=400,max=1200){
  if(!CONFIG?.humanMode) return sleep(Math.min(min,300));
  const base=min+Math.random()*(max-min);
  const think=Math.random()<0.06 ? 800+Math.random()*1600 : 0;
  return sleep(Math.max(80,base+think));
}

async function smoothScrollTo(el){
  if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'center'}); await sleep(180);
}

async function humanClick(el){
  if(!el) throw new Error('Cannot click null');
  await smoothScrollTo(el);
  el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  await sleep(20+Math.random()*30);
  el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  el.click();
  await sleep(40);
}

function setNative(el,val){
  const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
  if(setter) setter.call(el,val); else el.value=val;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

async function humanType(el,text){
  if(!CONFIG?.humanMode||text.length<4){ setNative(el,text); return; }
  el.focus(); await sleep(65);
  let cur='';
  for(const ch of text){
    cur+=ch; setNative(el,cur);
    await sleep(40+Math.random()*80);
  }
}

function waitFor(fn,timeout=10000){
  return new Promise((res,rej)=>{
    const deadline=Date.now()+timeout;
    const tick=()=>{ const el=typeof fn==='function'?fn():document.querySelector(fn); if(el) return res(el); if(Date.now()>deadline) return rej(new Error('Timeout')); setTimeout(tick,250); };
    tick();
  });
}

const waitForModal=(t=10000)=>waitFor(()=>document.querySelector('.artdeco-modal[role="dialog"]')||document.querySelector('[data-test-modal]'),t);

// ════════════════════════════════════════════════════════════════
//  LINKEDIN NAVIGATION
// ════════════════════════════════════════════════════════════════

function buildSearchUrl(jobPrefs, searchTermIndex = 0) {
  const terms    = (jobPrefs?.search_terms || []).filter(Boolean);
  const keyword  = terms[searchTermIndex] || 'Software Engineer';
  const location = jobPrefs?.search_location || 'India';
  const params = new URLSearchParams({ keywords: keyword, location, f_LF: 'f_AL', sortBy: 'DD' });
  const expMap = { 'Internship': '1', 'Entry level': '2', 'Associate': '3', 'Mid-Senior level': '4', 'Director': '5', 'Executive': '6' };
  const expLevels = (jobPrefs?.experience_level || []).map(e => expMap[e]).filter(Boolean);
  if (expLevels.length) params.set('f_E', expLevels.join(','));
  const workMap = { 'On-site': '1', 'Remote': '2', 'Hybrid': '3' };
  const workTypes = (jobPrefs?.on_site || []).map(w => workMap[w]).filter(Boolean);
  if (workTypes.length) params.set('f_WT', workTypes.join(','));
  const dateMap = { 'Past 24 hours': 'r86400', 'Past week': 'r604800', 'Past month': 'r2592000' };
  const dateFilter = dateMap[jobPrefs?.date_posted];
  if (dateFilter) params.set('f_TPR', dateFilter);
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function applyEasyApplyFilter() {
  if (window.location.href.includes('f_LF=f_AL') || window.location.href.includes('f_AL')) {
    _easyApplyFilterActive = true; return true;
  }
  _easyApplyFilterActive = true; return false;
}

// ════════════════════════════════════════════════════════════════
//  JOB CARD DETECTION
// ════════════════════════════════════════════════════════════════

function getCards() { return Array.from(document.querySelectorAll('li.scaffold-layout__list-item[data-occludable-job-id]')); }
function isApplied(card) { return Array.from(card.querySelectorAll('li.job-card-container__footer-job-state')).some(li => li.textContent.toLowerCase().includes('applied')); }
function getTitle(card) { return card.querySelector('a.job-card-container__link')?.getAttribute('aria-label') || card.querySelector('a.job-card-container__link')?.textContent?.trim() || card.querySelector('.job-card-list__title')?.textContent?.trim() || 'Unknown Job'; }
const getCompany = () => document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim() || document.querySelector('.jobs-unified-top-card__company-name a')?.textContent?.trim() || '';
const getJD = () => document.querySelector('#job-details')?.innerText?.trim()?.slice(0, 2000) || '';

function getEasyApplyBtn() {
  for (const btn of document.querySelectorAll('button[data-live-test-job-apply-button], button.jobs-apply-button')) {
    const lbl = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase();
    const ext  = !!btn.querySelector('[data-test-icon="link-external-small"]');
    if (!ext && (lbl.includes('easy apply') || (lbl.includes('apply') && !lbl.includes('company website')))) return btn;
  }
  return null;
}

const getModal = () => document.querySelector('.artdeco-modal[role="dialog"]') || document.querySelector('[data-test-modal]');

function getNavBtn(modal, type) {
  if (type === 'submit') return modal.querySelector('button[data-easy-apply-submit-btn]') || Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().includes('submit application'));
  if (type === 'review') return modal.querySelector('button[data-live-test-easy-apply-review-btn]') || Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'review');
  if (type === 'next')   return modal.querySelector('button[data-easy-apply-next-button]') || Array.from(modal.querySelectorAll('footer button, .jobs-easy-apply-footer button')).find(b => { const t=b.textContent.trim().toLowerCase(); return t==='next'||t.includes('continue'); });
  return null;
}

function getLabel(el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  try { if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent.trim(); } } catch {}
  const c = el.closest('.fb-dash-form-element, .artdeco-text-input');
  if (c) { const l = c.querySelector('label'); if (l) return l.textContent.trim(); }
  return el.getAttribute('placeholder') || '';
}

async function closeModal() {
  const btn = document.querySelector('button[aria-label="Dismiss"], button.artdeco-modal__dismiss');
  if (btn) { btn.click(); await sleep(700); const discard = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase().includes('discard')); if (discard) discard.click(); await sleep(400); }
}

async function handleDone() {
  await sleep(1000);
  // Check for daily limit message BEFORE looking for Done button
  if (checkDailyLimit()) return;
  const done = Array.from(document.querySelectorAll('button')).find(b =>
    ['done','not now','dismiss'].some(t => b.textContent.trim().toLowerCase().includes(t))
  );
  if (done) done.click(); else await closeModal();
  await sleep(500);
}

// ── Daily submission limit detector ──────────────────────────────
// Detects LinkedIn's "We limit daily submissions" message and stops
// the bot cleanly instead of treating it as an error.
function checkDailyLimit() {
  const LIMIT_PHRASES = [
    'we limit daily submissions',
    'limit daily submissions',
    'apply tomorrow',
    'save this job and apply tomorrow',
    'daily application limit',
    'too many applications',
    'submission limit reached',
    'apply again tomorrow',
  ];

  const pageText = document.body.innerText.toLowerCase();
  const hit = LIMIT_PHRASES.some(p => pageText.includes(p));

  if (hit) {
    panelLog('🚫 LinkedIn daily application limit reached!', 'err');
    panelLog('💡 Limit resets at midnight. Run the bot again tomorrow.', 'warn');
    panelLog(`📊 Today's total: ${STATS.applied} applied, ${STATS.skipped} skipped`, 'info');
    setStatus('Daily limit hit', 'err');

    // Stop the bot cleanly
    BOT_RUNNING = false;
    chrome.storage.local.set({ botRunning: false });
    chrome.runtime.sendMessage({ type: 'BOT_STATUS', running: false }).catch(() => {});
    chrome.runtime.sendMessage({
      type: 'BOT_LOG',
      text: `🚫 Daily limit reached — ${STATS.applied} applied today. Try again tomorrow.`,
      level: 'err'
    }).catch(() => {});

    // Close any open modal / dismiss LinkedIn's popup
    setTimeout(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dismiss = btns.find(b => {
        const t = b.textContent.trim().toLowerCase();
        return t.includes('save') || t.includes('dismiss') || t.includes('not now') || t.includes('close') || t.includes('cancel');
      });
      if (dismiss) dismiss.click();
    }, 800);

    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════════
//  API HELPERS
// ════════════════════════════════════════════════════════════════

async function apiPost(path, body) {
  const url = CONFIG.serverUrl.replace(/\/$/, '') + path;
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${CONFIG.token}`}, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

async function apiGet(path) {
  const url = CONFIG.serverUrl.replace(/\/$/, '') + path;
  const r = await fetch(url, { method:'GET', headers:{'Content-Type':'application/json','Authorization':`Bearer ${CONFIG.token}`} });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

// ── Cover letter: per-job AI generation with JD context ──────────
async function generateCoverLetter(jobId, jobTitle, company, jd) {
  if (COVER_LETTER_CACHE[jobId]) return COVER_LETTER_CACHE[jobId];
  if (!CONFIG.coverLetter) return CONFIG.profile?.cover_letter || '';
  try {
    const p = CONFIG.profile || {};
    // Build rich user_info context so AI tailors the letter properly
    const userInfo = [
      p.first_name && p.last_name ? `Name: ${p.first_name} ${p.last_name}` : '',
      p.years_of_experience ? `Experience: ${p.years_of_experience} years` : '',
      p.skills_summary ? `Skills: ${p.skills_summary.slice(0, 300)}` : '',
      p.linkedin_summary ? `Background: ${p.linkedin_summary.slice(0, 300)}` : '',
      p.current_city ? `Location: ${p.current_city}, ${p.country || 'India'}` : '',
    ].filter(Boolean).join('\n');

    const res = await apiPost('/api/ai/cover-letter', {
      job_title: jobTitle,
      company,
      job_description: (jd || '').slice(0, 2000),
      user_info: userInfo,
    });
    const letter = res.cover_letter || '';
    if (letter) {
      COVER_LETTER_CACHE[jobId] = letter;
      STATS.letters++; updateStats();
      panelLog(`✦ AI cover letter for ${jobTitle.slice(0, 28)}`, 'ai');
    }
    return letter || p.cover_letter || '';
  } catch (e) {
    panelLog(`Cover letter error: ${e.message}`, 'warn');
    return CONFIG.profile?.cover_letter || '';
  }
}

// ── AI: answer a free-text question ─────────────────────────────
async function aiAnswerQuestion(question, jobTitle, company, jd) {
  try {
    const p = CONFIG.profile || {};
    const userInfo = [
      p.first_name && p.last_name ? `Name: ${p.first_name} ${p.last_name}` : '',
      p.years_of_experience ? `Experience: ${p.years_of_experience} years` : '',
      p.skills_summary ? `Skills: ${p.skills_summary.slice(0, 400)}` : '',
      p.linkedin_summary ? `About: ${p.linkedin_summary.slice(0, 300)}` : '',
      p.current_city ? `Location: ${p.current_city}, ${p.country || 'India'}` : '',
      jd ? `Job description excerpt: ${jd.slice(0, 600)}` : '',
    ].filter(Boolean).join('\n');

    const r = await apiPost('/api/ai/answer-question', {
      question,
      job_title: jobTitle || '',
      company:   company  || '',
      user_info: userInfo,
    });
    return r.answer || '';
  } catch { return ''; }
}

// ── AI: pick the best option from a list (select/radio) ──────────
async function aiPickOption(question, options, jobTitle, company, jd) {
  if (!options || options.length === 0) return '';
  if (options.length === 1) return options[0];
  try {
    const p = CONFIG.profile || {};
    const userInfo = [
      p.first_name && p.last_name ? `Name: ${p.first_name} ${p.last_name}` : '',
      p.years_of_experience ? `Experience: ${p.years_of_experience} years` : '',
      p.skills_summary ? `Skills: ${p.skills_summary.slice(0, 300)}` : '',
      p.current_city ? `Location: ${p.current_city}, ${p.country || 'India'}` : '',
      jd ? `Job description: ${jd.slice(0, 500)}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `You are filling a job application form on behalf of the candidate.

Question: "${question}"
Available options (you MUST pick exactly one from this list):
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Candidate profile:
${userInfo}

Rules:
- Return ONLY the exact text of the best option, nothing else
- Do not explain, do not add quotes
- Pick the most truthful and appropriate answer for this candidate
- For yes/no questions about eligibility, prefer "Yes" if it makes sense for an Indian candidate`;

    const r = await apiPost('/api/ai/answer-question', {
      question: prompt,
      job_title: jobTitle || '',
      company: company || '',
    });
    const answer = (r.answer || '').trim().replace(/^["'`]|["'`]$/g, '');
    // Validate the answer is actually one of the options
    const match = options.find(o =>
      o.toLowerCase() === answer.toLowerCase() ||
      o.toLowerCase().includes(answer.toLowerCase()) ||
      answer.toLowerCase().includes(o.toLowerCase())
    );
    return match || '';
  } catch { return ''; }
}

// ── Resume routing: pick best resume for current job role ─────────
async function pickBestResume(jobTitle, company) {
  const resumes = CONFIG.resumeList || [];
  if (!resumes.length) return null;
  if (resumes.length === 1) return resumes[0];

  const title = (jobTitle || '').toLowerCase();

  // Role-type keyword matching
  const roleMap = [
    { keywords: ['crm', 'salesforce', 'hubspot', 'leadsquared', 'marketing ops', 'marketing operation'],  type: 'crm' },
    { keywords: ['data analyst', 'business analyst', 'analytics', 'power bi', 'tableau', 'mis'],          type: 'analyst' },
    { keywords: ['inside sales', 'sales executive', 'bdr', 'business development', 'sales rep'],          type: 'sales' },
    { keywords: ['java', 'python', 'software developer', 'software engineer', 'backend', 'frontend', 'full stack', 'sde'], type: 'dev' },
    { keywords: ['finance', 'financial analyst', 'accounting', 'audit', 'ca', 'chartered'],               type: 'finance' },
    { keywords: ['hr', 'human resource', 'talent', 'recruiter', 'recruitment'],                           type: 'hr' },
    { keywords: ['marketing', 'digital marketing', 'seo', 'sem', 'content', 'social media'],              type: 'marketing' },
    { keywords: ['intern', 'trainee', 'graduate trainee', 'fresher'],                                     type: 'intern' },
  ];

  let detectedType = null;
  for (const { keywords, type } of roleMap) {
    if (keywords.some(k => title.includes(k))) { detectedType = type; break; }
  }

  if (detectedType) {
    // Find resume whose label mentions this role type
    const match = resumes.find(r => {
      const lbl = (r.label || '').toLowerCase();
      return roleMap.find(rm => rm.type === detectedType)?.keywords.some(k => lbl.includes(k));
    });
    if (match) {
      panelLog(`📄 Resume: "${match.label}" for "${jobTitle.slice(0, 25)}"`, 'ai');
      return match;
    }
  }

  // Fallback: most recently uploaded
  return resumes[resumes.length - 1];
}

async function logApp(jobTitle, company, jobLink, result, reason) {
  try { await apiPost('/api/jobs/log', { platform:'linkedin', job_title:jobTitle, company, job_link:jobLink, result, reason: reason||'' }); } catch {}
}

// ════════════════════════════════════════════════════════════════
//  ANSWER ENGINE  (handles text, textarea, select, radio)
// ════════════════════════════════════════════════════════════════

async function getAnswer(rawLabel, type, opts, jobTitle, company, jd) {
  const lbl = (rawLabel || '').toLowerCase();
  const p   = CONFIG.profile  || {};
  const jp  = CONFIG.jobPrefs || {};

  // ── Static profile fields ─────────────────────────────────────
  if (lbl.includes('first name'))                                return p.first_name  || '';
  if (lbl.includes('last name'))                                 return p.last_name   || '';
  if (lbl.includes('full name'))                                 return [p.first_name, p.last_name].filter(Boolean).join(' ');
  if (lbl.includes('email'))                                     return p.email || '';
  if (lbl.includes('phone') && lbl.includes('number'))          return p.phone_number || '';
  if (lbl.match(/^city$|current city|location city/))           return p.current_city || '';
  if (lbl.match(/^state$|current state/))                       return p.state || '';
  if (lbl.includes('country') && !lbl.includes('code'))         return p.country || 'India';
  if (lbl.includes('zip') || lbl.includes('postal'))            return p.zipcode || '';
  if (lbl.includes('street') || (lbl.includes('address') && !lbl.includes('email'))) return p.street || '';
  if (lbl.includes('linkedin'))                                  return p.linkedin_profile || '';
  if (lbl.includes('website') || lbl.includes('portfolio'))     return p.website || '';
  if (lbl.includes('cover letter') || lbl.includes('why do you want')) return COVER_LETTER_CACHE[CONFIG._currentJobId] || p.cover_letter || '';
  if (lbl.includes('summary') || lbl.includes('about yourself')) return p.linkedin_summary || p.cover_letter || '';
  if (lbl.match(/years.{0,10}experience|total experience/))     return String(p.years_of_experience || '0');
  if (lbl.includes('expected') && (lbl.includes('salary') || lbl.includes('ctc'))) return String(p.desired_salary || '0');
  if (lbl.includes('current') && (lbl.includes('ctc') || lbl.includes('salary'))) return String(p.current_ctc || '0');
  if (lbl.includes('notice period') || lbl.includes('joining'))  return String(p.notice_period || '0');
  if (lbl.includes('confidence') || lbl.includes('rate yourself')) return String(p.confidence_level || '7');

  // ── Boolean/eligibility — prefer selecting from options ──────
  const bools = [
    { re: /authorized|legally authorized|eligible to work/, val: true },
    { re: /visa sponsorship|require sponsorship/,           val: false },
    { re: /willing to relocate|open to relocation/,         val: true },
    { re: /full.?time/,                                     val: jp.job_type?.includes('Full-time') ?? true },
    { re: /remote work|comfortable remote/,                 val: jp.on_site?.includes('Remote') ?? true },
    { re: /immediate.?join|available immediately/,          val: true },
    { re: /disability|differently abled/,                   val: false },
    { re: /veteran|military/,                               val: false },
  ];
  for (const { re, val } of bools) {
    if (lbl.match(re)) {
      if (opts?.length) {
        return opts.find(o => o.toLowerCase().startsWith(val ? 'yes' : 'no'))
            || opts.find(o => o.toLowerCase().includes(val ? 'yes' : 'no'))
            || (val ? 'Yes' : 'No');
      }
      return val ? 'Yes' : 'No';
    }
  }

  // ── Select / radio: use AI to pick from actual options ────────
  if ((type === 'select' || type === 'radio') && opts?.length && !lbl.includes('country code')) {
    // Skip placeholder-only selects
    const realOpts = opts.filter(o => o && o !== 'Select an option' && o !== 'Please select');
    if (!realOpts.length) return '';

    // For small yes/no dropdowns — answer directly without AI call
    if (realOpts.length === 2 && realOpts.every(o => /^(yes|no)$/i.test(o.trim()))) {
      const val = bools.some(b => lbl.match(b.re) && b.val);
      return realOpts.find(o => /yes/i.test(o)) || realOpts[0];
    }

    panelLog(`  🤖 AI picking option: "${rawLabel?.slice(0, 30)}" (${realOpts.length} choices)`, 'ai');
    const aiPick = await aiPickOption(rawLabel, realOpts, jobTitle, company, jd);
    if (aiPick) {
      panelLog(`  ✓ AI picked: "${aiPick.slice(0, 25)}"`, 'ai');
      return aiPick;
    }
    // Fallback: first real option
    panelLog(`  ⚠ AI fallback → "${realOpts[0].slice(0, 22)}"`, 'warn');
    return realOpts[0];
  }

  // ── Free-text: AI answers anything unknown ────────────────────
  if (rawLabel && rawLabel.length > 4 && type !== 'resume') {
    const ai = await aiAnswerQuestion(rawLabel, jobTitle, company, jd);
    if (ai) {
      panelLog(`  🤖 AI answer: "${rawLabel.slice(0, 22)}" → "${ai.slice(0, 35)}"`, 'ai');
      return ai;
    }
  }
  return '';
}

// ════════════════════════════════════════════════════════════════
//  FILL ONE MODAL STEP
// ════════════════════════════════════════════════════════════════

async function fillStep(modal, jobTitle, company) {
  // Get current JD for richer AI context
  const jd = CONFIG._currentJD || getJD() || '';

  // ── Text inputs ───────────────────────────────────────────────
  for (const el of modal.querySelectorAll('input.artdeco-text-input--input, input[type="text"], input[type="number"]')) {
    if (el.readOnly || el.disabled || el.type === 'hidden') continue;
    const lbl = getLabel(el); if (!lbl) continue;
    if (el.value && el.value.trim().length > 0) continue; // don't overwrite filled fields
    const ans = await getAnswer(lbl, 'text', [], jobTitle, company, jd);
    if (ans && el.value !== ans) { await humanDelay(80, 250); await humanType(el, ans); }
    await sleep(50);
  }

  // ── Textareas ─────────────────────────────────────────────────
  for (const el of modal.querySelectorAll('textarea')) {
    if (el.readOnly || el.disabled) continue;
    const lbl = getLabel(el); if (!lbl) continue;
    if (el.value && el.value.trim().length > 2) continue; // don't overwrite
    const ans = await getAnswer(lbl, 'textarea', [], jobTitle, company, jd);
    if (ans && el.value !== ans) { await humanDelay(130, 450); await humanType(el, ans); }
    await sleep(70);
  }

  // ── Native selects ────────────────────────────────────────────
  for (const sel of modal.querySelectorAll('select')) {
    if (sel.disabled) continue;
    const lbl  = getLabel(sel);
    const opts = Array.from(sel.options).map(o => o.text.trim()).filter(t => t && t !== 'Select an option' && t !== 'Please select');

    // Phone country code — set to India
    if (lbl.toLowerCase().includes('country code') || lbl.toLowerCase().includes('phone country')) {
      const opt = Array.from(sel.options).find(o => o.text.includes('+91') || o.text.toLowerCase().includes('india'));
      if (opt && sel.value !== opt.value) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      continue;
    }

    // Skip if already selected meaningfully
    const curText = Array.from(sel.options).find(o => o.value === sel.value)?.text?.trim() || '';
    if (curText && curText !== 'Select an option' && curText !== 'Please select') continue;

    const ans = await getAnswer(lbl, 'select', opts, jobTitle, company, jd);
    if (ans) {
      const match = Array.from(sel.options).find(o =>
        o.text.trim().toLowerCase() === ans.toLowerCase() ||
        o.text.trim().toLowerCase().includes(ans.toLowerCase())
      );
      if (match && sel.value !== match.value) {
        await humanDelay(70, 180);
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    await sleep(60);
  }

  // ── Typeahead/custom dropdowns (LinkedIn's artdeco dropdowns) ─
  for (const dd of modal.querySelectorAll('.artdeco-dropdown, [data-test-text-select-input]')) {
    const btn = dd.querySelector('button, [role="combobox"]');
    if (!btn) continue;
    const lbl = getLabel(btn) || btn.textContent?.trim();
    const listId = btn.getAttribute('aria-controls') || btn.getAttribute('aria-owns');
    if (!listId) continue;
    const list = document.getElementById(listId);
    if (!list) continue;
    const opts = Array.from(list.querySelectorAll('[role="option"], li')).map(o => o.textContent?.trim()).filter(Boolean);
    if (!opts.length) continue;
    const ans = await getAnswer(lbl, 'select', opts, jobTitle, company, jd);
    if (ans) {
      await humanClick(btn);
      await sleep(300);
      const optEl = Array.from(list.querySelectorAll('[role="option"], li')).find(o =>
        o.textContent?.trim().toLowerCase() === ans.toLowerCase() ||
        o.textContent?.trim().toLowerCase().includes(ans.toLowerCase())
      );
      if (optEl) { await humanDelay(80, 200); await humanClick(optEl); }
    }
    await sleep(60);
  }

  // ── Radio groups ──────────────────────────────────────────────
  const rgs = {};
  modal.querySelectorAll('input[type="radio"]').forEach(r => { const n = r.name || r.id || 'rg'; if (!rgs[n]) rgs[n] = []; rgs[n].push(r); });
  for (const radios of Object.values(rgs)) {
    if (radios.some(r => r.checked)) continue; // skip if already answered
    const lbl  = getLabel(radios[0]);
    const opts = radios.map(r => {
      try { return document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent?.trim() || r.value || ''; } catch { return r.value || ''; }
    }).filter(Boolean);
    const ans = await getAnswer(lbl, 'radio', opts, jobTitle, company, jd);
    if (ans) {
      const idx = opts.findIndex(o =>
        o.toLowerCase() === ans.toLowerCase() ||
        o.toLowerCase().includes(ans.toLowerCase()) ||
        ans.toLowerCase().includes(o.toLowerCase())
      );
      if (idx >= 0) { await humanDelay(70, 180); radios[idx].click(); }
      else { await sleep(70); radios[0].click(); } // fallback
    } else if (radios.length) { await sleep(70); radios[0].click(); }
    await sleep(60);
  }

  // ── Checkboxes (agreement/consent only) ──────────────────────
  for (const cb of modal.querySelectorAll('input[type="checkbox"]:not(:checked)')) {
    const lbl = getLabel(cb).toLowerCase();
    if (lbl.includes('agree') || lbl.includes('certify') || lbl.includes('consent') || lbl.includes('confirm') || lbl.includes('accept')) {
      await humanDelay(55, 140); cb.click();
    }
    await sleep(35);
  }

  // ── Resume card: pick best resume for role ────────────────────
  const rCards = Array.from(modal.querySelectorAll(
    '.jobs-document-upload-redesign-card__container, [data-test-resume-card], .jobs-resume-picker__resume'
  ));
  if (rCards.length > 0) {
    const best = await pickBestResume(jobTitle, company);
    if (best && rCards.length > 1) {
      // Try to find the card matching the best resume label
      const targetCard = rCards.find(c =>
        (c.textContent || '').toLowerCase().includes((best.label || '').toLowerCase().slice(0, 15))
      );
      const cardToClick = targetCard || rCards[0];
      if (!cardToClick.getAttribute('aria-checked') || cardToClick.getAttribute('aria-checked') === 'false') {
        await humanDelay(130, 350);
        await humanClick(cardToClick);
      }
    } else if (rCards.length === 1 && !rCards[0].getAttribute('aria-checked')) {
      await humanDelay(130, 350);
      await humanClick(rCards[0]);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  APPLY TO ONE JOB
// ════════════════════════════════════════════════════════════════

async function applyToJob(card) {
  const title = getTitle(card);
  panelLog(`▶ ${title.slice(0, 45)}`, 'info');
  setCurrentJob(title.slice(0, 50));

  const tgt = card.querySelector('div[data-job-id]') || card.querySelector('a.job-card-container__link');
  if (!tgt) { panelLog('  ✗ No clickable target', 'err'); return false; }

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await humanDelay(250, 700);
  await humanClick(tgt);
  await humanDelay(CONFIG.humanMode ? 1200 : 600, CONFIG.humanMode ? 2800 : 1200);

  let company = '', jd = '', link = '';
  for (let i = 0; i < 10; i++) { company = getCompany(); jd = getJD(); link = window.location.href; if (company) break; await sleep(400); }
  CONFIG._currentJD = jd; // cache for fillStep AI context
  panelLog(`  🏢 ${company || '(company unknown)'}`, 'info');

  const jobId = card.getAttribute('data-occludable-job-id') || (title + company);
  CONFIG._currentJobId = jobId;
  if (CONFIG.coverLetter && company) generateCoverLetter(jobId, title, company, jd);

  let eBtn = null;
  for (let i = 0; i < 10; i++) { eBtn = getEasyApplyBtn(); if (eBtn) break; await sleep(350); }
  if (!eBtn) { panelLog('  ⊘ No Easy Apply button — skip', 'warn'); STATS.skipped++; updateStats(); return false; }

  if (CONFIG.coverLetter && company && !COVER_LETTER_CACHE[jobId]) for (let i = 0; i < 8 && !COVER_LETTER_CACHE[jobId]; i++) await sleep(500);

  await humanDelay(300, 900);
  await humanClick(eBtn);
  await humanDelay(CONFIG.humanMode ? 1200 : 600, CONFIG.humanMode ? 2800 : 1300);

  // Check if LinkedIn showed the daily limit popup instead of the modal
  await sleep(600);
  if (checkDailyLimit()) return false;

  let modal;
  try { modal = await waitForModal(9000); panelLog('  📋 Modal open', 'info'); }
  catch {
    // One more limit check — sometimes it appears after modal fails to open
    if (checkDailyLimit()) return false;
    panelLog('  ✗ Modal did not open', 'err'); STATS.errors++; updateStats(); return false;
  }

  for (let step = 0; step < 15 && BOT_RUNNING; step++) {
    await humanDelay(300, 600);
    modal = getModal() || modal;
    await fillStep(modal, title, company);
    await humanDelay(200, 500);
    modal = getModal() || modal;

    const submitBtn = getNavBtn(modal, 'submit');
    const reviewBtn = getNavBtn(modal, 'review');
    const nextBtn   = getNavBtn(modal, 'next');

    if (submitBtn) {
      if (CONFIG.dryRun) { panelLog(`  🔒 DRY RUN: ${title.slice(0, 28)}`, 'warn'); await closeModal(); await sleep(700); STATS.applied++; updateStats(); await logApp(title, company, link, 'Dry Run'); setCurrentJob(''); return true; }
      panelLog(`  ✅ SUBMITTING!`, 'ok');
      await humanDelay(CONFIG.humanMode ? 500 : 150, CONFIG.humanMode ? 1200 : 450);
      await humanClick(submitBtn);
      await humanDelay(1400, 2400);
      // Check daily limit right after submit — LinkedIn sometimes shows it here
      if (checkDailyLimit()) { setCurrentJob(''); return false; }
      await handleDone();
      STATS.applied++; updateStats();
      await logApp(title, company, link, 'Applied');
      panelLog(`  🎉 Applied #${STATS.applied}: ${title.slice(0, 28)}`, 'ok');
      setCurrentJob(''); return true;
    } else if (reviewBtn) { panelLog(`  → Review`, 'info'); await humanClick(reviewBtn); await humanDelay(700, 1600);
    } else if (nextBtn) { panelLog(`  → Step ${step + 1}`, 'info'); await humanClick(nextBtn); await humanDelay(700, 1800);
    } else { panelLog(`  ⚠ No nav button at step ${step + 1}`, 'warn'); break; }
  }

  await closeModal(); STATS.errors++; updateStats();
  await logApp(title, company, link, 'Failed', 'Navigation failed');
  panelLog(`  ✗ Failed: ${title.slice(0, 28)}`, 'err'); setCurrentJob(''); return false;
}

// ════════════════════════════════════════════════════════════════
//  MAIN BOT LOOP
// ════════════════════════════════════════════════════════════════

async function startBot(config) {
  if (BOT_RUNNING) { panelLog('Already running', 'warn'); return; }
  CONFIG = config; BOT_RUNNING = true; _easyApplyFilterActive = false;
  STATS = { applied: 0, skipped: 0, errors: 0, letters: 0 }; COVER_LETTER_CACHE = {};
  setStatus('running'); updateStats();
  // Pre-load resume list for smart routing
  try {
    const rData = await apiGet('/api/resume/list');
    CONFIG.resumeList = (rData.resumes || []).filter(r => r.file_id);
    if (CONFIG.resumeList.length > 1) panelLog(`📄 ${CONFIG.resumeList.length} resumes loaded for smart routing`, 'ai');
  } catch(e) { CONFIG.resumeList = []; }
  chrome.runtime.sendMessage({ type: 'BOT_STATUS', running: true }).catch(() => {});
  panelLog('🤖 Bot started', 'ok');
  panelLog(`${config.dryRun ? '🔒 Dry Run' : '🚀 LIVE'} | Human: ${config.humanMode ? 'ON' : 'OFF'} | Max: ${config.maxApps}`, 'info');

  const searchTerms = (config.jobPrefs?.search_terms || []).filter(Boolean);
  if (!searchTerms.length) { panelLog('❌ No search terms! Add them in Profile → Job Preferences', 'err'); BOT_RUNNING = false; setStatus('err'); return; }
  panelLog(`📋 Search terms: ${searchTerms.slice(0, 3).join(', ')}`, 'info');

  for (let termIdx = 0; termIdx < searchTerms.length && BOT_RUNNING; termIdx++) {
    const term = searchTerms[termIdx];
    panelLog(`\n══ Search ${termIdx + 1}/${searchTerms.length}: "${term}" ══`, 'ok');

    const alreadyOnJobs = window.location.href.includes('linkedin.com/jobs');
    const hasCards = document.querySelectorAll('li.scaffold-layout__list-item[data-occludable-job-id]').length > 0;

    if (!alreadyOnJobs || !hasCards) {
      const url = buildSearchUrl(config.jobPrefs, termIdx);
      panelLog(`🔍 Navigating: "${term}"`, 'info');
      await chrome.storage.local.set({ botRunning: true, botConfig: { ...config, _resumeTermIndex: termIdx } });
      window.location.href = url; return;
    }

    await applyEasyApplyFilter(); await sleep(1000);

    let page = 0;
    while (BOT_RUNNING && page < 4) {
      const cards = getCards();
      const todo  = cards.filter(c => !isApplied(c));
      panelLog(`  Page ${page + 1}: ${cards.length} jobs found, ${todo.length} not applied`, 'info');
      if (!cards.length) { panelLog('  No job cards found on this page', 'warn'); break; }
      if (!todo.length) { panelLog('  All visible jobs already applied', 'warn'); break; }

      for (const card of todo) {
        if (!BOT_RUNNING) break;
        if (config.maxApps > 0 && STATS.applied >= config.maxApps) { panelLog(`🎯 Reached max (${config.maxApps})`, 'ok'); BOT_RUNNING = false; break; }
        // Check for daily limit banner before each application
        if (checkDailyLimit()) break;
        try { await applyToJob(card); }
        catch (e) { panelLog(`Error: ${e.message}`, 'err'); STATS.errors++; updateStats(); try { await closeModal(); } catch {} await sleep(1500); }
        if (BOT_RUNNING) { const gap = config.humanMode ? 3500 + Math.random() * 4500 : 1800; panelLog(`  ⏱ ${Math.round(gap/1000)}s pause…`, 'info'); await sleep(gap); }
      }

      if (!BOT_RUNNING) break;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await sleep(2500);

      const nextPage = document.querySelector('button[aria-label="Page 2"], button.artdeco-pagination__button--next');
      if (nextPage && !nextPage.disabled) { panelLog('  ▶ Going to next page', 'info'); await humanClick(nextPage); await sleep(3000); }
      page++;
    }

    if (BOT_RUNNING && termIdx + 1 < searchTerms.length) {
      const nextUrl = buildSearchUrl(config.jobPrefs, termIdx + 1);
      panelLog(`\n🔍 Next search term: "${searchTerms[termIdx + 1]}"`, 'info');
      await chrome.storage.local.set({ botRunning: true, botConfig: { ...config, _resumeTermIndex: termIdx + 1 } });
      window.location.href = nextUrl; return;
    }
  }

  BOT_RUNNING = false; _lastStorageRunning = false;
  await chrome.storage.local.set({ botRunning: false });
  chrome.runtime.sendMessage({ type: 'BOT_STATUS', running: false }).catch(() => {});
  setStatus('ok'); setCurrentJob('');
  panelLog(`\n✅ All done! Applied:${STATS.applied} Skipped:${STATS.skipped} Errors:${STATS.errors} AI:${STATS.letters}`, 'ok');
}