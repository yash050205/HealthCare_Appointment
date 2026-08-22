const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MedicationReminder = sequelize.define('MedicationReminder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  appointment_id: { type: DataTypes.INTEGER, allowNull: false },
  patient_id: { type: DataTypes.INTEGER, allowNull: false },
  medicine_name: { type: DataTypes.STRING(150), allowNull: false },
  dosage: { type: DataTypes.STRING(100) },
  times_per_day: { type: DataTypes.INTEGER, defaultValue: 1 },
  reminder_times: { type: DataTypes.JSON, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_sent_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'medication_reminders',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = MedicationReminder;
