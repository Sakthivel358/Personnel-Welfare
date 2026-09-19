const express = require('express');
const router = express.Router();
const hrmsController = require('../controllers/hrms.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

// Public/status health check for HRMS integration layer
router.get('/status', hrmsController.getStatus);

// Authenticated personnel endpoints
router.get('/my-record', authenticate, hrmsController.getMyRecord);
router.get('/category/:category', authenticate, hrmsController.getCategoryData);
router.post('/sync', authenticate, hrmsController.syncHRMS);

// Specific personnel record access (RBAC enforced in controller)
router.get('/personnel/:id', authenticate, hrmsController.getPersonnelRecord);

module.exports = router;
