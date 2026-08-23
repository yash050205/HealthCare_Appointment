const cron = require('node-cron');
const { Op } = require('sequelize');
const { MedicationReminder, User } = require('../models');
const { queueAndSendEmail } = require('../services/emailService');
const templates = require('../services/emailTemplates');

/**
 * Checks every 10 minutes for active medication reminders whose scheduled
 * time has arrived (within the current window) and sends a reminder email.
 * Uses last_sent_at to avoid duplicate sends within the same slot.
 */
function start() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentHHMM = now.toTimeString().slice(0, 5);

      const reminders = await MedicationReminder.findAll({
        where: {
          is_active: true,
          start_date: { [Op.lte]: todayStr },
          end_date: { [Op.gte]: todayStr },
        },
      });

      for (const r of reminders) {
        const times = r.reminder_times || [];
        const due = times.some(t => withinWindow(t, currentHHMM, 10));
        const alreadySentRecently = r.last_sent_at && (now - new Date(r.last_sent_at)) < 9 * 60 * 1000;
        if (!due || alreadySentRecently) continue;

        const patient = await User.findByPk(r.patient_id);
        if (!patient) continue;

        const mail = templates.medicationReminder({
          recipientName: patient.name, medicineName: r.medicine_name, dosage: r.dosage,
        });
        await queueAndSendEmail({
          userId: patient.id, appointmentId: r.appointment_id, type: 'medication_reminder',
          to: patient.email, subject: mail.subject, body: mail.body,
        });
        await r.update({ last_sent_at: now });
      }
    } catch (err) {
      console.error('[medicationReminderJob] error:', err.message);
    }
  });
  console.log('[jobs] medicationReminderJob scheduled (every 10 min)');
}

function withinWindow(scheduledHHMM, currentHHMM, windowMinutes) {
  const [sh, sm] = scheduledHHMM.split(':').map(Number);
  const [ch, cm] = currentHHMM.split(':').map(Number);
  const diff = Math.abs((ch * 60 + cm) - (sh * 60 + sm));
  return diff <= windowMinutes;
}

module.exports = { start };