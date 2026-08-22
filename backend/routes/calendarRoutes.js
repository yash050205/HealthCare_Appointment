const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/calendarController');

router.get('/oauth/connect', authenticate, ctrl.connect);
router.get('/oauth/callback', ctrl.callback); // hit directly by Google, no auth header

module.exports = router;
