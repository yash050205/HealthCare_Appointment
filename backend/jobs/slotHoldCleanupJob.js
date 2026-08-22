const cron = require('node-cron');
const { Op } = require('sequelize');
const { Slot } = require('../models');

/**
 * Releases slots whose hold has expired back to 'open' so other patients
 * can book them. Runs every minute.
 */
function start() {
  cron.schedule('* * * * *', async () => {
    try {
      const [count] = await Slot.update(
        { status: 'open', held_by_patient_id: null, hold_expires_at: null },
        { where: { status: 'held', hold_expires_at: { [Op.lt]: new Date() } } }
      );
      if (count > 0) console.log(`[slotHoldCleanupJob] released ${count} expired hold(s)`);
    } catch (err) {
      console.error('[slotHoldCleanupJob] error:', err.message);
    }
  });
  console.log('[jobs] slotHoldCleanupJob scheduled (every 1 min)');
}

module.exports = { start };
