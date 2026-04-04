/**
 * MailFlow — Multi-Source Lead Scraper Service
 * 
 * Sources:
 * 1. Google Maps (Native via Puppeteer)
 * 2. Google Search (Native via Puppeteer)
 * 
 * Supports multi-city loop + SSE streaming progress.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const supabase = require('../db');

// Deduplication checks in DB
const urlCache = new Set();
async function isUrlAlreadyScraped(url) {
  if (!url) return false;
  let cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (urlCache.has(cleanUrl)) return true;

  // Check scraped_urls table
  const { data: su } = await supabase.from('scraped_urls').select('id').eq('url', cleanUrl).limit(1);
  if (su && su.length > 0) {
    urlCache.add(cleanUrl);
    return true;
  }

  // Check leads table
  const { data: l } = await supabase.from('leads').select('id').like('custom2', `%${cleanUrl}%`).limit(1);
  if (l && l.length > 0) {
    urlCache.add(cleanUrl);
    return true;
  }

  return false;
}

// Mark URL as scraped
async function markUrlScraped(url) {
  if (!url) return;
  let cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (urlCache.has(cleanUrl)) return;
  await supabase.from('scraped_urls').upsert([{ url: cleanUrl }], { onConflict: 'url', ignoreDuplicates: true });
  urlCache.add(cleanUrl);
}

// ── Config ───────────────────────────────────────────

const UK_CITIES = [
  "Leeds", "Manchester", "Sheffield", "Birmingham",
  "Bristol", "Nottingham", "Liverpool", "Newcastle",
  "Cardiff", "Leicester", "Bradford", "Coventry",
  "Belfast", "Edinburgh", "Glasgow", "Southampton",
  "Portsmouth", "Derby", "Stoke", "Wolverhampton",
  "Plymouth", "Reading", "Luton", "Sunderland",
  "Preston", "Brighton", "Hull", "Bolton",
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const BLOCKED_DOMAINS = [
  'cmskimkc', 'cmskimkcc', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'live.com', 'live.co.uk', 'sentry.io', 'wixpress.com',
  'googleapis.com', 'schema.org', 'w3.org', 'gravatar.com', 'wordpress.org',
  'jquery.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'google.com', 'youtube.com', 'cloudflare.com', 'amazonaws.com',
];

const BLOCKED_PREFIXES = ['noreply', 'no-reply', 'admin@', 'webmaster@', 'sexsexsex', 'support@example', 'info@example'];

// Must end with .com or .co.uk
const ALLOWED_SUFFIXES = ['.com', '.co.uk'];


function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs = 3000, maxMs = 5000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs)
  );
}

// ── Email extraction helpers ─────────────────────────

function validateEmail(e) {
  const email = e.toLowerCase().replace(/\.$/, '').trim();
  if (email.length > 80) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];

  // Must end in .com or .co.uk
  if (!ALLOWED_SUFFIXES.some(suffix => email.endsWith(suffix))) return false;

  // No blocked domains (gmail, yahoo, etc.)
  if (BLOCKED_DOMAINS.some(d => domain.includes(d))) return false;

  // No blocked prefixes
  if (BLOCKED_PREFIXES.some(p => email.startsWith(p))) return false;

  // No image extensions
  if (email.includes('.png') || email.includes('.jpg') || email.includes('.svg') || email.includes('.gif')) return false;

  return true;
}

function extractEmails(html) {
  if (!html) return [];
  const found = html.match(EMAIL_REGEX) || [];
  return [...new Set(found)]
    .map(e => e.toLowerCase().replace(/\.$/, '').trim())
    .filter(validateEmail);
}

async function fetchPageAxios(url, timeoutMs = 8000) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.5',
        'Connection': 'keep-alive',
      },
      timeout: timeoutMs,
      validateStatus: () => true
    });

    if (res.status !== 200) return null;
    const ct = res.headers['content-type'] || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/xhtml')) return null;
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch {
    return null;
  }
}

async function extractEmailsFromWebsite(websiteUrl, log) {
  const emails = [];
  if (!websiteUrl) return emails;

  if (await isUrlAlreadyScraped(websiteUrl)) {
    log(`  → Skipping already scraped URL: ${websiteUrl}`);
    return emails;
  }

  let url = websiteUrl;
  if (!url.startsWith('http')) url = 'https://' + url;

  log(`  → Deep check: ${url}`);

  // Check Homepage
  let homeHtml = await fetchPageAxios(url, 8000);
  if (homeHtml) emails.push(...extractEmails(homeHtml));

  await randomDelay(1000, 2000);

  // Check /contact
  try {
    const contactUrl = new URL('/contact', url).href;
    const contactHtml = await fetchPageAxios(contactUrl, 6000);
    if (contactHtml) emails.push(...extractEmails(contactHtml));
  } catch { /* skip err */ }

  await randomDelay(1000, 2000);

  // Check /about
  try {
    const aboutUrl = new URL('/about', url).href;
    const aboutHtml = await fetchPageAxios(aboutUrl, 6000);
    if (aboutHtml) emails.push(...extractEmails(aboutHtml));
  } catch { /* skip err */ }

  await markUrlScraped(websiteUrl);

  return [...new Set(emails)];
}

