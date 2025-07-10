// Krok 1: Wczytanie zmiennych środowiskowych
require('dotenv').config();

// Krok 2: Import bibliotek
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const corsMiddleware = require('./middleware/cors'); // <-- NOWY IMPORT

// Krok 3: Import modułów z trasami
const authRoutes = require('./routes/authRoutes');
const installerProfileRoutes = require('./routes/installerProfileRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

// Krok 4: Inicjalizacja aplikacji
const app = express();
const server = http.createServer(app);

// Krok 5: Użycie middleware
app.use(corsMiddleware); // <-- Użycie wydzielonej konfiguracji CORS
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: 'https://pv-service-db.web.app', // Socket.IO wciąż potrzebuje tego bezpośrednio
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Krok 6: Główne trasy API
app.use('/api/auth', authRoutes);
app.use('/api/profiles', installerProfileRoutes);
app.use('/api/requests', serviceRequestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/conversations', conversationRoutes);

app.get('/', (req, res) => {
  res.send('Backend for PV Service Platform is running!');
});

// Krok 7: Logika Socket.IO 
io.on('connection', (socket) => {
  console.log('✅ Użytkownik połączył się z komunikatorem:', socket.id);
  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
    console.log(`Użytkownik ${socket.id} dołączył do pokoju ${conversationId}`);
  });
  socket.on('send_message', async (data) => {
    const { conversation_id, sender_id, message_content } = data;
    try {
        const newMessage = await pool.query( 'INSERT INTO messages (conversation_id, sender_id, message_content) VALUES ($1, $2, $3) RETURNING *', [conversation_id, sender_id, message_content]);
        io.to(conversation_id).emit('receive_message', newMessage.rows[0]);
    } catch (error) { console.error("Błąd zapisu/wysyłki wiadomości:", error); }
  });
  socket.on('disconnect', () => { console.log('❌ Użytkownik rozłączył się:', socket.id); });
});

// Krok 8: Uruchomienie serwera
server.listen(PORT, () => {
    console.log(`🚀 Serwer (z komunikatorem) uruchomiony na porcie ${PORT} i gotowy na przyjmowanie zapytań!`);
});

// Krok 9: Eksport serwera na potrzeby testów
module.exports = server;