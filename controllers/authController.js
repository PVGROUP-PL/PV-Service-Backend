// controllers/authController.js
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.register = async (req, res) => {
    const { email, password, user_type, first_name, last_name, company_name, nip, phone_number, country_code } = req.body;
    if (!email || !password || !user_type || !country_code) {
        return res.status(400).json({ message: 'Wszystkie pola są wymagane.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'Użytkownik o tym adresie email już istnieje.' });
        }
        let stripeCustomerId = null;
        // ZMIANA: Sprawdzamy czy typ użytkownika to 'installer'
        if (user_type === 'installer') {
            const customer = await stripe.customers.create({
                email: email, name: `${first_name} ${last_name}`, phone: phone_number,
                metadata: { company_name: company_name, nip: nip }
            });
            stripeCustomerId = customer.id;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (email, password_hash, user_type, first_name, last_name, company_name, nip, phone_number, country_code, stripe_customer_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING user_id, email, user_type`;
        const values = [email, hashedPassword, user_type, first_name, last_name, company_name, nip, phone_number, country_code, stripeCustomerId];
        const newUser = await client.query(query, values);
        await client.query('COMMIT');
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Błąd w głównym bloku try/catch rejestracji:', error);
        res.status(500).json({ message: error.message || 'Błąd serwera podczas rejestracji.' });
    } finally {
        client.release();
    }
};

// Reszta pliku (exports.login, exports.getProfile) pozostaje bez zmian...
exports.login = async (req, res) => { /* ... ten kod zostaje taki sam ... */ };
exports.getProfile = async (req, res) => { /* ... ten kod zostaje taki sam ... */ };