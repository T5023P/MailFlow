const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET /api/leads/filters — get unique niches and dates
router.get('/filters', async (req, res) => {
  try {
    // Get unique niches (service column)
    const { data: niches } = await supabase
      .from('leads')
      .select('service')
      .not('service', 'is', null);
    
    // Get unique dates (created_at)
    const { data: rawDates } = await supabase
      .from('leads')
      .select('created_at');

    const uniqueNiches = [...new Set(niches.map(n => n.service))].sort();
    const uniqueDates = [...new Set(rawDates.map(d => new Date(d.created_at).toISOString().split('T')[0]))].sort().reverse();

    res.json({ niches: uniqueNiches, dates: uniqueDates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads — paginated list with optional filters
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const niche = req.query.niche;
  const date = req.query.date; // YYYY-MM-DD
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' });

  if (niche) {
    query = query.eq('service', niche);
  }

  if (date) {
    // Filter by date range (start of day to end of day)
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;
    query = query.gte('created_at', start).lte('created_at', end);
  }

  const { data, error, count } = await query
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
