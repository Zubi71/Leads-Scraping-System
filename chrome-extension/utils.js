/**
 * utils.js — Shared utilities loaded by all content scripts
 */
const Utils = {

  sleep(min = 1000, max = 2500) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(r => setTimeout(r, ms));
  },

  /** Poll until selector appears, with timeout */
  waitFor(selector, timeout = 8000, root = document) {
    return new Promise(resolve => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);
      const start = Date.now();
      const poll  = setInterval(() => {
        const found = root.querySelector(selector);
        if (found || Date.now() - start > timeout) {
          clearInterval(poll);
          resolve(found || null);
        }
      }, 250);
    });
  },

  cleanPhone(raw) {
    if (!raw) return '';
    return raw.replace(/^Phone:\s*/i, '').replace(/[^\d+\-\s().]/g, '').trim();
  },

  cleanUrl(url) {
    if (!url) return '';
    try {
      if (url.includes('google.com/url') || url.startsWith('/url?')) {
        const u = new URL(url, 'https://www.google.com');
        return u.searchParams.get('q') || u.searchParams.get('url') || url;
      }
    } catch (_) {}
    return url;
  },

  timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  },

  getStorage(keys) {
    return new Promise(r => chrome.storage.local.get(keys, r));
  },

  setStorage(obj) {
    return new Promise(r => chrome.storage.local.set(obj, r));
  }
};
