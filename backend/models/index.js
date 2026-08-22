const sequelize = require('../config/db');
const User = require('./User');
const DoctorProfile = require('./DoctorProfile');
const DoctorLeave = require('./DoctorLeave');
const Slot = require('./Slot');
const Appointment = require('./Appointment');
const MedicationReminder = require('./MedicationReminder');
const Notification = require('./Notification');
const CalendarToken = require('./CalendarToken');

// User <-> DoctorProfile
User.hasOne(DoctorProfile, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DoctorProfile.belongsTo(User, { foreignKey: 'user_id' });

// DoctorProfile <-> DoctorLeave
DoctorProfile.hasMany(DoctorLeave, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });
DoctorLeave.belongsTo(DoctorProfile, { foreignKey: 'doctor_id' });

// DoctorProfile <-> Slot
DoctorProfile.hasMany(Slot, { foreignKey: 'doctor_id', onDelete: 'CASCADE' });
Slot.belongsTo(DoctorProfile, { foreignKey: 'doctor_id' });

// Slot <-> Appointment
Slot.hasOne(Appointment, { foreignKey: 'slot_id' });
Appointment.belongsTo(Slot, { foreignKey: 'slot_id' });

// User (patient) <-> Appointment
User.hasMany(Appointment, { foreignKey: 'patient_id', as: 'patientAppointments' });
Appointment.belongsTo(User, { foreignKey: 'patient_id', as: 'patient' });

// DoctorProfile <-> Appointment
DoctorProfile.hasMany(Appointment, { foreignKey: 'doctor_id' });
Appointment.belongsTo(DoctorProfile, { foreignKey: 'doctor_id', as: 'doctor' });

// Appointment <-> MedicationReminder
Appointment.hasMany(MedicationReminder, { foreignKey: 'appointment_id', onDelete: 'CASCADE' });
MedicationReminder.belongsTo(Appointment, { foreignKey: 'appointment_id' });

// User <-> Notification
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// Appointment <-> Notification
Appointment.hasMany(Notification, { foreignKey: 'appointment_id' });
Notification.belongsTo(Appointment, { foreignKey: 'appointment_id' });

// User <-> CalendarToken
User.hasOne(CalendarToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
CalendarToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  User,
  DoctorProfile,
  DoctorLeave,
  Slot,
  Appointment,
  MedicationReminder,
  Notification,
  CalendarToken,
};
