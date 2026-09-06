const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/prediction.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/latest', authenticate, predictionController.getLatestPrediction);
router.get('/history', authenticate, predictionController.getPredictionHistory);
router.get('/explainability', authenticate, predictionController.getExplainability);

module.exports = router;
