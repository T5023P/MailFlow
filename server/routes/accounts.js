const express = require('express');
const router = express.Router();
const supabase = require('../db');
const { verifySmtp } = require('../services/mailer');

// GET /api/accounts — list all
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/accounts — add new account (with SMTP verification)
router.post('/', async (req, res) => {
  const { email, app_password, daily_cap } = req.body;

  if (!email || !app_password) {
    return res.status(400).json({ error: 'Email and app_password are required.' });
  }

  // Verify SMTP credentials
  const verify = await verifySmtp(email, app_password);
  if (!verify.success) {
    return res.status(400).json({ error: `SMTP verification failed: ${verify.error}` });
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert([{ email, app_password, daily_cap: daily_cap || 40 }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/accounts/:id — toggle is_active or update daily_cap
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = {};

  if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
  if (req.body.daily_cap !== undefined) updates.daily_cap = req.body.daily_cap;

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('accounts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
