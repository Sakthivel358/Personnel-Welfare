const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', authenticate, profileController.getProfile);
router.put('/', authenticate, profileController.updateProfile);

module.exports = router;
