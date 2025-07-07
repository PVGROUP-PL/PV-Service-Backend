// routes/conversationRoutes.js
const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authenticateToken = require('../middleware/authenticateToken');

router.get('/:id/messages', authenticateToken, conversationController.getMessages);
router.post('/initiate', authenticateToken, conversationController.initiateConversation);

module.exports = router;