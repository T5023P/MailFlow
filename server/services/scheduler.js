const cron = require('node-cron');
const supabase = require('../db');
const { scrapeLeads, scrapeLeadsMultiCity } = require('./scraper');

async function runDailySchedule() {
  console.log('[Scheduler] ▶ Daily schedule started');

  // Fetch scheduler config for global task
  const { data: config, error: configError } = await supabase
    .from('scheduler_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (configError) {
    console.error('[Scheduler] Config error:', configError.message);
  } else if (config && config.enabled) {
    const globalQuery = config.query || "painters decorators";
    console.log(`[Scheduler] Global task starting: "${globalQuery}"`);
    
    try {
      // Automatically run multi-city scraper
      const result = await scrapeLeadsMultiCity({
        query: globalQuery,
        campaignId: null, // Global leads
        sources: ['google_maps', 'google_search'],
        onEvent: (ev) => {
          if (ev.type === 'log') {
            // Simple console logging for progress
            console.log(`[Global Scrape Log] ${ev.data}`);
          }
        }
      });

      console.log(`Scheduled scrape complete: ${result.found} leads found`);
    } catch (err) {
      console.error(`[Global Scrape Error] ${err.message}`);
    }
  } else {
    console.log('[Scheduler] Global auto-scrape is disabled in config.');
  }

  try {
    // Fetch all campaigns with auto-scrape enabled
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('auto_scrape_enabled', true)
      .neq('status', 'done');

    if (error) {
      console.error('[Scheduler] DB error:', error.message);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[Scheduler] No auto-scrape campaigns found.');
      return;
    }

    console.log(`[Scheduler] Found ${campaigns.length} auto-scrape campaign(s)`);

    for (const campaign of campaigns) {
      if (!campaign.auto_scrape_query) {
        console.log(`[Scheduler] Campaign "${campaign.name}" has no scrape query — skipping`);
        continue;
      }

      console.log(`[Scheduler] Running scraper for "${campaign.name}" → "${campaign.auto_scrape_query}"`);

      try {
        const result = await scrapeLeads({
          query: campaign.auto_scrape_query,
          campaignId: campaign.id,
          sources: ['google_maps', 'yell', 'checkatrade', 'trustatrader', 'cylex'],
        });

        console.log(`[Scheduler] "${campaign.name}" — Found: ${result.found}, Saved: ${result.saved}, Skipped: ${result.skipped}`);
      } catch (err) {
        console.error(`[Scheduler] Error scraping for "${campaign.name}":`, err.message);
      }

      // Delay between campaigns to avoid rate limits
      await new Promise(r => setTimeout(r, 5000));
    }

    console.log('[Scheduler] ▶ Daily schedule complete');
  } catch (err) {
    console.error('[Scheduler] Fatal error:', err.message);
  }
}

function initScheduler() {
  // Run daily at 02:00 AM UTC
  cron.schedule('0 2 * * *', () => {
    console.log('[Scheduler] ▶ Triggering daily auto-scrape...');
    runDailySchedule();
  }, {
    timezone: 'UTC',
  });

  console.log('✦ Cron: Daily auto-scrape scheduler active (02:00 AM UTC)');
}

module.exports = { initScheduler, runDailySchedule };
