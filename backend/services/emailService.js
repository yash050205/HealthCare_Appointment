const { Resend } = require('resend');
const { Notification } = require('../models');

let resend = null;
function getClient() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) return null;
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function queueAndSendEmail({ userId, appointmentId = null, type, to, subject, body }) {
  const notification = await Notification.create({
    user_id: userId,
    appointment_id: appointmentId,
    type,
    subject,
    body,
    status: 'pending',
  });

  await attemptSend(notification, to);
  return notification;
}

async function attemptSend(notification, to) {
  const client = getClient();
  if (!client) {
    await notification.update({
      status: 'failed',
      last_error: 'Resend not configured (missing RESEND_API_KEY)',
      retry_count: notification.retry_count + 1,
    });
    console.warn(`[emailService] Resend not configured - notification ${notification.id} left pending for retry`);
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Clinic Appointments <onboarding@resend.dev>',
      to,
      subject: notification.subject,
      html: notification.body,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));

    await notification.update({ status: 'sent' });
    return true;
  } catch (err) {
    console.error(`[emailService] send failed for notification ${notification.id}:`, err.message);
    await notification.update({
      status: 'failed',
      last_error: err.message,
      retry_count: notification.retry_count + 1,
    });
    return false;
  }
}

module.exports = { queueAndSendEmail, attemptSend };