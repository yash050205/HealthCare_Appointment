const { sequelize, Slot, Appointment, DoctorProfile, User, MedicationReminder } = require('../models');
const { generatePreVisitSummary, generatePostVisitSummary } = require('../services/llmService');
const { queueAndSendEmail } = require('../services/emailService');
const templates = require('../services/emailTemplates');
const calendarService = require('../services/calendarService');

const HOLD_MINUTES = Number(process.env.SLOT_HOLD_MINUTES || 5);

/**
 * STEP 1 of booking: place a short-lived hold on a slot so the patient can
 * fill in the symptom form without another patient grabbing the same slot.
 * Uses SELECT ... FOR UPDATE inside a transaction so two simultaneous
 * requests for the same slot cannot both succeed - one wins, the other gets
 * a 409. This is the core double-booking prevention mechanism.
 */
async function holdSlot(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { slotId } = req.body;
    const slot = await Slot.findByPk(slotId, { transaction: t, lock: t.LOCK.UPDATE });

    if (!slot) {
      await t.rollback();
      return res.status(404).json({ error: 'Slot not found' });
    }

    const holdActive = slot.status === 'held' && slot.hold_expires_at && new Date(slot.hold_expires_at) > new Date();
    if (slot.status === 'booked' || slot.status === 'blocked' || holdActive) {
      await t.rollback();
      return res.status(409).json({ error: 'This slot is no longer available. Please choose another.' });
    }

    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
    await slot.update(
      { status: 'held', held_by_patient_id: req.user.id, hold_expires_at: holdExpiresAt },
      { transaction: t }
    );

    await t.commit();
    res.json({ slot, holdExpiresAt });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

/**
 * STEP 2 of booking: patient submits symptoms and confirms. Verifies the
 * hold still belongs to this patient and hasn't expired, then atomically
 * creates the appointment and marks the slot 'booked'. Kicks off the
 * pre-visit LLM summary, email confirmations and calendar events - none of
 * which are allowed to break the booking itself if they fail.
 */
async function confirmBooking(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { slotId, symptomText } = req.body;
    const slot = await Slot.findByPk(slotId, { transaction: t, lock: t.LOCK.UPDATE });

    if (!slot) {
      await t.rollback();
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (slot.status !== 'held' || slot.held_by_patient_id !== req.user.id) {
      await t.rollback();
      return res.status(409).json({ error: 'Your hold on this slot has expired. Please select a slot again.' });
    }
    if (new Date(slot.hold_expires_at) < new Date()) {
      await slot.update({ status: 'open', held_by_patient_id: null, hold_expires_at: null }, { transaction: t });
      await t.commit();
      return res.status(409).json({ error: 'Your hold on this slot expired. Please select a slot again.' });
    }

    const doctorProfile = await DoctorProfile.findByPk(slot.doctor_id, { transaction: t, include: [User] });

    const appointment = await Appointment.create({
      patient_id: req.user.id,
      doctor_id: slot.doctor_id,
      slot_id: slot.id,
      appointment_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      symptom_text: symptomText || null,
      status: 'booked',
    }, { transaction: t });

    await slot.update({ status: 'booked', appointment_id: appointment.id }, { transaction: t });

    await t.commit();

    // Everything below is best-effort and must not roll back the booking.
    finalizeBooking(appointment, doctorProfile, req.user).catch(err =>
      console.error('[appointmentController] finalizeBooking error:', err)
    );

    res.status(201).json({ appointment });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

async function finalizeBooking(appointment, doctorProfile, patient) {
  // 1. Pre-visit LLM summary (graceful failure -> status stored, never throws)
  if (appointment.symptom_text) {
    const result = await generatePreVisitSummary(appointment.symptom_text);
    if (result.ok) {
      await appointment.update({ pre_visit_summary: result.data, pre_visit_llm_status: 'success' });
    } else {
      await appointment.update({ pre_visit_llm_status: 'failed' });
    }
  }

  const doctorUser = doctorProfile.User;
  const dateStr = appointment.appointment_date;
  const timeStr = appointment.start_time;

  // 2. Email confirmations
  const patientMail = templates.bookingConfirmation({
    recipientName: patient.name, otherPartyName: doctorUser.name, date: dateStr, startTime: timeStr, role: 'patient',
  });
  await queueAndSendEmail({
    userId: patient.id, appointmentId: appointment.id, type: 'booking_confirmation',
    to: patient.email, subject: patientMail.subject, body: patientMail.body,
  });

  const doctorMail = templates.bookingConfirmation({
    recipientName: doctorUser.name, otherPartyName: patient.name, date: dateStr, startTime: timeStr, role: 'doctor',
  });
  await queueAndSendEmail({
    userId: doctorUser.id, appointmentId: appointment.id, type: 'booking_confirmation',
    to: doctorUser.email, subject: doctorMail.subject, body: doctorMail.body,
  });

  // 3. Google Calendar events (best-effort per user - only if they connected Calendar)
  const startISO = `${dateStr}T${timeStr}`;
  const endISO = `${dateStr}T${appointment.end_time}`;

  const patientEventId = await calendarService.createEvent(patient.id, {
    summary: `Appointment with Dr. ${doctorUser.name}`,
    description: 'Booked via Clinic Appointments',
    startISO, endISO,
  });
  const doctorEventId = await calendarService.createEvent(doctorUser.id, {
    summary: `Appointment with ${patient.name}`,
    description: 'Booked via Clinic Appointments',
    startISO, endISO,
  });

  await appointment.update({
    patient_calendar_event_id: patientEventId,
    doctor_calendar_event_id: doctorEventId,
  });
}

/**
 * Cancels an appointment (by patient or doctor), releases the slot back to
 * 'open', deletes calendar events, and emails both parties.
 */
async function cancelAppointment(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      transaction: t, lock: t.LOCK.UPDATE,
      include: [{ model: User, as: 'patient' }, { model: DoctorProfile, as: 'doctor', include: [User] }],
    });
    if (!appointment) { await t.rollback(); return res.status(404).json({ error: 'Appointment not found' }); }

    const isOwner = req.user.role === 'patient' && appointment.patient_id === req.user.id;
    const isDoctor = req.user.role === 'doctor' && appointment.doctor.user_id === req.user.id;
    if (!isOwner && !isDoctor && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ error: 'Not authorized to cancel this appointment' });
    }
    if (appointment.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ error: 'Appointment already cancelled' });
    }

    const { reason } = req.body;
    await appointment.update({ status: 'cancelled', cancellation_reason: reason || 'Cancelled by user' }, { transaction: t });
    await Slot.update({ status: 'open', held_by_patient_id: null, hold_expires_at: null, appointment_id: null },
      { where: { id: appointment.slot_id }, transaction: t });

    await t.commit();

    // Best-effort cleanup, does not roll back cancellation
    (async () => {
      if (appointment.patient_calendar_event_id) {
        await calendarService.deleteEvent(appointment.patient_id, appointment.patient_calendar_event_id);
      }
      if (appointment.doctor_calendar_event_id) {
        await calendarService.deleteEvent(appointment.doctor.user_id, appointment.doctor_calendar_event_id);
      }
      const mail = templates.cancellation({
        recipientName: appointment.patient.name, date: appointment.appointment_date,
        startTime: appointment.start_time, reason,
      });
      await queueAndSendEmail({
        userId: appointment.patient_id, appointmentId: appointment.id, type: 'cancellation',
        to: appointment.patient.email, subject: mail.subject, body: mail.body,
      });
      const doctorMail = templates.cancellation({
        recipientName: appointment.doctor.User.name, date: appointment.appointment_date,
        startTime: appointment.start_time, reason,
      });
      await queueAndSendEmail({
        userId: appointment.doctor.user_id, appointmentId: appointment.id, type: 'cancellation',
        to: appointment.doctor.User.email, subject: doctorMail.subject, body: doctorMail.body,
      });
    })().catch(err => console.error('[appointmentController] cancel cleanup error:', err));

    res.json({ message: 'Appointment cancelled', appointment });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

