const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { searchDoctors, getAvailableSlots } = require('../controllers/doctorSearchController');

// Public/patient-facing doctor search + slot availability
router.get('/', authenticate, searchDoctors);
router.get('/:id/slots', authenticate, getAvailableSlots);

module.exports = router;
