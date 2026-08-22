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
// TEMPORARY SETUP ROUTE - remove this block once migration is done
// ============================================================
app.get('/api/setup/migrate', async (req, res) => {
  if (req.query.key !== process.env.SETUP_KEY) return res.status(403).json({ error: 'forbidden' });
  try {
    const fs = require('fs');
    const path = require('path');
    const mysql = require('mysql2/promise');
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/schema.sql'), 'utf8');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST, port: process.env.DB_PORT,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      multipleStatements: true,
    });
    await connection.query(sql);
    await connection.end();
    res.json({ message: 'Migration complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============================================================
// END TEMPORARY SETUP ROUTE
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
