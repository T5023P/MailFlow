/**
 * MailFlow — Follow-Up Sequences Service
 *
 * Automatically schedules and sends follow-up emails
 * after the initial campaign email is sent.
 */

const supabase = require('../db');
const { sendEmail } = require('./mailer');

// ── Schedule follow-ups after initial send ───────────

async function scheduleFollowUps(campaignId, leadId, sentAt) {
  try {
    // Fetch campaign with follow-up settings
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign || !campaign.followup_enabled) return;

    const sentDate = new Date(sentAt);

    // Schedule follow-up 1
    if (campaign.followup1_template_id && campaign.followup1_delay_days > 0) {
      const scheduledAt1 = new Date(sentDate);
      scheduledAt1.setDate(scheduledAt1.getDate() + campaign.followup1_delay_days);

      await supabase.from('follow_ups').insert([{
        campaign_id: campaignId,
        lead_id: leadId,
        follow_up_number: 1,
        scheduled_at: scheduledAt1.toISOString(),
        status: 'pending',
      }]);
    }

    // Schedule follow-up 2 (scheduled relative to initial send)
    if (campaign.followup2_template_id && campaign.followup2_delay_days > 0) {
      const scheduledAt2 = new Date(sentDate);
      scheduledAt2.setDate(scheduledAt2.getDate() + campaign.followup2_delay_days);

      await supabase.from('follow_ups').insert([{
        campaign_id: campaignId,
        lead_id: leadId,
        follow_up_number: 2,
        scheduled_at: scheduledAt2.toISOString(),
        status: 'pending',
      }]);
    }
  } catch (err) {
    console.error('Error scheduling follow-ups:', err.message);
  }
}


// ── Process pending follow-ups (called by cron) ──────

async function processFollowUps() {
  console.log('[FollowUps] Processing pending follow-ups...');

  try {
    const now = new Date().toISOString();

    // Get all pending follow-ups that are due
    const { data: pendingFollowUps, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[FollowUps] DB error:', error.message);
      return;
    }

    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      console.log('[FollowUps] No pending follow-ups due.');
      return;
    }

    console.log(`[FollowUps] Found ${pendingFollowUps.length} due follow-ups`);

    for (const fu of pendingFollowUps) {
      try {
        // Check if lead has been marked as replied
        const { data: campaignLead } = await supabase
          .from('campaign_leads')
          .select('status')
          .eq('campaign_id', fu.campaign_id)
          .eq('lead_id', fu.lead_id)
          .single();

        if (campaignLead && campaignLead.status === 'replied') {
          // Skip — lead has replied
          await supabase
            .from('follow_ups')
            .update({ status: 'skipped' })
            .eq('id', fu.id);
          console.log(`[FollowUps] Skipped FU#${fu.follow_up_number} for lead ${fu.lead_id} (replied)`);
          continue;
        }

        // Fetch campaign to get the right template
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', fu.campaign_id)
          .single();

        if (!campaign) continue;

        // Get the right template for this follow-up number
        const templateId = fu.follow_up_number === 1
          ? campaign.followup1_template_id
          : campaign.followup2_template_id;

        if (!templateId) {
          await supabase
            .from('follow_ups')
            .update({ status: 'skipped' })
            .eq('id', fu.id);
          continue;
        }

        // Fetch template
        const { data: template } = await supabase
          .from('templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) {
          await supabase
            .from('follow_ups')
            .update({ status: 'failed' })
            .eq('id', fu.id);
          continue;
        }

        // Fetch lead
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', fu.lead_id)
          .single();

        if (!lead) continue;

        // Get an active account to send from
        const { data: accounts } = await supabase
          .from('accounts')
          .select('*')
          .eq('is_active', true)
          .order('sent_today', { ascending: true })
          .limit(1);

        if (!accounts || accounts.length === 0) {
          console.log('[FollowUps] No active accounts available');
          break; // Stop processing — no accounts
        }

        const account = accounts[0];

        // Reset daily count if needed
        const today = new Date().toISOString().slice(0, 10);
        if (account.last_reset !== today) {
          await supabase
            .from('accounts')
            .update({ sent_today: 0, last_reset: today })
            .eq('id', account.id);
          account.sent_today = 0;
        }

        if (account.sent_today >= account.daily_cap) {
          console.log('[FollowUps] Account daily cap reached');
          break;
        }

        // Send the follow-up email
        const result = await sendEmail({
          fromEmail: account.email,
          appPassword: account.app_password,
          toEmail: lead.email,
          subject: template.subject,
          body: template.body,
          lead,
        });

        if (result.success) {
          await supabase
            .from('follow_ups')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', fu.id);

          await supabase
            .from('accounts')
            .update({ sent_today: account.sent_today + 1 })
            .eq('id', account.id);

          console.log(`[FollowUps] ✓ Sent FU#${fu.follow_up_number} to ${lead.email}`);
        } else {
          await supabase
            .from('follow_ups')
            .update({ status: 'failed' })
            .eq('id', fu.id);

          console.log(`[FollowUps] ✗ Failed FU#${fu.follow_up_number} to ${lead.email}: ${result.error}`);
        }

        // Small delay between sends
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        console.error(`[FollowUps] Error processing follow-up ${fu.id}:`, err.message);
      }
    }

    console.log('[FollowUps] Processing complete.');
  } catch (err) {
    console.error('[FollowUps] Fatal error:', err.message);
  }
}

module.exports = { scheduleFollowUps, processFollowUps };
