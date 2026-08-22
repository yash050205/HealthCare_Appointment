const { Slot, DoctorLeave } = require('../models');
const { Op } = require('sequelize');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Generates (idempotently) open slot rows for a doctor between startDate and
 * endDate (inclusive), based on their working_hours JSON and slot duration.
 * Skips dates the doctor is on leave. Existing slots are left untouched so
 * bookings already made are never clobbered.
 */
async function generateSlotsForDoctor(doctorProfile, startDate, endDate) {
  const { id: doctorId, working_hours: workingHours, slot_duration_minutes: duration } = doctorProfile;

  const leaves = await DoctorLeave.findAll({
    where: { doctor_id: doctorId, leave_date: { [Op.between]: [startDate, endDate] } },
  });
  const leaveDates = new Set(leaves.map(l => l.leave_date));

  const created = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    const isoDate = cursor.toISOString().slice(0, 10);
    const dayKey = DAY_KEYS[cursor.getDay()];
    const dayRanges = workingHours[dayKey] || [];

    if (!leaveDates.has(isoDate)) {
      for (const range of dayRanges) {
        let t = range.start;
        while (toMinutes(t) + duration <= toMinutes(range.end)) {
          const startTime = t;
          const endTime = addMinutes(t, duration);

          const [slot] = await Slot.findOrCreate({
            where: { doctor_id: doctorId, slot_date: isoDate, start_time: startTime },
            defaults: { doctor_id: doctorId, slot_date: isoDate, start_time: startTime, end_time: endTime, status: 'open' },
          });
          created.push(slot);
          t = endTime;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return created;
}

module.exports = { generateSlotsForDoctor, addMinutes, toMinutes };
