/**
 * popup.js — Full dashboard controller
 * Handles UI state, buttons, live updates, CSV export
 */

let results  = [];
let logs     = [];
let checked  = 0;
let skipped  = 0;
let isActive = false;
let isPaused = false;

const $ = id => document.getElementById(id);
const E = {
  niche:$('niche'),city:$('city'),country:$('country'),
  filter:$('filterNoWebsite'),filterSocial:$('filterNoSocial'),
  start:$('btnStart'),pause:$('btnPause'),resume:$('btnResume'),stop:$('btnStop'),
  download:$('btnDownload'),clear:$('btnClear'),clearLog:$('btnClearLogs'),
  pill:$('statusPill'),badge:$('badgeCount'),
  progSect:$('progressSection'),progBar:$('progressBar'),
  progText:$('progressText'),progFrac:$('progressFraction'),progSub:$('progressSub'),
  statsRow:$('statsRow'),sC:$('sCollected'),sCh:$('sChecked'),sSk:$('sSkipped'),sTg:$('sTarget'),
  resList:$('resultsList'),resLabel:$('resultsLabel'),logsList:$('logsList'),
};

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $(`tab-${t.dataset.tab}`).classList.add('active');
}));

// ── Lead count cards — clickable selection ─────────────────────────────────
document.querySelectorAll('.lead-opt').forEach(opt => {
  const radio = opt.querySelector('input[type="radio"]');
  // Apply initial selected style
  if (radio?.checked) opt.classList.add('selected');

  opt.addEventListener('click', () => {
    // Deselect all others
    document.querySelectorAll('.lead-opt').forEach(o => {
      o.classList.remove('selected');
      const r = o.querySelector('input[type="radio"]');
      if (r) r.checked = false;
    });
    // Select this one
    opt.classList.add('selected');
    if (radio) radio.checked = true;
  });
});

// ── Restore state ──────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ from:'popup', action:'GET_STATE' }, s => {
  if (!s) return;
  results = s.results || [];  logs = s.logs || [];
  isActive = s.running;       isPaused = s.paused;
  if (results.length) renderAllResults();
  if (logs.length)    renderAllLogs();
  if (s.progress)     updateProgress(s.progress.current, s.progress.total, s.progress.text);
  if (isActive)  setRunningUI();
  if (isPaused)  setPausedUI();
  if (!isActive && results.length) setDoneUI();
});

// ── Restore last inputs ────────────────────────────────────────────────────
chrome.storage.local.get(['lastNiche','lastCity','lastCountry'], d => {
  if (d.lastNiche)   E.niche.value   = d.lastNiche;
  if (d.lastCity)    E.city.value    = d.lastCity;
  if (d.lastCountry) E.country.value = d.lastCountry;
});

// ── Live message listener ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (!msg.relayed) return;
  if (msg.action === 'LOG')      addLog(msg.message, msg.time);
  if (msg.action === 'PROGRESS') updateProgress(msg.current, msg.total, msg.text);
  if (msg.action === 'NEW_RESULT') {
    results.push(msg.business); checked++;
    addResultCard(msg.business); updateStats();
  }
  if (msg.action === 'SCRAPE_COMPLETE') {
    setDoneUI();
    addLog(`🎉 Complete! ${results.length} leads collected.`);
    document.querySelector('[data-tab="results"]').click();
  }
});

