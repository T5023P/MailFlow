-- MailFlow — Schema Migration for New Features
-- Run this in Supabase SQL Editor AFTER creating base tables from schema.sql

-- ═══════════════════════════════════════════════════════
-- Feature 1 & 3: Auto-Scrape fields on campaigns
-- ═══════════════════════════════════════════════════════
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_scrape_query text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_scrape_enabled boolean DEFAULT false;

-- ═══════════════════════════════════════════════════════
-- Feature 2: Follow-up settings on campaigns
-- ═══════════════════════════════════════════════════════
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS followup_enabled boolean DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS followup1_delay_days integer DEFAULT 3;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS followup1_template_id uuid REFERENCES templates(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS followup2_delay_days integer DEFAULT 7;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS followup2_template_id uuid REFERENCES templates(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════
-- Feature 2: Follow-ups table
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS follow_ups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id           uuid REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_number  integer NOT NULL,            -- 1 or 2
  scheduled_at      timestamptz NOT NULL,
  sent_at           timestamptz,
  status            text DEFAULT 'pending',      -- pending | sent | failed | skipped
  created_at        timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- Feature 2: Add 'replied' status support to campaign_leads
-- ═══════════════════════════════════════════════════════
-- (No schema change needed — status column already accepts any text value.
--  We'll use 'replied' as a new status value alongside pending/sent/failed.)

-- ═══════════════════════════════════════════════════════
-- Feature: Scraper deduplication (scraped_urls)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scraped_urls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text UNIQUE NOT NULL,
  scraped_at  timestamptz DEFAULT now()
);

-- Migration: Add scheduler_config table
CREATE TABLE IF NOT EXISTS scheduler_config (
  id integer PRIMARY KEY DEFAULT 1,
  query text DEFAULT 'painters decorators',
  enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO scheduler_config (id, query, enabled) 
VALUES (1, 'painters decorators', true)
ON CONFLICT (id) DO NOTHING;
