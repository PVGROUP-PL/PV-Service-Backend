// controllers/installerProfileController.js
const pool = require('../db');

// Funkcje pomocnicze pozostają bez zmian...
const geocode = async (postalCode) => { /* ... */ };
const getDistanceInKm = (lat1, lon1, lat2, lon2) => { /* ... */ };

// --- KONTROLERY DLA PROFILI INSTALATORÓW (NOWA WERSJA) ---

exports.createProfile = async (req, res) => {
    // Odczytujemy nowe pola z ciała zapytania
    const { 
        service_name, service_description, specializations, 
        base_postal_code, service_radius_km, serviced_inverter_brands,
        service_types, experience_years, certifications, website_url 
    } = req.body;
    
    const installerId = req.user.userId;

    // Obsługa galerii zdjęć (wielu plików)
    const reference_photo_urls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    try {
        const { lat, lon } = await geocode(base_postal_code);
        
        // Zaktualizowana komenda INSERT z nowymi polami
        const newProfile = await pool.query(
            `INSERT INTO installer_profiles (
                installer_id, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, base_latitude, base_longitude, 
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, reference_photo_urls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [
                installerId, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, lat, lon, 
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

// W przyszłości dodamy tutaj resztę funkcji: updateProfile, getProfileById, getAllProfiles
// Ich logika będzie analogiczna - muszą uwzględniać nowe pola w zapytaniach SQL.