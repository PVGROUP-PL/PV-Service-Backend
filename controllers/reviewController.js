// controllers/reviewController.js
const pool = require('../db');

// Pobieranie wszystkich opinii dla danego profilu instalatora
exports.getReviewsForProfile = async (req, res) => {
    try {
        const { profileId } = req.params;
        const reviews = await pool.query(
            `SELECT r.review_id, r.rating, r.comment, r.created_at, u.first_name 
             FROM reviews r
             JOIN users u ON r.client_id = u.user_id
             WHERE r.profile_id = $1 
             ORDER BY r.created_at DESC`,
            [profileId]
        );
        res.json(reviews.rows);
    } catch (error) {
        console.error("Błąd podczas pobierania opinii:", error);
        res.status(500).json({ message: "Błąd serwera." });
    }
};

// Tworzenie nowej opinii
exports.createReview = async (req, res) => {
    try {
        const { request_id, rating, comment } = req.body;
        const clientId = req.user.userId;

        // Proste sprawdzenie, czy zlecenie istnieje i należy do klienta,
        // oraz czy instalator jest poprawny - można to rozbudować.
        const requestQuery = await pool.query(
            'SELECT installer_id FROM service_requests WHERE request_id = $1 AND client_id = $2',
            [request_id, clientId]
        );

        if (requestQuery.rows.length === 0) {
            return res.status(403).json({ message: "Nie możesz wystawić opinii dla tego zlecenia." });
        }
        const { installer_id } = requestQuery.rows[0];
        
        const newReview = await pool.query(
            `INSERT INTO reviews (profile_id, client_id, request_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [installer_id, clientId, request_id, rating, comment]
        );

        res.status(201).json(newReview.rows[0]);
    } catch (error) {
        console.error("Błąd podczas tworzenia opinii:", error);
        res.status(500).json({ message: "Błąd serwera." });
    }
};