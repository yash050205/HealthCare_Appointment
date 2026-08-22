const cron = require('node-cron');
const { Op } = require('sequelize');
const { Appointment, User, DoctorProfile } = require('../models');
const { queueAndSendEmail } = require('../services/emailService');
const templates = require('../services/emailTemplates');

/**
 * Sends a reminder email to patient + doctor for appointments happening
 * tomorrow. Runs once a day.
 */
function start() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const appointments = await Appointment.findAll({
        where: { appointment_date: dateStr, status: 'booked' },
        include: [
          { model: User, as: 'patient' },
          { model: DoctorProfile, as: 'doctor', include: [User] },
        ],
      });

      for (const appt of appointments) {
        const patientMail = templates.reminder({
          recipientName: appt.patient.name, date: dateStr, startTime: appt.start_time,
          otherPartyName: appt.doctor.User.name, role: 'patient',
        });
        await queueAndSendEmail({
          userId: appt.patient_id, appointmentId: appt.id, type: 'reminder',
          to: appt.patient.email, subject: patientMail.subject, body: patientMail.body,
        });

        const doctorMail = templates.reminder({
          recipientName: appt.doctor.User.name, date: dateStr, startTime: appt.start_time,
          otherPartyName: appt.patient.name, role: 'doctor',
        });
        await queueAndSendEmail({
          userId: appt.doctor.user_id, appointmentId: appt.id, type: 'reminder',
          to: appt.doctor.User.email, subject: doctorMail.subject, body: doctorMail.body,
        });
      }
      console.log(`[appointmentReminderJob] sent reminders for ${appointments.length} appointment(s)`);
    } catch (err) {
      console.error('[appointmentReminderJob] error:', err.message);
    }
  });
  console.log('[jobs] appointmentReminderJob scheduled (daily 09:00)');
}

module.exports = { start };
