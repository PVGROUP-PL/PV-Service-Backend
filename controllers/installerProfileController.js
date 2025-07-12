// controllers/installerProfileController.js
const pool = require('../db');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');

// --- KONFIGURACJA GOOGLE CLOUD STORAGE ---
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;
const bucket = storage.bucket(bucketName);


// --- FUNKCJE POMOCNICZE ---
const uploadFileToGCS = (file) => {
  return new Promise((resolve, reject) => {
    const { originalname, buffer } = file;
    const blob = bucket.file(Date.now() + "_" + originalname.replace(/ /g, "_"));
    const blobStream = blob.createWriteStream({ resumable: false });
    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    }).on('error', (err) => reject(`Nie udało się wysłać obrazka: ${err}`)).end(buffer);
  });
};

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

exports.createProfile = async (req, res) => {
    let { 
        service_name, service_description, specializations, 
        base_postal_code, service_radius_km, serviced_inverter_brands,
        service_types, experience_years, certifications, website_url 
    } = req.body;
    
    const installerId = req.user.userId;

    try {
        let photoUrls = [];
        if (req.files && req.files.length > 0) {
          const uploadPromises = req.files.map(uploadFileToGCS);
          photoUrls = await Promise.all(uploadPromises);
        }

        if (serviced_inverter_brands && typeof serviced_inverter_brands === 'string') serviced_inverter_brands = JSON.parse(serviced_inverter_brands);
        if (service_types && typeof service_types === 'string') service_types = JSON.parse(service_types);
        if (specializations && typeof specializations === 'string') specializations = JSON.parse(specializations);

        const { lat, lon } = await geocode(base_postal_code); 
        
        const newProfile = await pool.query(
            `INSERT INTO installer_profiles (
                installer_id, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, base_latitude, base_longitude,
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, reference_photo_urls, profile_image_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
            [
                installerId, service_name, service_description, specializations, 
                base_postal_code, service_radius_km, lat, lon,
                website_url, serviced_inverter_brands, service_types, 
                experience_years, certifications, photoUrls, photoUrls[0] || null
            ]
        );
        res.status(201).json(newProfile.rows[0]);
    } catch (error) {
        console.error('Błąd dodawania profilu instalatora:', error.message);
        res.status(500).json({ message: 'Błąd serwera lub nieprawidłowy kod pocztowy.' });
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

exports.getAllProfiles = async (req, res) => {
    try {
        const profiles = await pool.query('SELECT * FROM installer_profiles');
        res.json(profiles.rows);
    } catch (error) {
        console.error('Błąd podczas pobierania wszystkich profili:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};

exports.getProfileById = async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    if (isNaN(profileId)) {
      return res.status(400).json({ message: 'Nieprawidłowe ID profilu.' });
    }
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

exports.updateProfile = async (req, res) => {
    const { profileId: profileIdParam } = req.params;
    let { 
        service_name, service_description, specializations, 
        base_postal_code, service_radius_km, serviced_inverter_brands,
        service_types, experience_years, certifications, website_url 
    } = req.body;

    const profileId = parseInt(profileIdParam, 10);
    if (isNaN(profileId)) {
        return res.status(400).json({ message: 'Nieprawidłowe ID profilu.' });
    }

    try {
        const profileCheck = await pool.query('SELECT installer_id, reference_photo_urls FROM installer_profiles WHERE profile_id = $1', [profileId]);
        if (profileCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Profil nie istnieje.' });
        }
        if (profileCheck.rows[0].installer_id !== req.user.userId) {
            return res.status(403).json({ message: 'Nie masz uprawnień do edycji tego profilu.' });
        }
        
        let photoUrls = profileCheck.rows[0].reference_photo_urls || [];
        if (req.files && req.files.length > 0) {
          const uploadPromises = req.files.map(uploadFileToGCS);
          photoUrls = await Promise.all(uploadPromises);
        }
        
        if (serviced_inverter_brands && typeof serviced_inverter_brands === 'string') serviced_inverter_brands = JSON.parse(serviced_inverter_brands);
        if (service_types && typeof service_types === 'string') service_types = JSON.parse(service_types);
        if (specializations && typeof specializations === 'string') specializations = JSON.parse(specializations);

        const { lat, lon } = await geocode(base_postal_code);

        const updatedProfile = await pool.query(
            `UPDATE installer_profiles SET 
                service_name = $1, service_description = $2, specializations = $3, 
                base_postal_code = $4, service_radius_km = $5, base_latitude = $6, 
                base_longitude = $7, website_url = $8, serviced_inverter_brands = $9, 
                service_types = $10, experience_years = $11, certifications = $12, 
                reference_photo_urls = $13, profile_image_url = $14
             WHERE profile_id = $15 RETURNING *`,
            [
                service_name, service_description, specializations,
                base_postal_code, service_radius_km, lat, lon, website_url,
                serviced_inverter_brands, service_types, experience_years,
                certifications, photoUrls, photoUrls[0] || null, profileId
            ]
        );

        res.json(updatedProfile.rows[0]);
    } catch (error) {
        console.error("Błąd podczas aktualizacji profilu:", error);
        res.status(500).json({ message: 'Błąd serwera lub nieprawidłowy kod pocztowy.' });
    }
};
