const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Replace all {{variable}} placeholders in a string with lead data.
 */
function personalize(template, lead) {
  if (!template) return '';
  return template
    .replace(/\{\{name\}\}/gi, lead.name || '')
    .replace(/\{\{email\}\}/gi, lead.email || '')
    .replace(/\{\{company\}\}/gi, lead.company || '')
    .replace(/\{\{city\}\}/gi, lead.city || '')
    .replace(/\{\{service\}\}/gi, lead.service || '')
    .replace(/\{\{custom1\}\}/gi, lead.custom1 || '')
    .replace(/\{\{custom2\}\}/gi, lead.custom2 || '');
}

/**
 * Send an email via Resend API
 */
async function sendEmail({ fromEmail, appPassword, toEmail, subject, body, lead }) {
  try {
    const personalizedSubject = lead ? personalize(subject, lead) : subject;
    const personalizedBody = lead ? personalize(body, lead) : body;

    const { data, error } = await resend.emails.send({
      from: 'arsh@arshdigital.online',
      to: toEmail,
      subject: personalizedSubject,
      html: personalizedBody,
    });

    if (error) {
      console.error('[Mailer] Resend API Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify SMTP credentials are valid.
 * Bypass for Resend since API keys are handled natively.
 */
async function verifySmtp(email, appPassword) {
  return { success: true };
}

module.exports = { sendEmail, personalize, verifySmtp };
