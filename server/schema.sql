-- MailFlow Database Schema
-- Run this in Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- 1. Accounts — Gmail senders with app passwords
CREATE TABLE IF NOT EXISTS accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  app_password text NOT NULL,
  daily_cap   integer DEFAULT 40,
  sent_today  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  last_reset  date DEFAULT current_date,
  created_at  timestamptz DEFAULT now()
);

-- 2. Leads — contacts to email
CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text,
  company     text,
  city        text,
  service     text,
  custom1     text,
  custom2     text,
  status      text DEFAULT 'pending',   -- pending | sent | failed
  created_at  timestamptz DEFAULT now()
);

-- 3. Templates — email templates with variable placeholders
CREATE TABLE IF NOT EXISTS templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 4. Campaigns — email campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  template_id   uuid REFERENCES templates(id) ON DELETE SET NULL,
  status        text DEFAULT 'draft',   -- draft | running | paused | done
  delay_min     integer DEFAULT 30,
  delay_max     integer DEFAULT 90,
  total_leads   integer DEFAULT 0,
  sent_count    integer DEFAULT 0,
  failed_count  integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 5. Campaign Leads — junction table linking campaigns, leads, and accounts
CREATE TABLE IF NOT EXISTS campaign_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  account_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status        text DEFAULT 'pending',   -- pending | sent | failed
  sent_at       timestamptz,
  error         text
);
