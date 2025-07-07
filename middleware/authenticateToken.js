const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Oczekujemy formatu "Bearer TOKEN"

  if (token == null) {
    return res.sendStatus(401); // Brak tokenu
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Token nieważny lub wygasł
    }
    req.user = user; // Zapisujemy zdekodowane dane z tokenu w obiekcie zapytania
    next(); // Przechodzimy do właściwej funkcji trasy (np. tej do /profile)
  });
}

module.exports = authenticateToken;