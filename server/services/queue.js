const supabase = require('../db');
const { sendEmail, personalize } = require('./mailer');

// ── In-memory state ──────────────────────────────────
let running = false;
const activeIntervals = new Map(); // campaignId → timeoutId

// ── Helpers ──────────────────────────────────────────

function randomDelay(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
}

async function resetDailyCountIfNeeded(account) {
  const today = new Date().toISOString().slice(0, 10);
  if (account.last_reset !== today) {
    await supabase
      .from('accounts')
      .update({ sent_today: 0, last_reset: today })
      .eq('id', account.id);
    account.sent_today = 0;
    account.last_reset = today;
  }
}

// ── Core send loop ───────────────────────────────────

async function sendLoop(campaignId) {
  // Fetch campaign
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign || campaign.status !== 'running') {
    activeIntervals.delete(campaignId);
    return;
  }

  // Fetch template
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', campaign.template_id)
    .single();

  if (!template) {
    await supabase.from('campaigns').update({ status: 'done' }).eq('id', campaignId);
    activeIntervals.delete(campaignId);
    return;
  }

  // Get next pending campaign_lead
  const { data: pendingLeads } = await supabase
    .from('campaign_leads')
    .select('*, leads(*), accounts(*)')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(1);

  if (!pendingLeads || pendingLeads.length === 0) {
    // No more pending → mark campaign done
    await supabase.from('campaigns').update({ status: 'done' }).eq('id', campaignId);
    activeIntervals.delete(campaignId);
    return;
  }

  const cl = pendingLeads[0];
  const lead = cl.leads;
  let account = cl.accounts;

  // Reset daily count if date has changed
  if (account) {
    await resetDailyCountIfNeeded(account);
  }

  // Check if account is usable
  if (!account || !account.is_active || account.sent_today >= account.daily_cap) {
    // Try to rotate to another active account
    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('sent_today', { ascending: true });

    let rotatedAccount = null;
    if (activeAccounts) {
      for (const acc of activeAccounts) {
        await resetDailyCountIfNeeded(acc);
        if (acc.sent_today < acc.daily_cap) {
          rotatedAccount = acc;
          break;
        }
      }
    }

    if (!rotatedAccount) {
      // All accounts exhausted — pause campaign
      await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
      activeIntervals.delete(campaignId);
      return;
    }

    account = rotatedAccount;
    // Update the campaign_lead with new account
    await supabase
      .from('campaign_leads')
      .update({ account_id: account.id })
      .eq('id', cl.id);
  }

  // Send email
  const result = await sendEmail({
    fromEmail: account.email,
    appPassword: account.app_password,
    toEmail: lead.email,
    subject: template.subject,
    body: template.body,
    lead,
  });

  if (result.success) {
    // Mark as sent
    await supabase
      .from('campaign_leads')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', cl.id);

    await supabase
      .from('campaigns')
      .update({ sent_count: campaign.sent_count + 1 })
      .eq('id', campaignId);

    await supabase
      .from('accounts')
      .update({ sent_today: account.sent_today + 1 })
      .eq('id', account.id);

    // Update lead status
    await supabase.from('leads').update({ status: 'sent' }).eq('id', lead.id);
  } else {
    // Mark as failed
    await supabase
      .from('campaign_leads')
      .update({ status: 'failed', error: result.error })
      .eq('id', cl.id);

    await supabase
      .from('campaigns')
      .update({ failed_count: campaign.failed_count + 1 })
      .eq('id', campaignId);

    await supabase.from('leads').update({ status: 'failed' }).eq('id', lead.id);
  }

  // Schedule next send with random delay
  const delay = randomDelay(campaign.delay_min, campaign.delay_max);
  const timeoutId = setTimeout(() => sendLoop(campaignId), delay);
  activeIntervals.set(campaignId, timeoutId);
}

// ── Exports ──────────────────────────────────────────

async function startCampaign(campaignId) {
  await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId);
  activeIntervals.set(campaignId, true);
  sendLoop(campaignId);
}

async function pauseCampaign(campaignId) {
  await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
  const tid = activeIntervals.get(campaignId);
  if (tid) clearTimeout(tid);
  activeIntervals.delete(campaignId);
}

async function stopCampaign(campaignId) {
  await supabase.from('campaigns').update({ status: 'done' }).eq('id', campaignId);
  const tid = activeIntervals.get(campaignId);
  if (tid) clearTimeout(tid);
  activeIntervals.delete(campaignId);
}

module.exports = { startCampaign, pauseCampaign, stopCampaign };
