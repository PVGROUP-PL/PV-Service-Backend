// controllers/installerProfileController.js

// ...tutaj jest kod Twojej funkcji exports.getMyProfile...

exports.getAllProfiles = async (req, res) => {
    try {
        // Zapytanie do bazy danych o wszystkie profile
        const profiles = await pool.query('SELECT * FROM installer_profiles');
        
        // Zwrócenie listy profili w formacie JSON
        res.json(profiles.rows);

    } catch (error) {
        console.error('Błąd podczas pobierania wszystkich profili:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};


// W przyszłości dodamy tutaj resztę funkcji: updateProfile, getProfileById
// Ich logika będzie analogiczna - muszą uwzględniać nowe pola w zapytaniach SQL.