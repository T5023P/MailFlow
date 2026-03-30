/**
 * MailFlow — Daily Scheduler Service
 *
 * Runs every day at 8:00 AM UTC.
 * For each campaign with auto_scrape_enabled:
 *   1. Runs the multi-source scraper with the saved query
 *   2. Adds new leads to the campaign
 *   3. If campaign is running, new leads auto-enter the send queue
 */

const cron = require('node-cron');
const supabase = require('../db');
const { scrapeLeads } = require('./scraper');
const { startCampaign } = require('./queue');

async function runDailySchedule() {
  console.log('[Scheduler] ▶ Daily schedule started');

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

        // If campaign is running and new leads were added, the queue will pick them up
        // on its next cycle since they're inserted as 'pending' campaign_leads.
        // If campaign is draft/paused, leads are stored but not sent until launched.

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
  // Run daily at 8:00 AM UTC
  cron.schedule('0 8 * * *', () => {
    console.log('[Scheduler] ▶ Triggering daily auto-scrape...');
    runDailySchedule();
  }, {
    timezone: 'UTC',
  });

  console.log('✦ Cron: Daily auto-scrape scheduler active (8:00 AM UTC)');
}

module.exports = { initScheduler, runDailySchedule };
