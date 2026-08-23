require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { sequelize } = require('./models');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const calendarRoutes = require('./routes/calendarRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ============================================================
// TEMPORARY DIAGNOSTIC ROUTE - remove once everything is confirmed working
// ============================================================
app.get('/api/setup/status', async (req, res) => {
  try {
    const [tables] = await sequelize.query('SHOW TABLES');
    let syncResult = 'not attempted';
    try {
      await sequelize.sync();
      syncResult = 'sync() ran successfully';
    } catch (syncErr) {
      syncResult = `sync() FAILED: ${syncErr.message}`;
    }
    const [tablesAfter] = await sequelize.query('SHOW TABLES');
    res.json({
      database: process.env.DB_NAME,
      tablesBeforeSync: tables,
      syncResult,
      tablesAfterSync: tablesAfter,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
// ============================================================
// END TEMPORARY DIAGNOSTIC ROUTE
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/calendar', calendarRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Background jobs - each wrapped so one failing to start doesn't crash the server
    try { require('./jobs/slotHoldCleanupJob').start(); } catch (e) { console.error('slotHoldCleanupJob failed to start', e); }
    try { require('./jobs/notificationRetryJob').start(); } catch (e) { console.error('notificationRetryJob failed to start', e); }
    try { require('./jobs/appointmentReminderJob').start(); } catch (e) { console.error('appointmentReminderJob failed to start', e); }
    try { require('./jobs/medicationReminderJob').start(); } catch (e) { console.error('medicationReminderJob failed to start', e); }
  } catch (err) {
    console.error('❌ Unable to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
