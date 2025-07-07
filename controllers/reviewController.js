// controllers/reviewController.js
const pool = require('../db');

exports.createReview = async (req, res) => {
    const { request_id, rating, comment } = req.body;
    const reviewer_id = req.user.userId;
    try {
        const requestRes = await pool.query('SELECT profile_id, client_id FROM service_requests WHERE request_id = $1', [request_id]);
        if (requestRes.rows.length === 0) {
            return res.status(404).json({ message: "Nie znaleziono zlecenia." });
        }
        if (requestRes.rows[0].client_id !== reviewer_id) {
            return res.status(403).json({ message: "Nie masz uprawnień do dodania opinii dla tego zlecenia." });
        }
        const profile_id = requestRes.rows[0].profile_id;
        const newReview = await pool.query(
            'INSERT INTO reviews (request_id, profile_id, reviewer_id, rating, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [request_id, profile_id, reviewer_id, rating, comment]
        );
        res.status(201).json(newReview.rows[0]);
    } catch (error) {
        if (error.code === '23505') { 
            return res.status(409).json({ message: 'Już dodałeś opinię dla tego zlecenia.' });
        }
        console.error("Błąd dodawania opinii:", error);
        res.status(500).json({ message: 'Błąd serwera podczas dodawania opinii.' });
    }
};

// Upewnij się, że nazwa tej funkcji jest poprawna
exports.getReviewsForProfile = async (req, res) => {
    const { profileId } = req.params;
    try {
        const reviews = await pool.query(
            `SELECT r.rating, r.comment, r.created_at, u.first_name 
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.user_id
             WHERE r.profile_id = $1 
             ORDER BY r.created_at DESC`,
            [profileId]
        );
        res.json(reviews.rows);
    } catch (error) {
        console.error("Błąd pobierania opinii:", error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};