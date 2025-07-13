const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

// Upewnij się, że ta zmienna jest ustawiona w Cloud Run
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PLATFORM_COMMISSION_NET = 50.00; // Ustawiamy prowizję na 50 zł netto

// --- Tworzenie nowego zlecenia serwisowego ---
exports.createRequest = async (req, res) => {
    const { 
        profile_id, preferred_date, project_description,
        installation_type, system_type, inverter_brand_model,
        installation_age_years, urgency, error_codes
    } = req.body;
    
    const clientId = req.user.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userResult = await client.query('SELECT phone_number FROM users WHERE user_id = $1', [clientId]);
        const clientPhone = userResult.rows[0]?.phone_number;

        const newRequestQuery = await client.query(
            `INSERT INTO service_requests (
                profile_id, client_id, preferred_date, project_description, status,
                client_phone, installation_type, system_type,
                inverter_brand_model, installation_age_years, urgency, error_codes
            ) VALUES ($1, $2, $3, $4, 'pending_installer_approval', $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                profile_id, clientId, preferred_date, project_description,
                clientPhone, installation_type, system_type,
                inverter_brand_model, installation_age_years, urgency, error_codes
            ]
        );
        const newRequest = newRequestQuery.rows[0];

        // --- NOWA LOGIKA: WYSYŁKA MAILA DO INSTALATORA ---
        const installerEmailQuery = await client.query(
            `SELECT u.email FROM users u JOIN installer_profiles ip ON u.user_id = ip.installer_id WHERE ip.profile_id = $1`,
            [profile_id]
        );
        const installerEmail = installerEmailQuery.rows[0]?.email;

        if (installerEmail) {
            const msg = {
                to: installerEmail,
                from: process.env.SENDER_EMAIL, // Upewnij się, że ten email jest zweryfikowany w SendGrid
                subject: 'Otrzymałeś nowe zapytanie o usługę!',
                html: `<h1>Nowe zlecenie!</h1><p>Otrzymałeś nowe zapytanie serwisowe w platformie. Zaloguj się na swoje konto, aby zobaczyć szczegóły.</p>`,
            };
            await sgMail.send(msg);
        }
        // --- KONIEC LOGIKI MAILA ---
        
        await client.query('COMMIT');
        res.status(201).json(newRequest);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Błąd tworzenia zlecenia serwisowego:', error);
        res.status(500).json({ message: 'Błąd serwera podczas tworzenia zlecenia.' });
    } finally {
        client.release();
    }
};


// --- Aktualizacja statusu zlecenia ---
exports.updateRequestStatus = async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    const installerId = req.user.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const requestQuery = await client.query(
          `SELECT 
            sr.*, 
            u_installer.country_code, 
            u_installer.stripe_customer_id, 
            u_installer.phone_number as installer_phone, 
            u_client.email as client_email, 
            ip.service_name
           FROM service_requests sr 
           JOIN installer_profiles ip ON sr.profile_id = ip.profile_id
           JOIN users u_installer ON ip.installer_id = u_installer.user_id
           JOIN users u_client ON sr.client_id = u_client.user_id
           WHERE sr.request_id = $1 AND ip.installer_id = $2`,
          [requestId, installerId]
        );

        if (requestQuery.rows.length === 0) {
            return res.status(403).json({ message: 'Nie masz uprawnień do zmiany tego zlecenia.' });
        }
        
        const serviceRequest = requestQuery.rows[0];
        const updatedRequest = await client.query(
            'UPDATE service_requests SET status = $1 WHERE request_id = $2 RETURNING *',
            [status, requestId]
        );

        if (status === 'confirmed') {
            // --- LOGIKA FAKTURY STRIPE ---
            if (!serviceRequest.stripe_customer_id) throw new Error("Ten instalator nie ma konta klienta w Stripe.");
            const taxRateQuery = await client.query('SELECT vat_rate FROM tax_rates WHERE country_code = $1', [serviceRequest.country_code]);
            if (taxRateQuery.rows.length === 0) throw new Error(`Nie znaleziono stawki VAT dla kraju: ${serviceRequest.country_code}`);
            
            const vatRate = taxRateQuery.rows[0].vat_rate;
            const commissionGross = PLATFORM_COMMISSION_NET * (1 + vatRate / 100);
            
            await stripe.invoiceItems.create({
                customer: serviceRequest.stripe_customer_id,
                amount: Math.round(commissionGross * 100), // Kwota w groszach
                currency: 'pln',
                description: `Prowizja za zlecenie #${requestId}`,
            });
            const invoice = await stripe.invoices.create({
                customer: serviceRequest.stripe_customer_id,
                collection_method: 'send_invoice',
                days_until_due: 7,
                auto_advance: true,
            });
            await stripe.invoices.sendInvoice(invoice.id);
            // --- KONIEC LOGIKI FAKTURY ---

            // --- NOWA LOGIKA: WYSYŁKA MAILA DO KLIENTA ---
            const msg = {
                to: serviceRequest.client_email,
                from: process.env.SENDER_EMAIL,
                subject: `Twoje zlecenie dla ${serviceRequest.service_name} zostało potwierdzone!`,
                html: `<h1>Zlecenie Potwierdzone!</h1>
                       <p>Twoje zlecenie dla instalatora <strong>${serviceRequest.service_name}</strong> zostało potwierdzone.</p>
                       <p>Możesz teraz skontaktować się bezpośrednio z instalatorem pod numerem telefonu: <strong>${serviceRequest.installer_phone}</strong> w celu umówienia szczegółów.</p>`,
            };
            await sgMail.send(msg);
            // --- KONIEC LOGIKI MAILA ---
        }

        await client.query('COMMIT');
        res.json(updatedRequest.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Błąd aktualizacji statusu zlecenia:", error);
        res.status(500).json({ message: error.message || 'Błąd serwera.' });
    } finally {
        client.release();
    }
};


// --- Pobieranie zleceń ---
exports.getMyRequests = async (req, res) => {
    const userId = req.user.userId;
    const userRole = req.user.user_type;
    try {
        let query;
        const values = [userId];

        if (userRole === 'client') {
            query = `SELECT sr.*, ip.service_name, ip.installer_id FROM service_requests sr JOIN installer_profiles ip ON sr.profile_id = ip.profile_id WHERE sr.client_id = $1 ORDER BY sr.created_at DESC`;
        } else { // installer
            query = `SELECT sr.*, u.email as client_email, u.first_name as client_first_name, u.last_name as client_last_name, sr.client_id, sr.client_phone 
                     FROM service_requests sr 
                     JOIN installer_profiles ip ON sr.profile_id = ip.profile_id 
                     JOIN users u ON sr.client_id = u.user_id 
                     WHERE ip.installer_id = $1 
                     ORDER BY sr.created_at DESC`;
        }
        
        const requests = await pool.query(query, values);
        res.json(requests.rows);
    } catch (error) {
        console.error("Błąd pobierania zleceń:", error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};