// ── START ──────────────────────────────────────────────────────────────────
E.start.addEventListener('click', () => {
  const niche = E.niche.value.trim(), city = E.city.value.trim(), country = E.country.value.trim();
  if (!niche) { shakeInput(E.niche); return; }
  if (!city)  { shakeInput(E.city);  return; }
  if (!country){ shakeInput(E.country); return; }

  const maxLeads = parseInt(document.querySelector('input[name="leads"]:checked')?.value || '500');
  chrome.storage.local.set({ lastNiche:niche, lastCity:city, lastCountry:country });

  results = []; checked = 0; skipped = 0;
  clearResults(); clearLogs();

  chrome.runtime.sendMessage({
    from:'popup', action:'START',
    config:{
      niche, city, country, maxLeads,
      filterNoWebsite:  E.filter.checked,
      filterNoSocial:   E.filterSocial?.checked || false,
    }
  }, () => {
    setRunningUI();
    E.sTg.textContent = maxLeads;
    updateProgress(0, maxLeads, 'Opening Google Maps...');
    addLog(`🚀 Started: "${niche}" in ${city}, ${country} · Target: ${maxLeads}`);
  });
});

// ── PAUSE / RESUME / STOP ──────────────────────────────────────────────────
E.pause.addEventListener('click',  () => {
  chrome.runtime.sendMessage({ from:'popup', action:'PAUSE' }, () => { isPaused=true; setPausedUI(); addLog('⏸ Paused'); });
});
E.resume.addEventListener('click', () => {
  chrome.runtime.sendMessage({ from:'popup', action:'RESUME' }, () => { isPaused=false; setRunningUI(); addLog('▶ Resumed'); });
});
E.stop.addEventListener('click',   () => {
  chrome.runtime.sendMessage({ from:'popup', action:'STOP' }, () => { setDoneUI(); addLog(`⏹ Stopped. ${results.length} leads saved.`); });
});

// ── CLEAR ──────────────────────────────────────────────────────────────────
E.clear.addEventListener('click', () => {
  if (results.length && !confirm(`Clear all ${results.length} leads?`)) return;
  chrome.runtime.sendMessage({ from:'popup', action:'CLEAR' });
  results=[]; checked=0; skipped=0; clearResults(); updateStats(); addLog('🗑 Results cleared');
});
E.clearLog.addEventListener('click', clearLogs);

// ── DOWNLOAD CSV ───────────────────────────────────────────────────────────
E.download.addEventListener('click', () => {
  if (!results.length) { alert('No results to export.'); return; }

  const headers = ['Business Name','Category','Phone','WhatsApp','Email','Website',
    'Website Status','Address','City','Country','Rating','Reviews','Google Maps URL','Scraped At'];
  const keys    = ['business_name','category','phone','whatsapp','email','website',
    'website_status','address','city','country','rating','review_count','google_maps_url','scraped_at'];

  const esc = v => { const s=String(v??''); return /[,"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  const csv = [headers.join(','), ...results.map(r => keys.map(k=>esc(r[k])).join(','))].join('\n');

  const niche    = (E.niche.value.trim()||'leads').toLowerCase().replace(/\s+/g,'-');
  const city     = (E.city.value.trim()||'city').toLowerCase().replace(/\s+/g,'-');
  const filename = `${niche}-${city}-leads.csv`;

  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs:true }, () => {
    addLog(`⬇ Downloaded: ${filename} (${results.length} rows)`);
    URL.revokeObjectURL(url);
  });
});

// ── UI State ───────────────────────────────────────────────────────────────
function setRunningUI() {
  isActive=true; isPaused=false;
  E.start.classList.add('hidden');
  E.pause.classList.remove('hidden');
  E.resume.classList.add('hidden');
  E.stop.classList.remove('hidden');
  E.progSect.classList.remove('hidden');
  E.statsRow.classList.remove('hidden');
  setPill('running','● Scraping');
}
function setPausedUI() {
  isPaused=true;
  E.pause.classList.add('hidden');
  E.resume.classList.remove('hidden');
  setPill('paused','⏸ Paused');
}
function setDoneUI() {
  isActive=false; isPaused=false;
  E.start.classList.remove('hidden');
  E.pause.classList.add('hidden');
  E.resume.classList.add('hidden');
  E.stop.classList.add('hidden');
  setPill('done',`✓ ${results.length} leads`);
  if (results.length) { E.progText.textContent=`Done — ${results.length} leads`; E.progBar.style.width='100%'; }
}
function setPill(type, text) { E.pill.className=`pill pill-${type}`; E.pill.textContent=text; }

