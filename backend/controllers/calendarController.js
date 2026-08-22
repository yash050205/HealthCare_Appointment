const jwt = require('jsonwebtoken');
const calendarService = require('../services/calendarService');

// Kicks off Google OAuth consent for the logged-in user. The JWT-authenticated
// user id is embedded in `state` (signed) so the callback (which Google hits
// directly, without our auth header) knows who to attach the tokens to.
async function connect(req, res, next) {
  try {
    const state = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = calendarService.getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

async function callback(req, res, next) {
  try {
    const { code, state } = req.query;
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    await calendarService.saveTokensFromCode(decoded.userId, code);

    // Redirect back to the frontend with a success flag
    res.redirect(`${process.env.CLIENT_URL}/calendar-connected`);
  } catch (err) {
    next(err);
  }
}

module.exports = { connect, callback };
