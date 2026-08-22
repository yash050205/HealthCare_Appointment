const { Op } = require('sequelize');
const { DoctorProfile, User, Slot } = require('../models');

async function searchDoctors(req, res, next) {
  try {
    const { specialization } = req.query;
    const where = {};
    if (specialization) where.specialization = { [Op.like]: `%${specialization}%` };

    const doctors = await DoctorProfile.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
    });

    res.json({ doctors });
  } catch (err) {
    next(err);
  }
}

async function getAvailableSlots(req, res, next) {
  try {
    const doctorId = Number(req.params.id);
    const { from, to } = req.query;

    const startDate = from || new Date().toISOString().slice(0, 10);
    const endDateObj = to ? new Date(to) : new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const slots = await Slot.findAll({
      where: {
        doctor_id: doctorId,
        slot_date: { [Op.between]: [startDate, endDate] },
        status: 'open',
      },
      order: [['slot_date', 'ASC'], ['start_time', 'ASC']],
    });

    res.json({ slots });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchDoctors, getAvailableSlots };
