// controllers/conversationController.js
const pool = require('../db');

exports.getMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const convResult = await pool.query('SELECT * FROM conversations WHERE conversation_id = $1 AND $2 = ANY(participant_ids)', [id, userId]);
        if (convResult.rows.length === 0) {
            return res.status(403).json({ message: "Brak dostępu do tej konwersacji." });
        }
        const messagesResult = await pool.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [id]);
        res.status(200).json(messagesResult.rows);
    } catch (error) { 
        console.error("Błąd pobierania wiadomości:", error); 
        res.status(500).json({ message: "Błąd serwera." }); 
    }
};

exports.initiateConversation = async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.user.userId;
        const recipientIdInt = parseInt(recipientId, 10);

        if (!recipientIdInt) { return res.status(400).json({ message: "Nieprawidłowe ID odbiorcy." }); }
        if (recipientIdInt === senderId) { return res.status(400).json({ message: "Nie można rozpocząć rozmowy z samym sobą." });}

        const existingConv = await pool.query(
            `SELECT * FROM conversations WHERE participant_ids @> ARRAY[$1::integer, $2::integer]`,
            [senderId, recipientIdInt]
        );

        if (existingConv.rows.length > 0) { return res.status(200).json(existingConv.rows[0]); }

        const newConv = await pool.query('INSERT INTO conversations (participant_ids) VALUES ($1) RETURNING *', [[senderId, recipientIdInt]]);
        res.status(201).json(newConv.rows[0]);
    } catch (error) { 
        console.error("Błąd inicjowania konwersacji:", error); 
        res.status(500).json({ message: "Błąd serwera." }); 
    }
};