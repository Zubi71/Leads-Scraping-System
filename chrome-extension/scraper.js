/**
 * scraper.js — Data extraction from Google Maps
 */

// Social media / directory domains that are NOT real websites
const SOCIAL_DOMAINS = [
  'facebook.com','fb.com','instagram.com','twitter.com','x.com',
  'linkedin.com','tiktok.com','youtube.com','yelp.com','tripadvisor.com',
  'zomato.com','foursquare.com','google.com','maps.google.com',
  'justdial.com','sulekha.com','yellowpages.com',
];

function isSocialOrDirectory(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SOCIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch (_) { return false; }
}

const Scraper = {

  // ── Extract full data from current detail page ─────────────────────────
  async extractDetailPage(city, country) {
    // Wait for the business name to load
    const nameEl = await Utils.waitFor(
      'h1.DUwDvf, h1[data-item-id], .fontHeadlineLarge', 8000
    );
    if (!nameEl) return null;

    const name = nameEl.innerText.trim();
    if (!name || name.length < 2) return null;

    // Category
    const category =
      document.querySelector('button.DkEaL')?.innerText.trim() ||
      document.querySelector('.DkEaL')?.innerText.trim() || '';

    // Rating
    let rating = null;
    for (const sel of [
      'span.ceNzKf',
      'div.F7nice span[aria-hidden="true"]',
      '[aria-label*="stars"]',
      '[aria-label*="Rated"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const m = (el.innerText || el.getAttribute('aria-label') || '').match(/[\d.]+/);
      if (m) { rating = parseFloat(m[0]); break; }
    }

    // Review count
    let reviewCount = 0;
    for (const sel of [
      'div.F7nice button span:last-child',
      '[aria-label*="reviews"]',
      '[aria-label*="Reviews"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const m = (el.innerText || el.getAttribute('aria-label') || '').replace(/,/g,'').match(/\d+/);
      if (m) { reviewCount = parseInt(m[0]); break; }
    }

    // Phone
    let phone = '';
    const phoneBtn = document.querySelector(
      '[data-tooltip="Copy phone number"],[aria-label^="Phone"],[aria-label^="Call"]'
    );
    if (phoneBtn) {
      const id = phoneBtn.getAttribute('data-item-id') || '';
      const m  = id.match(/phone:tel:(.+)/);
      phone = m ? m[1] : '';
      if (!phone) {
        const row = phoneBtn.closest('.rogA2c') || phoneBtn.closest('.CsEnBe');
        phone = Utils.cleanPhone(row?.querySelector('.Io6YTe')?.innerText || '');
      }
    }
    if (!phone) {
      document.querySelectorAll('.rogA2c .Io6YTe, .CsEnBe .Io6YTe').forEach(el => {
        if (phone) return;
        const t = el.innerText?.trim() || '';
        if (/^\+?[\d][\d\s\-()+]{6,20}$/.test(t)) phone = Utils.cleanPhone(t);
      });
    }

    // Website — only count as REAL if it's not a social/directory URL
    let website    = '';
    let hasWebsite = false;
    for (const sel of [
      'a[data-item-id="authority"]',
      '[data-tooltip="Open website"]',
      '[aria-label^="Website"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = Utils.cleanUrl(el.href || el.getAttribute('href') || '');
      if (!raw || raw.includes('google.com/maps')) continue;

      website = raw;
      // Only flag as "has website" if it's NOT a social media page
      hasWebsite = !isSocialOrDirectory(raw);
      break;
    }

    // Address
    let address = '';
    for (const sel of [
      '[data-item-id="address"]',
      '[data-tooltip="Copy address"]',
      '[aria-label^="Address"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      address = (el.getAttribute('aria-label') || el.innerText || '')
        .replace(/^Address:\s*/i, '').trim();
      if (address) break;
    }

    const mapsUrl  = window.location.href.split('?')[0];
    const whatsapp = phone && /^\+?\d{10,13}$/.test(phone.replace(/[\s\-()]/g, '')) ? phone : '';

    return {
      business_name:   name,
      category,
      phone,
      whatsapp,
      email:           '',
      website,
      has_website:     hasWebsite,
      website_status:  hasWebsite ? 'Has Website' : (website ? 'Social Media Only' : 'No Website'),
      address,
      city,
      country,
      rating:          rating || '',
      review_count:    reviewCount,
      google_maps_url: mapsUrl,
      scraped_at:      new Date().toISOString(),
    };
  },

  // ── Collect listing URLs by scrolling the search results feed ───────────
  async collectUrls(targetCount) {

    // Find the scrollable results panel — try every known selector
    const findFeed = () => {
      const candidates = [
        'div[role="feed"]',
        '.m6QErb[aria-label]',
        '.m6QErb',
        '[jslog*="moreInfoCard"]',
        '.DxyBCb',
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > window.innerHeight) return el;
      }
      // Last resort: find the tallest scrollable div
      const divs = [...document.querySelectorAll('div')].filter(
        d => d.scrollHeight > 500 && d.clientHeight > 200 && d.scrollHeight > d.clientHeight
      );
      return divs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
    };

    const getUrls = () => {
      const links = document.querySelectorAll(
        'div[role="feed"] a[href*="/maps/place/"], ' +
        '.Nv2PK a[href*="/maps/place/"], ' +
        'a.hfpxzc[href*="/maps/place/"], ' +
        '[jscontroller="AtSb"] a[href*="/maps/place/"]'
      );
      return [...new Set(
        [...links]
          .map(l => { const m = l.href.match(/(https:\/\/www\.google\.com\/maps\/place\/[^?&#]+)/); return m?.[1]; })
          .filter(Boolean)
      )];
    };

    let stale = 0, prev = 0, totalScrolls = 0;
    const MAX_SCROLLS = 40; // allow up to 40 scroll attempts

    while (stale < 5 && totalScrolls < MAX_SCROLLS) {
      const urls = getUrls();
      totalScrolls++;

      chrome.runtime.sendMessage({
        action: 'LOG',
        message: `📍 ${urls.length} listings found (scroll ${totalScrolls})...`,
        time: Utils.timestamp()
      });

      if (urls.length >= targetCount) return urls.slice(0, targetCount);

      // Check for end-of-list text
      const pageText = document.body.innerText;
      if (pageText.includes("You've reached the end") ||
          pageText.includes("No more results") ||
          document.querySelector('.HlvSq')) {
        chrome.runtime.sendMessage({ action:'LOG', message:'📋 Reached end of results', time: Utils.timestamp() });
        break;
      }

      // Scroll the feed panel
      const feed = findFeed();
      if (feed) {
        feed.scrollTop += 600 + Math.random() * 200;
      } else {
        // No feed found — scroll the whole page
        window.scrollBy(0, 600);
      }

      await Utils.sleep(1800, 2800);

      const after = getUrls().length;
      if (after === prev) {
        stale++;
        // Try harder scroll on stale
        if (feed) feed.scrollTop += 1000;
      } else {
        stale = 0;
        prev  = after;
      }
    }

    const final = getUrls();
    chrome.runtime.sendMessage({
      action: 'LOG',
      message: `✅ Collection done: ${final.length} total URLs`,
      time: Utils.timestamp()
    });
    return final.slice(0, targetCount);
  }
};
