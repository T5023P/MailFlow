const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET /api/leads — paginated list
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page, limit });
});

// POST /api/leads — add single lead
router.post('/', async (req, res) => {
  const { email, name, company, city, service, custom1, custom2 } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const { data, error } = await supabase
    .from('leads')
    .insert([{ email, name, company, city, service, custom1, custom2 }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/leads/bulk — bulk upsert (skip duplicates by email)
router.post('/bulk', async (req, res) => {
  const leads = req.body.leads;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'Provide an array of leads.' });
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'email', ignoreDuplicates: true })
    .select();

  if (error) return res.status(500).json({ error: error.message });

  const imported = data ? data.length : 0;
  const skipped = leads.length - imported;

  res.json({ imported, skipped, data });
});

// DELETE /api/leads/:id — delete single lead
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/leads — delete all leads
router.delete('/', async (req, res) => {
  const { error } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
