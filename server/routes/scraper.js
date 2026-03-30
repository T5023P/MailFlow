const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { scrapeLeads, scrapeLeadsMultiCity, queryHasCity, UK_CITIES } = require('../services/scraper');

/**
 * POST /api/scraper/run
 * Body: { query: string, campaign_id?: string, sources?: string[] }
 * Returns: { found, saved, skipped, sourceCounts, emails[], logs[] }
 * 
 * If query has no city, auto-loops through all UK cities.
 */
router.post('/run', async (req, res) => {
  const { query, campaign_id, sources } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query is required (min 2 characters).' });
  }

  try {
    const result = await scrapeLeads({
      query: query.trim(),
      campaignId: campaign_id || null,
      sources: sources || ['google_maps', 'google_search'],
    });

    res.json(result);
  } catch (err) {
    console.error('Scraper error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * GET /api/scraper/stream
 * Query params: query, campaign_id, sources (comma-separated)
 * 
 * SSE endpoint — streams real-time progress for multi-city scraping.
 * If query contains a city, runs single-city mode.
 * If query has no city, loops all 28 UK cities with live progress.
 */
router.get('/stream', async (req, res) => {
  const { query, campaign_id, sources: sourcesParam, skip_cities, resume_found } = req.query;

  if (!query || query.trim().length < 2) {
    res.status(400).json({ error: 'Search query is required.' });
    return;
  }

  const sources = sourcesParam
    ? sourcesParam.split(',')
    : ['google_maps', 'google_search'];

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Helper to send SSE events
  const sendEvent = (eventObj) => {
    try {
      res.write(`data: ${JSON.stringify(eventObj)}\n\n`);
    } catch { /* client disconnected */ }
  };

  // Handle client disconnect
  let aborted = false;
  req.on('close', () => { aborted = true; });

  const hasCity = queryHasCity(query.trim());

  try {
    if (hasCity) {
      // Single-city mode — run directly and stream logs
      sendEvent({ type: 'mode', data: { mode: 'single_city', query: query.trim() } });

      const logs = [];
      const log = (msg) => {
        const ts = new Date().toLocaleTimeString();
        const line = `[${ts}] ${msg}`;
        logs.push(line);
        sendEvent({ type: 'log', data: line });
      };

      const result = await scrapeLeads({
        query: query.trim(),
        campaignId: campaign_id || null,
        sources,
      });

      sendEvent({ type: 'complete', data: result });
    } else {
      // Multi-city mode
      sendEvent({
        type: 'mode',
        data: {
          mode: 'multi_city',
          query: query.trim(),
          totalCities: UK_CITIES.length,
          cities: UK_CITIES,
        },
      });

      await scrapeLeadsMultiCity({
        query: query.trim(),
        campaignId: campaign_id || null,
        sources,
        onEvent: sendEvent,
        skipCities: skip_cities ? skip_cities.split(',') : [],
        resumeFound: resume_found ? parseInt(resume_found, 10) : 0,
      });
    }
  } catch (err) {
    sendEvent({ type: 'error', data: err.message });
  }

  res.end();
});


/**
 * GET /api/scraper/cities
 * Returns the list of UK cities used for multi-city scraping.
 */
router.get('/cities', (req, res) => {
  res.json({ cities: UK_CITIES, count: UK_CITIES.length });
});

/**
 * GET /api/scraper/config
 * Returns current scheduler configuration.
 */
router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scheduler_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/scraper/config
 * Updates scheduler query and enabled status.
 */
router.patch('/config', async (req, res) => {
  const { query, enabled } = req.body;
  const updates = { updated_at: new Date() };
  if (query !== undefined) updates.query = query;
  if (enabled !== undefined) updates.enabled = enabled;

  try {
    const { data, error } = await supabase
      .from('scheduler_config')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
