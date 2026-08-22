const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/appointmentController');

router.use(authenticate);

router.post('/hold', authorize('patient'), ctrl.holdSlot);
router.post('/confirm', authorize('patient'), ctrl.confirmBooking);
router.get('/mine', ctrl.myAppointments);
router.post('/:id/cancel', ctrl.cancelAppointment);
router.post('/:id/post-visit', authorize('doctor'), ctrl.submitPostVisit);

module.exports = router;
