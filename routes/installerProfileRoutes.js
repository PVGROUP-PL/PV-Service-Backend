// routes/installerProfileRoutes.js
const express = require('express');
const router = express.Router();
const installerProfileController = require('../controllers/installerProfileController');
const authenticateToken = require('../middleware/authenticateToken');
const multer = require('multer');

// ZMIANA: Używamy memoryStorage zamiast diskStorage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit 10MB na plik
});

// === Trasy POST (tworzenie) ===
router.post('/', authenticateToken, upload.array('reference_photos', 10), installerProfileController.createProfile);

// === Trasy GET (pobieranie) ===
router.get('/my-profile', authenticateToken, installerProfileController.getMyProfile);
router.get('/', installerProfileController.getAllProfiles); 
router.get('/:profileId', installerProfileController.getProfileById);

// === Trasy PUT (aktualizacja) ===
router.put('/:profileId', authenticateToken, upload.array('reference_photos', 10), installerProfileController.updateProfile);

module.exports = router;