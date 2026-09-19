/**
 * Privacy Routes for SIH26186 Personnel Welfare System
 * Tasks 35 & 36: Privacy Sandbox and Privacy Protection Endpoints
 */
const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacy.controller');

const { authenticate } = require('../middleware/auth.middleware');

// Public / Sandbox exploration endpoints
router.get('/sandbox/sample', privacyController.getSandboxSample);
router.post('/sandbox/transform', privacyController.transformSandboxRecord);
router.get('/status', privacyController.getPrivacyStatus);

// Consent & Data Control Endpoints (Task 7)
router.get('/consent', authenticate, privacyController.getPersonnelConsent);
router.put('/consent', authenticate, privacyController.updatePersonnelConsent);

module.exports = router;
