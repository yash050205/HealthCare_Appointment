const bcrypt = require('bcryptjs');
const { sequelize, User, DoctorProfile, DoctorLeave, Appointment, Notification } = require('../models');
const { generateSlotsForDoctor } = require('../services/slotService');
const { Slot } = require('../models');
const { queueAndSendEmail } = require('../services/emailService');
const templates = require('../services/emailTemplates');
const calendarService = require('../services/calendarService');

// Creates a new doctor: a User(role=doctor) + DoctorProfile in one transaction,
// then pre-generates the next 30 days of slots from their working hours.
async function createDoctor(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { name, email, password, phone, specialization, bio, slot_duration_minutes, working_hours } = req.body;
    if (!name || !email || !password || !specialization || !working_hours) {
      await t.rollback();
      return res.status(400).json({ error: 'name, email, password, specialization and working_hours are required' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await t.rollback();
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password_hash, phone, role: 'doctor' }, { transaction: t });
    const profile = await DoctorProfile.create({
      user_id: user.id,
      specialization,
      bio,
      slot_duration_minutes: slot_duration_minutes || 30,
      working_hours,
    }, { transaction: t });

    await t.commit();

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await generateSlotsForDoctor(profile, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));

    res.status(201).json({ doctor: { ...profile.toJSON(), name, email } });
  } catch (err) {
    await t.rollback().catch(() => {});
    next(err);
  }
}

async function listDoctors(req, res, next) {
  try {
    const doctors = await DoctorProfile.findAll({ include: [{ model: User, attributes: ['id', 'name', 'email', 'phone', 'is_active'] }] });
    res.json({ doctors });
  } catch (err) {
    next(err);
  }
}

async function updateDoctor(req, res, next) {
  try {
    const profile = await DoctorProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Doctor not found' });

    const { specialization, bio, slot_duration_minutes, working_hours } = req.body;
    await profile.update({
      specialization: specialization ?? profile.specialization,
      bio: bio ?? profile.bio,
      slot_duration_minutes: slot_duration_minutes ?? profile.slot_duration_minutes,
      working_hours: working_hours ?? profile.working_hours,
    });

    if (working_hours || slot_duration_minutes) {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      await generateSlotsForDoctor(profile, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }

    res.json({ doctor: profile });
  } catch (err) {
    next(err);
  }
}

/**
 * Marks a doctor on leave for a given date. Any existing 'open' slots on that
 * date are blocked. Any already-booked appointments on that date are
 * cancelled and the affected patients are notified by email + their calendar
 * event is removed - satisfying "affected patients must be notified".
 */
async function markLeave(req, res, next) {
  try {
    const doctorId = Number(req.params.id);
    const { leave_date, reason } = req.body;
    if (!leave_date) return res.status(400).json({ error: 'leave_date is required (YYYY-MM-DD)' });

    const profile = await DoctorProfile.findByPk(doctorId, { include: [User] });
    if (!profile) return res.status(404).json({ error: 'Doctor not found' });

    await DoctorLeave.findOrCreate({
      where: { doctor_id: doctorId, leave_date },
      defaults: { doctor_id: doctorId, leave_date, reason },
    });

    // Block open slots for that date
    await Slot.update(
      { status: 'blocked' },
      { where: { doctor_id: doctorId, slot_date: leave_date, status: 'open' } }
    );

    // Find + cancel booked appointments on that date
    const affected = await Appointment.findAll({
      where: { doctor_id: doctorId, appointment_date: leave_date, status: 'booked' },
      include: [{ model: User, as: 'patient' }],
    });

    const results = [];
    for (const appt of affected) {
      await appt.update({ status: 'cancelled', cancellation_reason: reason || 'Doctor unavailable' });
      await Slot.update({ status: 'blocked' }, { where: { id: appt.slot_id } });

      // Remove calendar events (best-effort, never blocks the cancellation)
      if (appt.patient_calendar_event_id) {
        await calendarService.deleteEvent(appt.patient_id, appt.patient_calendar_event_id);
      }
      if (appt.doctor_calendar_event_id) {
        await calendarService.deleteEvent(profile.user_id, appt.doctor_calendar_event_id);
      }

      const { subject, body } = templates.leaveNotice({
        recipientName: appt.patient.name,
        doctorName: profile.User.name,
        date: leave_date,
        startTime: appt.start_time,
      });
      await queueAndSendEmail({
        userId: appt.patient_id,
        appointmentId: appt.id,
        type: 'leave_notice',
        to: appt.patient.email,
        subject,
        body,
      });

      results.push(appt.id);
    }

    res.json({ message: 'Leave recorded', cancelledAppointments: results });
  } catch (err) {
    next(err);
  }
}

async function listPatients(req, res, next) {
  try {
    const patients = await User.findAll({ where: { role: 'patient' }, attributes: ['id', 'name', 'email', 'phone', 'is_active', 'created_at'] });
    res.json({ patients });
  } catch (err) {
    next(err);
  }
}

async function listAllAppointments(req, res, next) {
  try {
    const appointments = await Appointment.findAll({
      include: [
        { model: User, as: 'patient', attributes: ['id', 'name', 'email'] },
        { model: DoctorProfile, as: 'doctor', include: [{ model: User, attributes: ['id', 'name'] }] },
      ],
      order: [['appointment_date', 'DESC']],
    });
    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

module.exports = { createDoctor, listDoctors, updateDoctor, markLeave, listPatients, listAllAppointments };
