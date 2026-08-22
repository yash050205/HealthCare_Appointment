const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Slot = sequelize.define('Slot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  doctor_id: { type: DataTypes.INTEGER, allowNull: false },
  slot_date: { type: DataTypes.DATEONLY, allowNull: false },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time: { type: DataTypes.TIME, allowNull: false },
  status: { type: DataTypes.ENUM('open', 'held', 'booked', 'blocked'), defaultValue: 'open' },
  held_by_patient_id: { type: DataTypes.INTEGER, allowNull: true },
  hold_expires_at: { type: DataTypes.DATE, allowNull: true },
  appointment_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'slots',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Slot;
