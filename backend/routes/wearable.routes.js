const express = require('express');
const router = express.Router();
const wearableController = require('../controllers/wearable.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

// All wearable telemetry endpoints require authentication
router.post('/ingest', authenticate, authorizeRoles('PERSONNEL', 'ADMIN'), wearableController.ingestWearableData);
router.post('/sync', authenticate, authorizeRoles('PERSONNEL', 'ADMIN'), wearableController.syncWearableBatch);
router.get('/latest', authenticate, authorizeRoles('PERSONNEL', 'ADMIN', 'WELFARE_OFFICER'), wearableController.getLatestWearableData);
router.get('/history', authenticate, authorizeRoles('PERSONNEL', 'ADMIN', 'WELFARE_OFFICER'), wearableController.getWearableHistory);

module.exports = router;
