const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/prediction.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/latest', authenticate, predictionController.getLatestPrediction);
router.get('/history', authenticate, predictionController.getPredictionHistory);
router.get('/explainability', authenticate, predictionController.getExplainability);
router.get('/what-changed', authenticate, predictionController.getWhatChanged);
router.get('/personal-baseline', authenticate, predictionController.getPersonalBaseline);
router.get('/recommendations', authenticate, predictionController.getRecommendations);
router.get('/recommendations/my', authenticate, predictionController.getRecommendations);
router.get('/my', authenticate, predictionController.getRecommendations);
router.get('/', authenticate, (req, res, next) => {
  if (req.baseUrl.includes('recommendation')) {
    return predictionController.getRecommendations(req, res, next);
  }
  return predictionController.getLatestPrediction(req, res, next);
});

module.exports = router;
