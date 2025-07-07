// routes/serviceRequestRoutes.js
const express = require('express');
const router = express.Router();
const serviceRequestController = require('../controllers/serviceRequestController');
const authenticateToken = require('../middleware/authenticateToken');

router.post('/', authenticateToken, serviceRequestController.createRequest);
router.get('/my-requests', authenticateToken, serviceRequestController.getMyRequests);
router.put('/:requestId/status', authenticateToken, serviceRequestController.updateRequestStatus);

module.exports = router;