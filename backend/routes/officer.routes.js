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
router.get('/alerts/:alertId/workflow', officerController.getAlertWorkflow);
router.put('/alerts/:alertId/review', officerController.reviewAlert);
router.post('/alerts/:alertId/review', officerController.reviewAlert);
router.get('/personnel', officerController.getPersonnelList);
router.get('/personnel/search', officerController.searchPersonnel);
router.get('/personnel/:id', officerController.getPersonnelById);
router.get('/roster-optimizer', officerController.getRosterOptimization);
router.get('/roster-optimization', officerController.getRosterOptimization);
router.post('/approve-pacing', officerController.approveRosterPacing);

// Welfare Intervention Recommendations (Requirement 1)
router.get('/interventions', officerController.getWelfareInterventions);
router.get('/interventions/:id', officerController.getPersonnelInterventions);

// Workload Balancing (Requirement 3)
router.get('/workload-balancing', officerController.getWorkloadBalancingProposals);
router.post('/workload-balancing/proposals/:proposalId/review', officerController.reviewWorkloadProposal);

module.exports = router;
