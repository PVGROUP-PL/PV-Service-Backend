// routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticateToken = require('../middleware/authenticateToken');

// Trasa do tworzenia nowej opinii (dla zalogowanych klientów)
router.post('/', authenticateToken, reviewController.createReview);

// Trasa do pobierania opinii dla konkretnego profilu instalatora (publiczna)
router.get('/profile/:profileId', reviewController.getReviewsForProfile);

module.exports = router;