const express = require('express');
const router = express.Router();
const officerController = require('../controllers/officer.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

// Protected for Welfare Officers & Admins
router.use(authenticate);
router.use(authorizeRoles('WELFARE_OFFICER', 'ADMIN'));

router.get('/dashboard', officerController.getOfficerDashboard);
router.get('/early-warning', officerController.getEarlyWarningCenter);
router.get('/intervention-effectiveness', officerController.getInterventionEffectiveness);
router.get('/alerts', officerController.getAlerts);
router.put('/alerts/:alertId/review', officerController.reviewAlert);
router.get('/personnel', officerController.getPersonnelList);
router.get('/roster-optimizer', officerController.getRosterOptimization);
router.post('/approve-pacing', officerController.approveRosterPacing);

module.exports = router;
