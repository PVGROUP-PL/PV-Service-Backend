// middleware/cors.js
const cors = require('cors');

// Adres URL Twojej aplikacji frontendowej
const FRONTEND_URL = 'https://pv-service-db.web.app';

const corsOptions = {
  origin: FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Możesz dostosować metody
  allowedHeaders: ["Content-Type", "Authorization"] // Upewnij się, że autoryzacja jest dozwolona
};

module.exports = cors(corsOptions); 