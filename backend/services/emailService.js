const nodemailer = require('nodemailer');
const { Notification } = require('../models');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return transporter;
}

/**
 * Queues a notification row (status=pending) and immediately attempts to send it.
 * If sending fails (SMTP down, bad credentials, etc.) the row is left/marked so the
 * background retry job (see jobs/notificationRetryJob.js) can pick it up later.
 * This keeps booking/cancellation flows from failing just because email is down.
 */
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
  const t = getTransporter();
  if (!t) {
    await notification.update({
      status: 'failed',
      last_error: 'SMTP not configured',
      retry_count: notification.retry_count + 1,
    });
    console.warn(`[emailService] SMTP not configured - notification ${notification.id} left pending for retry`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@clinic.com',
      to,
      subject: notification.subject,
      html: notification.body,
    });
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

module.exports = { queueAndSendEmail, attemptSend, getTransporter };
