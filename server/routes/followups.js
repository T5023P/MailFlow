const express = require('express');
const router = express.Router();
const supabase = require('../db');

/**
 * GET /api/campaigns/:id/followups — list follow-ups for a campaign
 */
router.get('/:id/followups', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('*, leads(name, email)')
      .eq('campaign_id', req.params.id)
      .order('scheduled_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/campaigns/:id/leads/:leadId/reply — mark a lead as replied
 * This will skip any pending follow-ups for this lead
 */
router.post('/:id/leads/:leadId/reply', async (req, res) => {
  try {
    const { id: campaignId, leadId } = req.params;

    // Update campaign_lead status to 'replied'
    const { error: clErr } = await supabase
      .from('campaign_leads')
      .update({ status: 'replied' })
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId);

    if (clErr) return res.status(500).json({ error: clErr.message });

    // Skip all pending follow-ups for this lead in this campaign
    const { error: fuErr } = await supabase
      .from('follow_ups')
      .update({ status: 'skipped' })
      .eq('campaign_id', campaignId)
      .eq('lead_id', leadId)
      .eq('status', 'pending');

    if (fuErr) return res.status(500).json({ error: fuErr.message });

    res.json({ success: true, message: 'Lead marked as replied. Pending follow-ups skipped.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
