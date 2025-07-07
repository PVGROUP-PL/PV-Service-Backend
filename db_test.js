const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDbConnection() {
    console.log("Start testu. Próbuję połączyć się z bazą danych...");
    let connection;
    try {
        // Używamy createConnection zamiast createPool dla najprostszego testu
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 10000 // Czekaj na połączenie maksymalnie 10 sekund
        });

        console.log("✅ SUKCES! Połączono z bazą danych.");

    } catch (error) {
        console.error("❌ BŁĄD PODCZAS ŁĄCZENIA:", error);
    } finally {
        if (connection) {
            await connection.end();
            console.log("✅ Połączenie zamknięte.");
        }
        console.log("Test zakończony.");
    }
}

testDbConnection();