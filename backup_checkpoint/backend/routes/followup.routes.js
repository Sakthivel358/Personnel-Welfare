const express = require('express');
const router = express.Router();
const followupController = require('../controllers/followup.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

router.get('/', authenticate, followupController.getFollowUps);
router.put('/:id', authenticate, authorizeRoles('WELFARE_OFFICER', 'ADMIN'), followupController.updateFollowUp);

module.exports = router;
