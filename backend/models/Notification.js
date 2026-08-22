const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  appointment_id: { type: DataTypes.INTEGER, allowNull: true },
  type: {
    type: DataTypes.ENUM(
      'booking_confirmation', 'reminder', 'cancellation',
      'leave_notice', 'medication_reminder', 'reschedule'
    ),
    allowNull: false,
  },
  channel: { type: DataTypes.ENUM('email'), defaultValue: 'email' },
  subject: { type: DataTypes.STRING(255) },
  body: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('pending', 'sent', 'failed'), defaultValue: 'pending' },
  retry_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  max_retries: { type: DataTypes.INTEGER, defaultValue: 3 },
  last_error: { type: DataTypes.TEXT, allowNull: true },
  send_after: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Notification;
