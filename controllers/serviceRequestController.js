// controllers/serviceRequestController.js
const pool = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PLATFORM_COMMISSION_NET = 200.00; // Przykładowa prowizja

// ZAKTUALIZOWANA FUNKCJA
exports.createRequest = async (req, res) => {
    // Pobieramy wszystkie nowe pola z formularza
    const { 
        profile_id, preferred_date, project_description,
        installation_type, system_type, inverter_brand_model,
        installation_age_years, urgency, error_codes
    } = req.body;
    
    // ID zalogowanego klienta z tokenu
    const clientId = req.user.userId;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Automatycznie pobieramy numer telefonu klienta z jego profilu w tabeli users
        const userResult = await client.query('SELECT phone_number FROM users WHERE user_id = $1', [clientId]);
        if (userResult.rows.length === 0) {
            throw new Error("Nie znaleziono użytkownika klienta.");
        }
        const clientPhone = userResult.rows[0].phone_number;

        const newRequest = await client.query(
            `INSERT INTO service_requests (
                profile_id, client_id, preferred_date, project_description, status,
                client_address, client_phone, installation_type, system_type,
                inverter_brand_model, installation_age_years, urgency, error_codes
            ) VALUES ($1, $2, $3, $4, 'pending_installer_approval', $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                profile_id, clientId, preferred_date, project_description,
                null, // Adres nie jest zbierany w tym formularzu, można dodać w przyszłości
                clientPhone, installation_type, system_type,
                inverter_brand_model, installation_age_years, urgency, error_codes
            ]
        );
        
        await client.query('COMMIT');
        res.status(201).json(newRequest.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Błąd tworzenia zlecenia serwisowego:', error);
        res.status(500).json({ message: 'Błąd serwera podczas tworzenia zlecenia.' });
    } finally {
        client.release();
    }
};

// Poniższe funkcje pozostają bez zmian
exports.updateRequestStatus = async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    const installerId = req.user.userId;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const requestQuery = await client.query(
          `SELECT sr.*, u_installer.country_code, u_installer.stripe_customer_id, u_client.email as client_email, ip.service_name
           FROM service_requests sr 
           JOIN installer_profiles ip ON sr.profile_id = ip.profile_id
           JOIN users u_installer ON ip.installer_id = u_installer.user_id
           JOIN users u_client ON sr.client_id = u_client.user_id
           WHERE sr.request_id = $1 AND ip.installer_id = $2`,
          [requestId, installerId]
        );
        if (requestQuery.rows.length === 0) throw new Error('Nie masz uprawnień do zmiany tego zlecenia.');
        
        const serviceRequest = requestQuery.rows[0];
        const updatedRequest = await client.query(
            'UPDATE service_requests SET status = $1 WHERE request_id = $2 RETURNING *',
            [status, requestId]
        );

        if (status === 'confirmed') {
            if (!serviceRequest.stripe_customer_id) throw new Error("Ten instalator nie ma konta klienta w Stripe.");
            const taxRateQuery = await client.query('SELECT vat_rate FROM tax_rates WHERE country_code = $1', [serviceRequest.country_code]);
            if (taxRateQuery.rows.length === 0) throw new Error(`Nie znaleziono stawki VAT dla kraju: ${serviceRequest.country_code}`);
            
            const vatRate = taxRateQuery.rows[0].vat_rate;
            const commissionGross = PLATFORM_COMMISSION_NET * (1 + vatRate / 100);
            
            await stripe.invoiceItems.create({
                customer: serviceRequest.stripe_customer_id,
                amount: Math.round(commissionGross * 100), currency: 'pln',
                description: `Prowizja za zlecenie #${requestId}`,
            });
            const invoice = await stripe.invoices.create({
                customer: serviceRequest.stripe_customer_id, collection_method: 'send_invoice',
                days_until_due: 7, auto_advance: true,
            });
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            
            await client.query(
                `INSERT INTO invoices (request_id, installer_id, amount_net, vat_rate, amount_gross, stripe_invoice_id, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [requestId, installerId, PLATFORM_COMMISSION_NET, vatRate, commissionGross.toFixed(2), invoice.id, dueDate]
            );
            await stripe.invoices.sendInvoice(invoice.id);
            
            const msg = {
                to: serviceRequest.client_email, from: process.env.SENDER_EMAIL,
                subject: `Twoje zlecenie dla ${serviceRequest.service_name} zostało potwierdzone!`,
                html: `<h1>Zlecenie Potwierdzone!</h1><p>Twoje zlecenie dla instalatora <strong>${serviceRequest.service_name}</strong> zostało potwierdzone.</p>`,
            };
            await sgMail.send(msg);
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

exports.getMyRequests = async (req, res) => {
    const userId = req.user.userId;
    const userRole = req.user.user_type; // Poprawka: user_type zamiast role
    try {
        let requests;
        if (userRole === 'client') {
            requests = await pool.query(
                'SELECT sr.*, ip.service_name, ip.installer_id FROM service_requests sr JOIN installer_profiles ip ON sr.profile_id = ip.profile_id WHERE sr.client_id = $1 ORDER BY sr.created_at DESC', 
                [userId]
            );
        } else { // installer
            requests = await pool.query(
                `SELECT sr.*, u.email as client_email, sr.client_id 
                 FROM service_requests sr 
                 JOIN installer_profiles ip ON sr.profile_id = ip.profile_id 
                 JOIN users u ON sr.client_id = u.user_id 
                 WHERE ip.installer_id = $1 
                 ORDER BY sr.created_at DESC`, 
                [userId]
            );
        }
        res.json(requests.rows);
    } catch (error) {
        console.error("Błąd pobierania zleceń:", error);
        res.status(500).json({ message: 'Błąd serwera.' });
    }
};