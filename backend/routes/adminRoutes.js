const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.post('/doctors', ctrl.createDoctor);
router.get('/doctors', ctrl.listDoctors);
router.put('/doctors/:id', ctrl.updateDoctor);
router.post('/doctors/:id/leave', ctrl.markLeave);

router.get('/patients', ctrl.listPatients);
router.get('/appointments', ctrl.listAllAppointments);

module.exports = router;
