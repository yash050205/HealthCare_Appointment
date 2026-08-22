const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DoctorProfile = sequelize.define('DoctorProfile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  specialization: { type: DataTypes.STRING(150), allowNull: false },
  bio: { type: DataTypes.TEXT },
  slot_duration_minutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  working_hours: { type: DataTypes.JSON, allowNull: false },
}, {
  tableName: 'doctor_profiles',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = DoctorProfile;
