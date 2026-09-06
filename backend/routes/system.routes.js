const express = require('express');
const router = express.Router();
const systemController = require('../controllers/system.controller');

// Public system endpoints
router.get('/health', systemController.getSystemHealth);
router.get('/transparency', systemController.getModelTransparency);

module.exports = router;
