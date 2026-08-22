const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CalendarToken = sequelize.define('CalendarToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  access_token: { type: DataTypes.TEXT, allowNull: false },
  refresh_token: { type: DataTypes.TEXT },
  scope: { type: DataTypes.STRING(255) },
  token_type: { type: DataTypes.STRING(50) },
  expiry_date: { type: DataTypes.BIGINT },
}, {
  tableName: 'calendar_tokens',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = CalendarToken;
