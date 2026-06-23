/**
 * content.js — Main scraping controller
 *
 * State is stored in chrome.storage.local so it survives page navigations.
 *
 * PHASE 1 — COLLECT (search results page):
 *   Scroll → collect listing URLs → save to queue → navigate to first
 *
 * PHASE 2 — PROCESS (each /maps/place/ page):
 *   Extract data → save → navigate to next URL in queue
 */

const SESSION_KEY = 'aiLeadsSession';

// ── Handle messages from popup / background ────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {

  if (msg.action === 'PING') {
    sendResponse({ alive: true });
    return true;
  }

  if (msg.action === 'START_SCRAPE') {
    const session = {
      active: true, paused: false, stopped: false,
      phase: 'COLLECT',
      config: msg.config,
      queue: [], results: [], processedUrls: [],
      currentIndex: 0, checked: 0, skipped: 0,
    };
    Utils.setStorage({ [SESSION_KEY]: session }).then(() => {
      sendResponse({ ok: true });
      runFromStorage();
    });
    return true;
  }

  if (msg.action === 'PAUSE_SCRAPE') {
    Utils.getStorage(SESSION_KEY).then(d => {
      const s = d[SESSION_KEY]; if (!s) return;
      s.paused = true;
      Utils.setStorage({ [SESSION_KEY]: s });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'RESUME_SCRAPE') {
    Utils.getStorage(SESSION_KEY).then(d => {
      const s = d[SESSION_KEY]; if (!s) return;
      s.paused = false;
      Utils.setStorage({ [SESSION_KEY]: s }).then(() => runFromStorage());
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === 'STOP_SCRAPE') {
    Utils.getStorage(SESSION_KEY).then(d => {
      const s = d[SESSION_KEY]; if (!s) return;
      s.active = false; s.stopped = true;
      Utils.setStorage({ [SESSION_KEY]: s });
    });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Auto-resume on every page load ────────────────────────────────────────
(async function autoResume() {
  await Utils.sleep(1800, 3000); // wait for Maps to fully render
  const data    = await Utils.getStorage(SESSION_KEY);
  const session = data[SESSION_KEY];
  if (!session || !session.active || session.paused || session.stopped) return;
  runFromStorage();
})();

// ── Main dispatcher ────────────────────────────────────────────────────────
async function runFromStorage() {
  const data    = await Utils.getStorage(SESSION_KEY);
  const session = data[SESSION_KEY];
  if (!session || !session.active || session.paused || session.stopped) return;

  const url = window.location.href;

  if (session.phase === 'COLLECT' && isSearchPage(url)) {
    await phaseCollect(session);
  } else if (session.phase === 'PROCESS' && isPlacePage(url)) {
    await phaseProcess(session);
  } else if (session.phase === 'PROCESS' && isSearchPage(url)) {
    // Ended up back on search — navigate to next
    const fresh = (await Utils.getStorage(SESSION_KEY))[SESSION_KEY];
    if (fresh && fresh.active) navigateToNext(fresh);
  }
}

// ── PHASE 1: Collect all listing URLs ─────────────────────────────────────
async function phaseCollect(session) {
  const { niche, city, country, maxLeads } = session.config;

  log(`🗺 Searching: ${niche} in ${city}, ${country}`);
  log('📋 Scrolling to collect listing URLs...');
  progress(0, maxLeads, 'Loading listings...');

  // Collect ~2x target so we have extras after filtering
  const urls = await Scraper.collectUrls(Math.min(maxLeads * 2, 300));

  if (!urls.length) {
    log('❌ No listings found. Check your search terms and try again.');
    const s = (await Utils.getStorage(SESSION_KEY))[SESSION_KEY];
    if (s) { s.active = false; await Utils.setStorage({ [SESSION_KEY]: s }); }
    return;
  }

  log(`✅ Collected ${urls.length} listing URLs. Extracting data...`);

  const fresh = (await Utils.getStorage(SESSION_KEY))[SESSION_KEY];
  if (!fresh || !fresh.active) return;
  fresh.phase        = 'PROCESS';
  fresh.queue        = urls;
  fresh.currentIndex = 0;
  await Utils.setStorage({ [SESSION_KEY]: fresh });

  await Utils.sleep(500, 1000);
  navigateToNext(fresh);
}

// ── PHASE 2: Extract data from each detail page ────────────────────────────
async function phaseProcess(session) {
  const { city, country, filterNoWebsite, filterNoSocial, maxLeads } = session.config;
  const currentUrl = window.location.href.split('?')[0];

  // Skip if already processed this URL
  if (session.processedUrls.includes(currentUrl)) {
    const fresh = (await Utils.getStorage(SESSION_KEY))[SESSION_KEY];
    if (!fresh) return;
    fresh.currentIndex++;
    await Utils.setStorage({ [SESSION_KEY]: fresh });
    navigateToNext(fresh);
    return;
  }

  progress(
    session.results.length, maxLeads,
    `Extracting ${session.currentIndex + 1} / ${session.queue.length}...`
  );

  // Extract business data
  let biz = null;
  try {
    biz = await Scraper.extractDetailPage(city, country);
  } catch (err) {
    log(`⚠ Extraction error: ${err.message}`);
  }

  // Re-read session from storage (paused/stopped may have changed)
  let fresh = (await Utils.getStorage(SESSION_KEY))[SESSION_KEY];
  if (!fresh || !fresh.active || fresh.stopped) return;

  // Record this URL as done
  fresh.processedUrls.push(currentUrl);
  fresh.currentIndex++;
  fresh.checked++;

  if (!biz) {
    fresh.skipped++;
    log(`⚠ No data at listing ${fresh.currentIndex}, skipping`);
  } else {
    // Apply filters
    const statusMsg = biz.website_status;
    const isNoWebsite   = !biz.has_website && biz.website === '';
    const isSocialOnly  = !biz.has_website && biz.website !== '';

    let shouldSkip = false;
    if (filterNoWebsite && biz.has_website) {
      shouldSkip = true;
      log(`⏭ ${biz.business_name} — has real website`);
    } else if (filterNoWebsite && !filterNoSocial && isSocialOnly) {
      shouldSkip = true;
      log(`⏭ ${biz.business_name} — social media only (enable social filter to include)`);
    }

    if (shouldSkip) {
      fresh.skipped++;
    } else {
      fresh.results.push(biz);
      chrome.runtime.sendMessage({ action: 'NEW_RESULT', business: biz });
      log(`✅ [${fresh.results.length}] ${biz.business_name} — ${statusMsg}`);
    }
  }

  await Utils.setStorage({ [SESSION_KEY]: fresh });

  // Check completion
  if (fresh.results.length >= maxLeads || fresh.currentIndex >= fresh.queue.length) {
    await finishSession(fresh);
    return;
  }

  if (fresh.paused) { log('⏸ Paused'); return; }

  await Utils.sleep(800, 2000); // anti-detection delay
  navigateToNext(fresh);
}

// ── Navigate to next listing URL ──────────────────────────────────────────
function navigateToNext(session) {
  if (!session.active || session.stopped || session.paused) return;
  if (session.currentIndex >= session.queue.length) {
    finishSession(session);
    return;
  }
  const url = session.queue[session.currentIndex];
  if (url) window.location.href = url;
}

// ── Complete the session ──────────────────────────────────────────────────
async function finishSession(session) {
  session.active = false;
  session.phase  = 'DONE';
  await Utils.setStorage({ [SESSION_KEY]: session });

  const n = session.results.length;
  log(`🎉 Complete! ${n} leads · ${session.checked} checked · ${session.skipped} skipped`);
  progress(n, session.config.maxLeads, `Done — ${n} leads collected`);
  chrome.runtime.sendMessage({ action: 'SCRAPE_COMPLETE', count: n, results: session.results });
}

// ── URL helpers ───────────────────────────────────────────────────────────
function isSearchPage(url) { return url.includes('/maps/search') || url.includes('q='); }
function isPlacePage(url)  { return url.includes('/maps/place/'); }
function log(msg)          { chrome.runtime.sendMessage({ action:'LOG', message:msg, time:Utils.timestamp() }); }
function progress(c,t,txt) { chrome.runtime.sendMessage({ action:'PROGRESS', current:c, total:t, text:txt }); }
