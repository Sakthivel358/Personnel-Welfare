const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/rbac.middleware');

router.post('/', authenticate, supportController.createSupportRequest);
router.post('/request', authenticate, supportController.createSupportRequest);
router.get('/my', authenticate, supportController.getMyRequests);
router.get('/my-requests', authenticate, supportController.getMyRequests);
router.get('/all', authenticate, authorizeRoles('WELFARE_OFFICER', 'ADMIN'), supportController.getAllRequests);
router.put('/:id', authenticate, authorizeRoles('WELFARE_OFFICER', 'ADMIN'), supportController.updateRequestStatus);

module.exports = router;