async function myAppointments(req, res, next) {
  try {
    const where = req.user.role === 'patient' ? { patient_id: req.user.id } : {};
    let appointments;
    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ where: { user_id: req.user.id } });
      appointments = await Appointment.findAll({
        where: { doctor_id: profile.id },
        include: [{ model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phone'] }],
        order: [['appointment_date', 'DESC']],
      });
    } else {
      appointments = await Appointment.findAll({
        where,
        include: [{ model: DoctorProfile, as: 'doctor', include: [{ model: User, attributes: ['id', 'name'] }] }],
        order: [['appointment_date', 'DESC']],
      });
    }
    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * Doctor submits post-visit notes + prescription. Triggers the LLM to
 * produce a patient-friendly summary, sets up medication reminders, and
 * marks the appointment completed. LLM failure is handled gracefully.
 */
async function submitPostVisit(req, res, next) {
  try {
    const appointment = await Appointment.findByPk(req.params.id, { include: [{ model: User, as: 'patient' }] });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const { notes, prescription } = req.body; // prescription: [{medicine, dosage, frequency_per_day, duration_days}]
    await appointment.update({ doctor_notes: notes, prescription, status: 'completed' });

    const result = await generatePostVisitSummary(notes, prescription);
    if (result.ok) {
      await appointment.update({ post_visit_summary: result.data, post_visit_llm_status: 'success' });
    } else {
      await appointment.update({ post_visit_llm_status: 'failed' });
    }

    // Set up medication reminders from the prescription
    if (Array.isArray(prescription)) {
      const today = new Date();
      for (const med of prescription) {
        const times = defaultReminderTimes(med.frequency_per_day || 1);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (med.duration_days || 5));

        await MedicationReminder.create({
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          medicine_name: med.medicine,
          dosage: med.dosage,
          times_per_day: med.frequency_per_day || 1,
          reminder_times: times,
          start_date: today.toISOString().slice(0, 10),
          end_date: endDate.toISOString().slice(0, 10),
        });
      }
    }

    res.json({ appointment });
  } catch (err) {
    next(err);
  }
}

function defaultReminderTimes(frequencyPerDay) {
  const map = {
    1: ['09:00'],
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
  };
  return map[frequencyPerDay] || ['09:00'];
}

module.exports = { holdSlot, confirmBooking, cancelAppointment, myAppointments, submitPostVisit };
