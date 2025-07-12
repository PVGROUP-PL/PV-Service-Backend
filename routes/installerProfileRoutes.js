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


// === Trasy POST (tworzenie) ===
router.post('/', authenticateToken, upload.array('reference_photos', 10), installerProfileController.createProfile);


// === Trasy GET (pobieranie) - kolejność ma znaczenie! ===

// 1. Najpierw najbardziej szczegółowa trasa GET
router.get('/my-profile', authenticateToken, installerProfileController.getMyProfile);

// 2. Następnie trasa dla wszystkich profili (publiczna)
router.get('/', installerProfileController.getAllProfiles); 

// 3. Na samym końcu trasy z parametrem (wildcard), ponieważ pasują do wielu rzeczy
router.get('/:profileId', installerProfileController.getProfileById);


// === Trasy PUT (aktualizacja) ===
router.put('/:profileId', authenticateToken, upload.array('reference_photos', 10), installerProfileController.updateProfile);


module.exports = router;