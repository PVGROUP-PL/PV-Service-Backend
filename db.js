// db.js
const { Pool } = require('pg');

console.log('Łączenie z bazą danych przez DATABASE_URL...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL jest wymagany przez Google Cloud SQL dla połączeń publicznych
  ssl: { 
    rejectUnauthorized: false
  }
});

module.exports = pool;