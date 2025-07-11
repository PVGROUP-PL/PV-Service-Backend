// controllers/installerProfileController.js
const pool = require('../db');
const axios = require('axios'); // Upewnij się, że masz zainstalowany axios (npm install axios)

// --- FUNKCJA POMOCNICZA GEOCODE ---
async function geocode(postalCode) {
  const apiKey = process.env.GEOCODING_API_KEY;
  // Budujemy URL do zapytania do Google Maps API, dodając kraj dla precyzji
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postalCode)}&components=country:PL&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lon: location.lng };
    } else {
      // Jeśli Google nie znajdzie kodu, rzucamy błąd
      throw new Error(`Nie udało się znaleźć współrzędnych dla kodu pocztowego: ${postalCode}. Status API: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Błąd Geocoding API:', error.message);
    // Przekazujemy błąd dalej, aby główna funkcja mogła go obsłużyć
    throw error; 
  }
}


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
        // Używamy naszej nowej funkcji geocode
        const { lat, lon } = await geocode(base_postal_code); 
        
        const newProfile = await pool.query(
            `INSERT INTO installer_profiles (
                installer_id, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, base_latitude, base_longitude,
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, reference_photo_urls
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [
                installerId,                  // $1
                service_name,                 // $2
                service_description,          // $3
                specializations,              // $4
                base_postal_code,             // $5
                service_radius_km,            // $6
                lat,                          // $7
                lon,                          // $8
                website_url,                  // $9
                serviced_inverter_brands,     // $10
                service_types,                // $11
                experience_years,             // $12
                certifications,               // $13
                reference_photo_urls          // $14
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