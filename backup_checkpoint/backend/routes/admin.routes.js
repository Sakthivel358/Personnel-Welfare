const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.get('/metrics', adminController.getSystemMetrics);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/users', adminController.getAllUsers);
router.get('/resources', adminController.getWelfareResources);
router.post('/resources', adminController.createWelfareResource);

module.exports = router;
