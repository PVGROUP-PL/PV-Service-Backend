// db.js

// --- POCZĄTEK SEKCJI DEBUGOWANIA ---
console.log('--- START db.js: Sprawdzanie zmiennych środowiskowych ---');
console.log('Zmienna NODE_ENV:', process.env.NODE_ENV);
console.log('Zmienna INSTANCE_CONNECTION_NAME:', process.env.INSTANCE_CONNECTION_NAME);
console.log('Zmienna DB_USER:', process.env.DB_USER);
console.log('Zmienna DB_NAME:', process.env.DB_NAME);
console.log('--- KONIEC SEKCJI DEBUGOWANIA ---');
// --- KONIEC SEKCJI DEBUGOWANIA ---


const { Pool } = require('pg');

const INSTANCE_CONNECTION_NAME = process.env.INSTANCE_CONNECTION_NAME; 
const config = {};

if (INSTANCE_CONNECTION_NAME) {
  console.log(`Znaleziono INSTANCE_CONNECTION_NAME. Łączenie z bazą przez Unix Socket...`);
  config.host = `/cloudsql/${INSTANCE_CONNECTION_NAME}`;
  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASS;
  config.database = process.env.DB_NAME;
} else {
  console.log('Brak INSTANCE_CONNECTION_NAME. Łączenie z bazą przez DATABASE_URL (dla dewelopera).');
  config.connectionString = process.env.DATABASE_URL;
}

const pool = new Pool(config);

module.exports = pool;