// index.js (Backend)
require('dotenv').config();

// Import bibliotek
const express = require('express');
const http = require('http');
const cors = require('cors'); // Upewnij się, że jest zainstalowane: npm install cors
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const pool = require('./db');

// Import modułów z trasami
const authRoutes = require('./routes/authRoutes');
const installerProfileRoutes = require('./routes/installerProfileRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

// Inicjalizacja aplikacji
const app = express();

// Konfiguracja CORS - musi być przed trasami API
const corsOptions = {
  origin: 'https://pv-service-db.web.app', // Zezwalaj tylko Twojemu frontendowi
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Inne middleware
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  // Konfiguracja CORS dla Socket.IO
  cors: { 
    origin: "https://pv-service-db.web.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;

// Konfiguracja dla wgrywanych plików (uploads)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Główne trasy API
app.use('/api/auth', authRoutes);
app.use('/api/profiles', installerProfileRoutes);
app.use('/api/requests', serviceRequestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/conversations', conversationRoutes);

// Główna trasa powitalna
app.get('/', (req, res) => {
  res.send('Backend for PV Service Platform is running!');
});

// Logika Socket.IO dla komunikatora
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

// Uruchomienie serwera
server.listen(PORT, () => {
    console.log(`🚀 Serwer (z komunikatorem) uruchomiony na porcie ${PORT} i gotowy na przyjmowanie zapytań!`);
});

// Eksport serwera na potrzeby testów
module.exports = server;