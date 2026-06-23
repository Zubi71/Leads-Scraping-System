/**
 * background.js — Service Worker
 * Relays messages between popup and content script.
 * Real state is stored in chrome.storage.local (survives SW restart).
 */

// In-memory cache for popup live updates
let cache = { results: [], logs: [], progress: { current:0, total:0, text:'Idle' }, running: false };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── From popup ──────────────────────────────────────────────────────────
  if (msg.from === 'popup') {
    switch (msg.action) {

      case 'GET_STATE':
        // Merge cache with storage
        chrome.storage.local.get('aiLeadsSession', d => {
          const session = d.aiLeadsSession;
          sendResponse({
            running:  session?.active  || false,
            paused:   session?.paused  || false,
            results:  session?.results || cache.results,
            logs:     cache.logs,
            progress: cache.progress,
          });
        });
        return true;

      case 'START': {
        cache = { results:[], logs:[], progress:{ current:0, total:msg.config.maxLeads, text:'Starting...' }, running:true };
        // Clear old session
        chrome.storage.local.remove('aiLeadsSession');

        const query  = `${msg.config.niche} in ${msg.config.city}, ${msg.config.country}`;
        const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

        chrome.tabs.create({ url: mapUrl, active: true }, tab => {
          const onLoad = (tabId, info) => {
            if (tabId !== tab.id || info.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(onLoad);
            // Give Maps JS time to render then start
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'START_SCRAPE', config: msg.config }, resp => {
                if (chrome.runtime.lastError) {
                  // Content script not ready yet — retry once
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, { action: 'START_SCRAPE', config: msg.config });
                  }, 3000);
                }
              });
            }, 4000);
          };
          chrome.tabs.onUpdated.addListener(onLoad);
        });
        sendResponse({ ok: true });
        return true;
      }

      case 'PAUSE':
        chrome.storage.local.get('aiLeadsSession', d => {
          if (d.aiLeadsSession?.tabId) {
            chrome.tabs.sendMessage(d.aiLeadsSession.tabId, { action:'PAUSE_SCRAPE' });
          }
        });
        sendResponse({ ok: true });
        return true;

      case 'RESUME':
        chrome.storage.local.get('aiLeadsSession', d => {
          if (d.aiLeadsSession?.tabId) {
            chrome.tabs.sendMessage(d.aiLeadsSession.tabId, { action:'RESUME_SCRAPE' });
          }
        });
        sendResponse({ ok: true });
        return true;

      case 'STOP':
        chrome.storage.local.get('aiLeadsSession', d => {
          if (d.aiLeadsSession?.tabId) {
            chrome.tabs.sendMessage(d.aiLeadsSession.tabId, { action:'STOP_SCRAPE' });
          }
        });
        cache.running = false;
        sendResponse({ ok: true });
        return true;

      case 'CLEAR':
        cache = { results:[], logs:[], progress:{ current:0, total:0, text:'Idle' }, running:false };
        chrome.storage.local.remove('aiLeadsSession');
        sendResponse({ ok: true });
        return true;
    }
    return true;
  }

  // ── From content script ─────────────────────────────────────────────────
  if (msg.action === 'LOG') {
    const entry = { message: msg.message, time: msg.time || new Date().toLocaleTimeString() };
    cache.logs.push(entry);
    if (cache.logs.length > 300) cache.logs.shift();
    // Relay to popup
    chrome.runtime.sendMessage({ ...msg, relayed: true }).catch(() => {});
  }

  if (msg.action === 'PROGRESS') {
    cache.progress = { current: msg.current, total: msg.total, text: msg.text };
    chrome.runtime.sendMessage({ ...msg, relayed: true }).catch(() => {});
  }

  if (msg.action === 'NEW_RESULT') {
    cache.results.push(msg.business);
    chrome.runtime.sendMessage({ ...msg, relayed: true }).catch(() => {});
  }

  if (msg.action === 'SCRAPE_COMPLETE') {
    cache.running = false;
    if (msg.results) cache.results = msg.results;
    chrome.runtime.sendMessage({ ...msg, relayed: true }).catch(() => {});
  }
});
