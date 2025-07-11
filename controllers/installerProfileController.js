// controllers/installerProfileController.js
const pool = require('../db');
const axios = require('axios');

// --- FUNKCJA POMOCNICZA GEOCODE ---
async function geocode(postalCode) {
  const apiKey = process.env.GEOCODING_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postalCode)}&components=country:PL&key=${apiKey}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lon: location.lng };
    } else {
      throw new Error(`Nie udało się znaleźć współrzędnych dla kodu pocztowego: ${postalCode}.`);
    }
  } catch (error) {
    console.error('Błąd Geocoding API:', error.message);
    throw error; 
  }
}

// --- KONTROLERY DLA PROFILI INSTALATORÓW ---

// Tworzenie nowego profilu instalatora
exports.createProfile = async (req, res) => {
    let { 
        service_name, service_description, specializations, 
        base_postal_code, service_radius_km, serviced_inverter_brands,
        service_types, experience_years, certifications, website_url 
    } = req.body;
    
    const installerId = req.user.userId;
    const reference_photo_urls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    try {
        if (serviced_inverter_brands && typeof serviced_inverter_brands === 'string') {
            serviced_inverter_brands = JSON.parse(serviced_inverter_brands);
        }
        if (service_types && typeof service_types === 'string') {
            service_types = JSON.parse(service_types);
        }
        if (specializations && typeof specializations === 'string') {
            specializations = JSON.parse(specializations);
        }

        const { lat, lon } = await geocode(base_postal_code); 
        
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
        console.error('Błąd dodawania profilu instalatora:', error.message);
        res.status(500).json({ message: 'Błąd serwera lub nieprawidłowy kod pocztowy.' });
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

// Pobieranie jednego, konkretnego profilu instalatora po jego ID
exports.getProfileById = async (req, res) => {
  try {
    const { profileId } = req.params; // Pobieramy ID z adresu URL
    const profile = await pool.query('SELECT * FROM installer_profiles WHERE profile_id = $1', [profileId]);

    if (profile.rows.length > 0) {
      res.json(profile.rows[0]);
    } else {
      res.status(404).json({ message: 'Nie znaleziono profilu o podanym ID.' });
    }
  } catch (error) {
    console.error("Błąd podczas pobierania pojedynczego profilu:", error);
    res.status(500).json({ message: 'Błąd serwera.' });
  }
};