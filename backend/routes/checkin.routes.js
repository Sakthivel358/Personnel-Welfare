const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

router.post('/', authenticate, authorizeRoles('PERSONNEL', 'ADMIN'), checkinController.submitCheckIn);
router.get('/history', authenticate, authorizeRoles('PERSONNEL', 'ADMIN'), checkinController.getCheckInHistory);
router.get('/:id', authenticate, authorizeRoles('PERSONNEL', 'ADMIN'), checkinController.getCheckInById);

module.exports = router;
