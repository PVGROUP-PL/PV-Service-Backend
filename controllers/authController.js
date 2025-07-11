// controllers/authController.js
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- REJESTRACJA UŻYTKOWNIKA ---
exports.register = async (req, res) => {
    const { 
        email, password, user_type, first_name, last_name, 
        company_name, nip, phone_number, country_code,
        serviced_inverter_brands, base_postal_code, service_radius_km 
    } = req.body;

    if (!email || !password || !user_type || !country_code) {
        return res.status(400).json({ message: 'Podstawowe pola są wymagane.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'Użytkownik o tym adresie email już istnieje.' });
        }

        let stripeCustomerId = null;
        if (user_type === 'installer') {
            const customer = await stripe.customers.create({
                email: email, name: `${first_name} ${last_name}`, phone: phone_number,
                metadata: { company_name: company_name, nip: nip }
            });
            stripeCustomerId = customer.id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO users (
                email, password_hash, user_type, first_name, last_name, 
                company_name, nip, phone_number, country_code, stripe_customer_id,
                base_postal_code, service_radius_km, serviced_inverter_brands
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING user_id, email, user_type`;
            
        const values = [
            email, hashedPassword, user_type, first_name, last_name, 
            company_name, nip, phone_number, country_code, stripeCustomerId,
            base_postal_code, service_radius_km, serviced_inverter_brands
        ];
        
        const newUser = await client.query(query, values);
        
        await client.query('COMMIT');
        res.status(201).json(newUser.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas rejestracji:', error);
        res.status(500).json({ message: error.message || 'Błąd serwera podczas rejestracji.' });
    } finally {
        client.release();
    }
};

// --- LOGOWANIE UŻYTKOWNIKA ---
exports.login = async (req, res) => {
    const { email, password } = req.body;
    const client = await pool.connect();
    try {
        const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło.' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Nieprawidłowy email lub hasło.' });
        }

        const payload = {
            userId: user.user_id,
            email: user.email,
            user_type: user.user_type
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            userId: user.user_id,
            email: user.email,
            user_type: user.user_type
        });

    } catch (error) {
        console.error('Błąd podczas logowania:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    } finally {
        client.release();
    }
};

// --- POBIERANIE PROFILU ZALOGOWANEGO UŻYTKOWNIKA (Z PEŁNYMI DANYMI) ---
exports.getProfile = async (req, res) => {
    try {
        // req.user jest dodawany przez middleware authenticateToken
        const query = `
            SELECT user_id, email, user_type, first_name, last_name, 
                   company_name, nip, phone_number, base_postal_code, service_radius_km 
            FROM users 
            WHERE user_id = $1
        `;
        
        const userResult = await pool.query(query, [req.user.userId]);

        if (userResult.rows.length > 0) {
            res.json(userResult.rows[0]);
        } else {
            res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }
    } catch (error) {
        console.error('Błąd podczas pobierania profilu:', error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};