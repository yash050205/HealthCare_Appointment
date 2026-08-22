const { google } = require('googleapis');
const { CalendarToken } = require('../models');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state, // carries the user id through the OAuth redirect
  });
}

async function saveTokensFromCode(userId, code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  await CalendarToken.upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token, // only present on first consent
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  });

  return tokens;
}

/**
 * Returns an authenticated calendar client for a user, or null if the user
 * hasn't connected Google Calendar. Automatically refreshes access tokens.
 */
async function getCalendarClientForUser(userId) {
  const record = await CalendarToken.findOne({ where: { user_id: userId } });
  if (!record) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: record.access_token,
    refresh_token: record.refresh_token,
    expiry_date: Number(record.expiry_date),
  });

  oauth2Client.on('tokens', async (tokens) => {
    const update = {};
    if (tokens.access_token) update.access_token = tokens.access_token;
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) update.expiry_date = tokens.expiry_date;
    if (Object.keys(update).length) await record.update(update);
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Creates a calendar event for a user. Returns the event id, or null if the
 * user has no calendar connected or the call fails - calendar issues must
 * never block booking.
 */
async function createEvent(userId, { summary, description, startISO, endISO, timeZone }) {
  try {
    const calendar = await getCalendarClientForUser(userId);
    if (!calendar) return null;

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || 'Asia/Kolkata' },
        end: { dateTime: endISO, timeZone: timeZone || 'Asia/Kolkata' },
        reminders: { useDefault: true },
      },
    });
    return res.data.id;
  } catch (err) {
    console.error('[calendarService] createEvent failed:', err.message);
    return null;
  }
}

async function updateEvent(userId, eventId, { summary, description, startISO, endISO, timeZone }) {
  try {
    const calendar = await getCalendarClientForUser(userId);
    if (!calendar || !eventId) return false;

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || 'Asia/Kolkata' },
        end: { dateTime: endISO, timeZone: timeZone || 'Asia/Kolkata' },
      },
    });
    return true;
  } catch (err) {
    console.error('[calendarService] updateEvent failed:', err.message);
    return false;
  }
}

async function deleteEvent(userId, eventId) {
  try {
    const calendar = await getCalendarClientForUser(userId);
    if (!calendar || !eventId) return false;

    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err) {
    console.error('[calendarService] deleteEvent failed:', err.message);
    return false;
  }
}

module.exports = { getAuthUrl, saveTokensFromCode, createEvent, updateEvent, deleteEvent };
