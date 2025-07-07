const express = require('express');
const app = express();
const PORT = 3000;

console.log("--- URUCHAMIAM WERSJĘ TESTOWĄ KODU ---");

app.get('/', (req, res) => {
    res.send('Serwer testowy działa!');
});

app.listen(PORT, () => {
    console.log(`✅ Serwer testowy nasłuchuje na porcie ${PORT}. To jest najnowsza wersja!`);
});