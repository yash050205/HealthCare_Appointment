const cron = require('node-cron');
const { Notification, User } = require('../models');
const { attemptSend } = require('../services/emailService');

/**
 * Retries failed notifications every 5 minutes (up to max_retries each).
 * This is what makes email delivery resilient to transient SMTP outages
 * without ever blocking the request that originally triggered the email.
 */
function start() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const failed = await Notification.findAll({
        where: { status: 'failed' },
        include: [{ model: User }],
      });
      for (const n of failed) {
        if (n.retry_count >= n.max_retries) continue;
        await attemptSend(n, n.User.email);
      }
    } catch (err) {
      console.error('[notificationRetryJob] error:', err.message);
    }
  });
  console.log('[jobs] notificationRetryJob scheduled (every 5 min)');
}

module.exports = { start };
