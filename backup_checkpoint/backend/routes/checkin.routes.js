const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkin.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/', authenticate, checkinController.submitCheckIn);
router.get('/history', authenticate, checkinController.getCheckInHistory);
router.get('/:id', authenticate, checkinController.getCheckInById);

module.exports = router;
