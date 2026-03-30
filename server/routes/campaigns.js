const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { startCampaign, pauseCampaign, stopCampaign } = require('../services/queue');

// GET /api/campaigns — list all with stats
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, templates(name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/campaigns — create campaign with round-robin lead assignment
router.post('/', async (req, res) => {
  const {
    name, template_id, lead_ids, delay_min, delay_max,
    followup_enabled, followup1_delay_days, followup1_template_id,
    followup2_delay_days, followup2_template_id,
    auto_scrape_query, auto_scrape_enabled,
  } = req.body;

  if (!name || !template_id || !lead_ids || lead_ids.length === 0) {
    return res.status(400).json({ error: 'name, template_id, and lead_ids are required.' });
  }

  // Create campaign
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .insert([{
      name,
      template_id,
      delay_min: delay_min || 30,
      delay_max: delay_max || 90,
      total_leads: lead_ids.length,
      followup_enabled: followup_enabled || false,
      followup1_delay_days: followup1_delay_days || 3,
      followup1_template_id: followup1_template_id || null,
      followup2_delay_days: followup2_delay_days || 7,
      followup2_template_id: followup2_template_id || null,
      auto_scrape_query: auto_scrape_query || null,
      auto_scrape_enabled: auto_scrape_enabled || false,
    }])
    .select()
    .single();

  if (cErr) return res.status(500).json({ error: cErr.message });

  // Fetch active accounts for round-robin
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('is_active', true);

  if (!accounts || accounts.length === 0) {
    return res.status(400).json({ error: 'No active accounts. Add at least one account first.' });
  }

  // Build campaign_leads with round-robin account assignment
  const campaignLeads = lead_ids.map((leadId, idx) => ({
    campaign_id: campaign.id,
    lead_id: leadId,
    account_id: accounts[idx % accounts.length].id,
    status: 'pending',
  }));

  const { error: clErr } = await supabase.from('campaign_leads').insert(campaignLeads);
  if (clErr) return res.status(500).json({ error: clErr.message });

  res.status(201).json(campaign);
});

// POST /api/campaigns/:id/launch — start sending
router.post('/:id/launch', async (req, res) => {
  try {
    await startCampaign(req.params.id);
    res.json({ success: true, status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    await pauseCampaign(req.params.id);
    res.json({ success: true, status: 'paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns/:id/stop
router.post('/:id/stop', async (req, res) => {
  try {
    await stopCampaign(req.params.id);
    res.json({ success: true, status: 'done' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/leads — campaign lead details
router.get('/:id/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('campaign_leads')
    .select('*, leads(name, email, company, city), accounts(email)')
    .eq('campaign_id', req.params.id)
    .order('sent_at', { ascending: false, nullsFirst: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/campaigns/:id — update campaign settings
router.patch('/:id', async (req, res) => {
  const allowed = [
    'name', 'template_id', 'delay_min', 'delay_max',
    'followup_enabled', 'followup1_delay_days', 'followup1_template_id',
    'followup2_delay_days', 'followup2_template_id',
    'auto_scrape_query', 'auto_scrape_enabled',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