async function initBrowser() {
  return await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--memory-pressure-off',
      '--max_old_space_size=256'
    ],
    defaultViewport: { width: 1366, height: 768 }
  });
}

async function autoScroll(page, containerSelector, scrolls = 10) {
  await page.evaluate(async (selector, maxScrolls) => {
    const wrapper = document.querySelector(selector);
    if (!wrapper) return;
    for (let i = 0; i < maxScrolls; i++) {
      wrapper.scrollBy(0, 1000);
      await new Promise(r => setTimeout(r, 1000));
    }
  }, containerSelector, scrolls);
}


// ═══════════════════════════════════════════════════════
// SOURCE 1: Google Maps (Puppeteer Native)
// ═══════════════════════════════════════════════════════

async function scrapeGoogleMapsNative(query, log) {
  const results = [];
  log('[Google Maps Native] Searching...');

  const { keywords, city } = parseQuery(query);
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keywords + ' ' + city)}`;

  let browser;
  try {
    browser = await initBrowser();
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });

    log(`[Google Maps Native] Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle "Accept all" cookies if present
    try {
      const acceptBtn = await page.$('button[aria-label="Accept all"], form[action*="consent"] button');
      if (acceptBtn) {
        log('[Google Maps Native] Accepting cookies...');
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch { }

    // Wait for the main scrollable sidebar
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
      log(`[Google Maps Native] Loading more results (scrolling 10 times)...`);
      await autoScroll(page, 'div[role="feed"]', 10);
      await new Promise(r => setTimeout(r, 2000)); // wait for final load
    } catch (e) {
      log(`[Google Maps Native] Warning: Feed not found. ${e.message}`);
    }

    // Extract basic business cards
    const businesses = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return cards.map(c => {
        const name = c.getAttribute('aria-label') || '';
        const href = c.href || '';
        return { name, href };
      }).filter(b => b.name);
    });

    log(`[Google Maps Native] Found ${businesses.length} mapped businesses.`);

    // Click each card to reveal website
    let count = 0;
    for (const b of businesses) {
      if (count >= 50) break; // Arbitrary cap for sanity per run
      try {
        await page.goto(b.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));

        // Find the website button "Website" or global link
        const websiteUrl = await page.evaluate(() => {
          const wLink = document.querySelector('a[data-item-id="authority"], a[href^="http"]:not([href*="google"])');
          return wLink ? wLink.href : null;
        });

        if (websiteUrl) {
          log(`  ✓ Got URL for ${b.name}: ${websiteUrl}`);
          await randomDelay(3000, 5000);
          const emails = await extractEmailsFromWebsite(websiteUrl, log);

          if (emails.length > 0) {
            log(`    => Extracted Email: ${emails[0]}`);
            results.push({
              name: b.name,
              phone: '',
              website: websiteUrl,
              email: emails[0],
              source: 'Google Maps Native',
              city: city
            });
          }
        }
      } catch (err) {
        // Just skip if navigation fails
      }
      count++;
    }
  } catch (err) {
    log(`[Google Maps Native] Error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  log(`[Google Maps Native] Total valid results: ${results.length}`);
  return results;
}


// ═══════════════════════════════════════════════════════
// SOURCE 2: Google Search Native
// ═══════════════════════════════════════════════════════

async function scrapeGoogleSearchNative(query, log) {
  const results = [];
  log('[Google Search Native] Searching snippets...');

  const { keywords, city } = parseQuery(query);
  const queriesToRun = [
    `"${keywords}" "${city}" email site:*.co.uk`,
    `"${keywords}" "${city}" contact "@"`
  ];

  let browser;
  try {
    browser = await initBrowser();
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });

    for (const qObj of queriesToRun) {
      log(`[Google Search Native] Query: ${qObj}`);
      const searchUrl = `https://www.google.co.uk/search?q=${encodeURIComponent(qObj)}&num=40`;

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      try {
        const acceptBtn = await page.$('button[id="W0wltc"], button[id="L2AGLb"], form[action*="consent"] button');
        if (acceptBtn) {
          log('[Google Search Native] Accepting cookies...');
          await acceptBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch { }

      const html = await page.content();
      if (html.includes('detected unusual traffic') || html.includes('recaptcha')) {
        log('[Google Search Native] ⚠ Blocked by Google CAPTCHA.');
        continue;
      }

      const emailsFound = extractEmails(html);

      for (const email of emailsFound) {
        log(`    ✓ Found Email in snippet: ${email}`);

        // Generate a rough name based on keywords or email domain
        let domainParts = email.split('@')[1].split('.');
        let fallbackName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
        let name = keywords ? keywords.charAt(0).toUpperCase() + keywords.slice(1) : fallbackName;

        results.push({
          name: name,
          phone: '',
          website: '',
          email: email,
          source: 'Google Search Native',
          city: city
        });
      }

      await randomDelay(3000, 5000);
    }
  } catch (err) {
    log(`[Google Search Native] Error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  log(`[Google Search Native] Total valid results: ${results.length}`);
  return results;
}


// ═══════════════════════════════════════════════════════
// Query parser & source map
// ═══════════════════════════════════════════════════════

function parseQuery(query) {
  const words = query.trim().split(/\s+/);
  if (words.length <= 1) return { keywords: query, city: query };
  const city = words[words.length - 1];
  const keywords = words.slice(0, -1).join(' ');
  return { keywords, city };
}

function queryHasCity(query) {
  const words = query.trim().split(/\s+/);
  if (words.length <= 1) return false;
  const lastWord = words[words.length - 1].toLowerCase();
  return UK_CITIES.some(c => c.toLowerCase() === lastWord);
}

const SOURCE_MAP = {
  google_maps: { name: 'Google Maps', fn: scrapeGoogleMapsNative },
  google_search: { name: 'Google Search', fn: scrapeGoogleSearchNative },
};


// ═══════════════════════════════════════════════════════
// Orchestrator Logic
// ═══════════════════════════════════════════════════════

async function scrapeSingleCity({ query, sources, log }) {
  const allResults = [];
  const sourceCounts = {};

  for (const sourceKey of sources) {
    const src = SOURCE_MAP[sourceKey];
    if (!src) continue;

    try {
      const results = await src.fn(query, log);
      sourceCounts[src.name] = (sourceCounts[src.name] || 0) + results.length;
      allResults.push(...results);
    } catch (err) {
      log(`[${src.name}] Fatal error: ${err.message}`);
      sourceCounts[src.name] = sourceCounts[src.name] || 0;
    }
  }

  return { allResults, sourceCounts };
}

function deduplicateResults(allResults) {
  const seenEmails = new Set();
  const seenNames = new Set();
  const uniqueResults = [];

  for (const r of allResults) {
    if (r.email && seenEmails.has(r.email)) continue;
    const normName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normName && seenNames.has(normName)) continue;

    if (r.email) seenEmails.add(r.email);
    if (normName) seenNames.add(normName);
    uniqueResults.push(r);
  }

  return uniqueResults;
}

async function saveResults({ withEmails, query, campaignId, log }) {
  const existingEmails = new Set();
  if (withEmails.length > 0) {
    for (let i = 0; i < withEmails.length; i += 100) {
      const batch = withEmails.slice(i, i + 100).map(r => r.email);
      const { data: existing } = await supabase.from('leads').select('email').in('email', batch);
      if (existing) existing.forEach(e => existingEmails.add(e.email));
    }
  }

  const newLeads = withEmails.filter(r => !existingEmails.has(r.email));
  const skipped = withEmails.length - newLeads.length;

  log(`New leads to save: ${newLeads.length}, Skipping duplicates: ${skipped}`);

  let savedCount = 0;
  const savedLeadIds = [];

  if (newLeads.length > 0) {
    const leadsToInsert = newLeads.map(r => ({
      email: r.email,
      name: r.name || null,
      company: r.name || null,
      city: r.city || null,
      service: query || r.source || null, // Niche name
      custom1: r.phone || null,
      custom2: (r.website || '') + (r.source ? ` (Source: ${r.source})` : ''),
      status: 'pending',
    }));

    for (let i = 0; i < leadsToInsert.length; i += 50) {
      const batch = leadsToInsert.slice(i, i + 50);
      const { data: inserted, error } = await supabase
        .from('leads')
        .upsert(batch, { onConflict: 'email', ignoreDuplicates: true })
        .select();

      if (error) {
        log(`DB Error: ${error.message}`);
      } else if (inserted) {
        savedCount += inserted.length;
        savedLeadIds.push(...inserted.map(l => l.id));
      }
    }

    log(`✓ Saved ${savedCount} new leads to database`);
  }

  if (campaignId && savedLeadIds.length > 0) {
    const { data: accounts } = await supabase.from('accounts').select('id').eq('is_active', true);
    if (accounts && accounts.length > 0) {
      const campaignLeads = savedLeadIds.map((leadId, idx) => ({
        campaign_id: campaignId,
        lead_id: leadId,
        account_id: accounts[idx % accounts.length].id,
        status: 'pending',
      }));

      const { error: clErr } = await supabase.from('campaign_leads').insert(campaignLeads);
      if (clErr) log(`Warning: Error linking leads: ${clErr.message}`);
      else log(`✓ Linked ${savedLeadIds.length} leads to campaign`);

      const { data: campaign } = await supabase.from('campaigns').select('total_leads').eq('id', campaignId).single();
      if (campaign) {
        await supabase.from('campaigns').update({ total_leads: campaign.total_leads + savedLeadIds.length }).eq('id', campaignId);
      }
    } else {
      log('⚠ No active accounts — leads saved but not linked to campaign');
    }
  }

  return { savedCount, skipped };
}


// ═══════════════════════════════════════════════════════
// Main orchestrator — single city 
// ═══════════════════════════════════════════════════════

async function scrapeLeads({ query, campaignId, sources = ['google_maps', 'google_search'] }) {
  const { isQueueRunning } = require('./queue');
  if (isQueueRunning && isQueueRunning()) {
    return {
      found: 0, saved: 0, skipped: 0, sourceCounts: {}, emails: [],
      logs: ['[Scraper] Email sender queue is active. Refusing to start scrape to save memory.']
    };
  }

  const logs = [];
  const log = (msg) => {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  global.scraperRunning = true;
  try {

  log(`Starting multi-source scrape: "${query}"`);

  const { allResults, sourceCounts } = await scrapeSingleCity({ query, sources, log });
  const uniqueResults = deduplicateResults(allResults);
  const withEmails = uniqueResults.filter(r => r.email);
  const { savedCount, skipped } = await saveResults({ withEmails, query, campaignId, log });

  log('\n✦ Scrape complete!');

    return {
      found: withEmails.length,
      saved: savedCount,
      skipped,
      sourceCounts,
      emails: withEmails.map(r => ({
        email: r.email, name: r.name, phone: r.phone || '', website: r.website || '', source: r.source, city: r.city || '',
      })),
      logs,
    };
  } finally {
    global.scraperRunning = false;
  }
}


// ═══════════════════════════════════════════════════════
// Multi-city orchestrator with SSE streaming
// ═══════════════════════════════════════════════════════

async function scrapeLeadsMultiCity({ query, campaignId, sources, onEvent, skipCities = [], resumeFound = 0 }) {
  const { isQueueRunning } = require('./queue');
  if (isQueueRunning && isQueueRunning()) {
    onEvent({ type: 'log', data: '[Scraper] Email sender queue is active. Refusing to start scrape to save memory.' });
    const finalResult = { found: 0, saved: 0, skipped: 0, sourceCounts: {}, citiesScraped: 0, emails: [], logs: ['Skipped scrape: queue running.'] };
    onEvent({ type: 'complete', data: finalResult });
    return finalResult;
  }

  const allCities = UK_CITIES;
  const totalCities = allCities.length;
  const citiesToScrape = allCities.filter(c => !skipCities.includes(c));

  const allResultsGlobal = [];
  const sourceCountsGlobal = {};
  const allLogs = [];

  let totalFoundGlobal = resumeFound;
  let totalSavedGlobal = 0;
  let totalDeduplicatedGlobal = 0;

  const log = (msg) => {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    allLogs.push(line);
    console.log(line);
    onEvent({ type: 'log', data: line });
  };

  global.scraperRunning = true;
  try {

  log(`Starting multi-city scrape: "${query}" across ${citiesToScrape.length} remaining UK cities`);

  const seenEmailsGlobal = new Set();
  const seenNamesGlobal = new Set();

  for (let i = 0; i < citiesToScrape.length; i++) {
    const city = citiesToScrape[i];
    const cityNum = allCities.indexOf(city) + 1;

    // Wait between cities to avoid general Google blocks
    if (i > 0) {
      log(`Waiting 5s before scraping the next city to avoid IP ban...`);
      await randomDelay(5000, 5000);
    }

    onEvent({
      type: 'city_progress',
      data: { city, cityIndex: cityNum, totalCities, totalFound: totalFoundGlobal },
    });

    log(`\n━━━ City ${cityNum}/${totalCities}: ${city} ━━━`);

    let cityResults = [];

    try {
      const { allResults, sourceCounts } = await scrapeSingleCity({ query: `${query} ${city}`, sources, log });

      for (const [name, count] of Object.entries(sourceCounts)) {
        sourceCountsGlobal[name] = (sourceCountsGlobal[name] || 0) + count;
      }

      let cityUniqueResults = [];
      for (const r of allResults) {
        if (r.email && seenEmailsGlobal.has(r.email)) continue;
        const normName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normName && seenNamesGlobal.has(normName)) continue;

        if (r.email) seenEmailsGlobal.add(r.email);
        if (normName) seenNamesGlobal.add(normName);
        cityUniqueResults.push(r);
        allResultsGlobal.push(r);
      }

      const cityWithEmails = cityUniqueResults.filter(r => r.email);
      cityResults = cityWithEmails;
      totalFoundGlobal += cityWithEmails.length;

      // Incrementally Save to DB per City
      if (cityWithEmails.length > 0) {
        log(`Saving ${cityWithEmails.length} leads for ${city}...`);
        const { savedCount, skipped } = await saveResults({ withEmails: cityWithEmails, query, campaignId, log });
        totalSavedGlobal += savedCount;
        totalDeduplicatedGlobal += skipped;
      } else {
        log(`No new valid emails found for ${city}.`);
      }

    } catch (err) {
      log(`[City Error] ${city} failed entirely: ${err.message}`);
    }

    onEvent({
      type: 'city_done',
      data: { city, cityIndex: cityNum, totalCities, totalFound: totalFoundGlobal, totalRaw: cityResults.length },
    });
  }

  log(`\n══════════════════════════════════════`);
  log(`Total accumulated global results: ${allResultsGlobal.length}`);

  log('\n✦ Multi-city scrape complete!');

  const finalResult = {
    found: totalFoundGlobal,
    saved: totalSavedGlobal,
    skipped: totalDeduplicatedGlobal,
    sourceCounts: sourceCountsGlobal,
    citiesScraped: citiesToScrape.length, // Only returned new scraped ones
    emails: allResultsGlobal.filter(r => r.email).map(r => ({
      email: r.email, name: r.name, phone: r.phone || '', website: r.website || '', source: r.source, city: r.city || '',
    })),
    logs: allLogs,
    };

    onEvent({ type: 'complete', data: finalResult });
    return finalResult;
  } finally {
    global.scraperRunning = false;
  }
}


module.exports = { scrapeLeads, scrapeLeadsMultiCity, queryHasCity, SOURCE_MAP, UK_CITIES };
