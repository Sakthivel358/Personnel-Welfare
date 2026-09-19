/**
 * Privacy Routes for SIH26186 Personnel Welfare System
 * Tasks 35 & 36: Privacy Sandbox and Privacy Protection Endpoints
 */
const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacy.controller');

// Public / Sandbox exploration endpoints
router.get('/sandbox/sample', privacyController.getSandboxSample);
router.post('/sandbox/transform', privacyController.transformSandboxRecord);
router.get('/status', privacyController.getPrivacyStatus);

module.exports = router;
