require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./db');

const accountsRouter = require('./routes/accounts');
const leadsRouter = require('./routes/leads');
const templatesRouter = require('./routes/templates');
const campaignsRouter = require('./routes/campaigns');
const scraperRouter = require('./routes/scraper');
const followupsRouter = require('./routes/followups');
const cron = require('node-cron');
const { processFollowUps } = require('./services/followups');
const { initScheduler } = require('./services/scheduler');

const app = express();

// ── Middleware ────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// ── Dashboard stats ──────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [
      { count: totalSent },
      { count: totalFailed },
      { count: totalPending },
      { count: activeAccounts },
    ] = await Promise.all([
      supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('campaign_leads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    res.json({
      totalSent: totalSent || 0,
      totalFailed: totalFailed || 0,
      totalPending: totalPending || 0,
      activeAccounts: activeAccounts || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Routes ───────────────────────────────────────────
app.use('/api/accounts', accountsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/campaigns', followupsRouter); // follow-up routes nested under /api/campaigns/:id/...

// ── Cron Jobs ────────────────────────────────────────
// Process follow-ups every hour
cron.schedule('0 * * * *', () => {
  console.log('[Cron] Hourly follow-up check...');
  processFollowUps();
});

// ── Start server ─────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✦ MailFlow server running on http://localhost:${PORT}`);
  console.log('✦ Cron: Hourly follow-up processor active');
  initScheduler();
});
