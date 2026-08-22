const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patient_id: { type: DataTypes.INTEGER, allowNull: false },
  doctor_id: { type: DataTypes.INTEGER, allowNull: false },
  slot_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  appointment_date: { type: DataTypes.DATEONLY, allowNull: false },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time: { type: DataTypes.TIME, allowNull: false },
  status: { type: DataTypes.ENUM('booked', 'completed', 'cancelled'), defaultValue: 'booked' },

  symptom_text: { type: DataTypes.TEXT },
  pre_visit_summary: { type: DataTypes.JSON, allowNull: true },
  pre_visit_llm_status: { type: DataTypes.ENUM('pending', 'success', 'failed'), defaultValue: 'pending' },

  doctor_notes: { type: DataTypes.TEXT, allowNull: true },
  prescription: { type: DataTypes.JSON, allowNull: true },
  post_visit_summary: { type: DataTypes.TEXT, allowNull: true },
  post_visit_llm_status: { type: DataTypes.ENUM('pending', 'success', 'failed'), defaultValue: 'pending' },

  patient_calendar_event_id: { type: DataTypes.STRING(255), allowNull: true },
  doctor_calendar_event_id: { type: DataTypes.STRING(255), allowNull: true },

  cancellation_reason: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'appointments',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Appointment;
