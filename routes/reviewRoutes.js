// routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/', authenticateToken, reviewController.createReview);

// Upewnij się, że nazwa tej funkcji jest poprawna
router.get('/profile/:profileId', reviewController.getReviewsForProfile);

module.exports = router;