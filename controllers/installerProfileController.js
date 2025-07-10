// controllers/installerProfileController.js
const pool = require('../db');

// --- KONTROLERY DLA PROFILI INSTALATORÓW ---

// Tworzenie nowego profilu instalatora
exports.createProfile = async (req, res) => {
    const { 
        service_name, service_description, specializations, 
        base_postal_code, service_radius_km, serviced_inverter_brands,
        service_types, experience_years, certifications, website_url 
    } = req.body;
    
    const installerId = req.user.userId;
    const reference_photo_urls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    try {
        // Funkcja geocode powinna być zdefiniowana lub zaimportowana, jeśli jest potrzebna
        // const { lat, lon } = await geocode(base_postal_code); 
        
        const newProfile = await pool.query(
            `INSERT INTO installer_profiles (
                installer_id, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, 
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, reference_photo_urls
                // base_latitude, base_longitude - usunięte na potrzeby uproszczenia
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                installerId, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, 
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, reference_photo_urls
            ]
        );
        res.status(201).json(newProfile.rows[0]);
    } catch (error) {
        console.error('Błąd dodawania profilu instalatora:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};

// Pobieranie profilu zalogowanego instalatora
exports.getMyProfile = async (req, res) => {
    try {
        const profile = await pool.query('SELECT * FROM installer_profiles WHERE installer_id = $1', [req.user.userId]);
        if (profile.rows.length > 0) {
            res.json(profile.rows[0]);
        } else {
            res.status(404).json({ message: 'Nie znaleziono profilu dla tego instalatora.' });
        }
    } catch (error) {
        console.error("Błąd w /api/profiles/my-profile:", error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};

// Pobieranie wszystkich profili instalatorów
exports.getAllProfiles = async (req, res) => {
    try {
        const profiles = await pool.query('SELECT * FROM installer_profiles');
        res.json(profiles.rows);
    } catch (error) {
        console.error('Błąd podczas pobierania wszystkich profili:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};