// __tests__/auth.test.js
const request = require('supertest');
const server = require('../index'); 
const pool = require('../db'); // Importujemy naszą pulę połączeń

describe('Endpointy Autoryzacji', () => {

    // Ta funkcja zamknie serwer ORAZ połączenie z bazą po testach
    afterAll((done) => {
        server.close();
        pool.end(done);
    });
    
    it('POST /api/auth/register - powinien poprawnie zarejestrować nowego użytkownika', async () => {
        const newUser = {
            email: `testuser_${Date.now()}@example.com`,
            password: 'password123',
            user_type: 'organizer',
            first_name: 'Test',
            last_name: 'User',
            country_code: 'PL'
        };

        const response = await request(server)
            .post('/api/auth/register')
            .send(newUser);
        
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('user_id');
        expect(response.body.email).toBe(newUser.email);
    });

    it('POST /api/auth/login - powinien poprawnie zalogować istniejącego użytkownika', async () => {
        const userEmail = `login_test_${Date.now()}@example.com`;
        const userPassword = 'password123';
        
        await request(server)
            .post('/api/auth/register')
            .send({
                email: userEmail,
                password: userPassword,
                user_type: 'organizer',
                first_name: 'Login',
                last_name: 'Test',
                country_code: 'PL'
            });

        const response = await request(server)
            .post('/api/auth/login')
            .send({
                email: userEmail,
                password: userPassword
            });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
    });
});