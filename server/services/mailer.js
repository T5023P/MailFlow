const nodemailer = require('nodemailer');

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
 * Send an email via Gmail SMTP using an App Password.
 */
async function sendEmail({ fromEmail, appPassword, toEmail, subject, body, lead }) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: fromEmail,
        pass: appPassword,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });

    try {
      await transporter.verify();
      console.log(`[Mailer] SMTP connection verified for ${fromEmail}`);
    } catch (err) {
      console.log('[Mailer] SMTP verify failed:', err.message);
      return { success: false, error: 'SMTP Connection Error: ' + err.message };
    }

    const personalizedSubject = lead ? personalize(subject, lead) : subject;
    const personalizedBody = lead ? personalize(body, lead) : body;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: personalizedSubject,
      html: personalizedBody,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify SMTP credentials are valid.
 */
async function verifySmtp(email, appPassword) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: email, pass: appPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail, personalize, verifySmtp };
