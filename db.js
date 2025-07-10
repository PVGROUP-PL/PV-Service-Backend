// db.js
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
// Ta zmienna jest automatycznie dodawana przez Google, gdy skonfigurujesz połączenie Cloud SQL
const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME; 

const config = {};

if (isProduction && INSTANCE_CONNECTION_NAME) {
  // --- Konfiguracja dla Cloud Run (PRODUKCJA) ---
  console.log(`Łączenie z bazą danych przez Unix Socket: /cloudsql/${INSTANCE_CONNECTION_NAME}`);
  config.host = `/cloudsql/${INSTANCE_CONNECTION_NAME}`;
  config.user = process.env.DB_USER;     // np. 'postgres'
  config.password = process.env.DB_PASS; // Hasło do bazy
  config.database = process.env.DB_NAME; // Nazwa bazy
} else {
  // --- Konfiguracja dla dewelopera (LOKALNIE) ---
  console.log('Łączenie z bazą danych przez DATABASE_URL.');
  config.connectionString = process.env.DATABASE_URL;
  if (isProduction) { // Dodajemy SSL dla innych środowisk produkcyjnych (np. Heroku)
      config.ssl = { rejectUnauthorized: false };
  }
}

const pool = new Pool(config);

module.exports = pool;