function updateProgress(cur, tot, text) {
  const pct = tot>0 ? Math.min((cur/tot)*100,100) : 0;
  E.progBar.style.width  = `${pct}%`;
  E.progText.textContent = text||'';
  E.progFrac.textContent = `${cur} / ${tot}`;
  E.progSub.textContent  = `${Math.round(pct)}% complete`;
  checked = cur;
  updateStats();
}
function updateStats() {
  E.sC.textContent  = results.length;
  E.sCh.textContent = checked;
  E.sSk.textContent = skipped;
  E.badge.textContent = results.length;
  if (results.length) E.badge.classList.remove('hidden');
  E.resLabel.textContent = `${results.length} lead${results.length!==1?'s':''} collected`;
}

// ── Results ────────────────────────────────────────────────────────────────
function clearResults() {
  E.resList.innerHTML='<div class="empty"><div style="font-size:2rem;margin-bottom:8px">📋</div><p>No leads yet.<br/>Run a scrape to collect businesses.</p></div>';
  E.resLabel.textContent='0 leads';
  E.badge.classList.add('hidden');
}
function addResultCard(biz) {
  const empty = E.resList.querySelector('.empty');
  if (empty) empty.remove();
  const tags = [];
  if (!biz.has_website) tags.push(`<span class="tag tag-nw">NO WEBSITE ✓</span>`);
  if (biz.phone)        tags.push(`<span class="tag tag-ph">📞 ${biz.phone}</span>`);
  if (biz.rating)       tags.push(`<span class="tag tag-rt">★ ${biz.rating} (${biz.review_count})</span>`);
  if (biz.category)     tags.push(`<span class="tag tag-ct">${biz.category}</span>`);
  if (biz.address)      tags.push(`<span class="tag tag-addr">📍 ${biz.address.substring(0,35)}${biz.address.length>35?'…':''}</span>`);
  const card = document.createElement('div');
  card.className='result-card';
  card.innerHTML=`<div class="result-name">${biz.business_name}</div><div class="result-tags">${tags.join('')}</div>`;
  E.resList.appendChild(card);
  E.resList.scrollTop=E.resList.scrollHeight;
}
function renderAllResults() {
  clearResults();
  results.forEach(addResultCard);
  updateStats();
}

// ── Logs ───────────────────────────────────────────────────────────────────
function addLog(msg, time) {
  const t   = time || new Date().toLocaleTimeString('en-US',{hour12:false});
  const cls = msg.startsWith('✅')||msg.startsWith('🎉')||msg.startsWith('⬇') ? 'log-ok'
             : msg.startsWith('⏭')||msg.startsWith('⏸')||msg.startsWith('⚠') ? 'log-warn'
             : msg.startsWith('❌') ? 'log-err' : '';
  const div = document.createElement('div');
  div.className=`log-entry ${cls}`;
  div.innerHTML=`<span class="log-time">${t}</span><span class="log-msg">${msg}</span>`;
  E.logsList.appendChild(div);
  E.logsList.scrollTop=E.logsList.scrollHeight;
}
function clearLogs() {
  E.logsList.innerHTML='<div class="log-entry"><span class="log-time">--:--:--</span><span class="log-msg">Log cleared.</span></div>';
}
function renderAllLogs() { clearLogs(); logs.forEach(l=>addLog(l.message,l.time)); }

// ── Shake invalid input ────────────────────────────────────────────────────
function shakeInput(input) {
  input.style.borderColor='rgba(239,68,68,0.6)';
  input.style.boxShadow='0 0 0 3px rgba(239,68,68,0.12)';
  input.focus();
  setTimeout(()=>{ input.style.borderColor=''; input.style.boxShadow=''; }, 2000);
}
