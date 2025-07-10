// routes/installerProfileRoutes.js
const express = require('express');
const router = express.Router();
const installerProfileController = require('../controllers/installerProfileController');
const authenticateToken = require('../middleware/authenticateToken');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage: storage });

// Trasa do tworzenia nowego profilu instalatora
router.post('/', authenticateToken, upload.array('reference_photos', 10), installerProfileController.createProfile);

// Trasa do pobierania własnego profilu (po zalogowaniu)
router.get('/my-profile', authenticateToken, installerProfileController.getMyProfile);

// Trasa do pobierania WSZYSTKICH profili (publiczna)
router.get('/', installerProfileController.getAllProfiles); // <--- DODAJ TĘ LINIĘ

// W przyszłości dodamy tu pozostałe trasy
// router.get('/:profileId', installerProfileController.getProfileById);
// router.put('/:profileId', authenticateToken, upload.array('reference_photos', 10), installerProfileController.updateProfile);

module.exports = router;