const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DoctorLeave = sequelize.define('DoctorLeave', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  doctor_id: { type: DataTypes.INTEGER, allowNull: false },
  leave_date: { type: DataTypes.DATEONLY, allowNull: false },
  reason: { type: DataTypes.STRING(255) },
}, {
  tableName: 'doctor_leaves',
  underscored: true,
  timestamps: false,
});

module.exports = DoctorLeave;
