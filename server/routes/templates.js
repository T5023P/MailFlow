const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET /api/templates — list all
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/templates — create
router.post('/', async (req, res) => {
  const { name, subject, body } = req.body;

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'name, subject, and body are required.' });
  }

  const { data, error } = await supabase
    .from('templates')
    .insert([{ name, subject, body }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/templates/:id — update
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = {};

  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.subject !== undefined) updates.subject = req.body.subject;
  if (req.body.body !== undefined) updates.body = req.body.body;

  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('templates').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
