# Użyj oficjalnego obrazu Node.js jako bazy
FROM node:18-alpine

# Ustaw katalog roboczy w kontenerze
WORKDIR /usr/src/app

# Skopiuj pliki package.json i package-lock.json
COPY package*.json ./

# Zainstaluj zależności aplikacji
RUN npm install

# Skopiuj resztę kodu aplikacji
COPY . .

# Ustaw port, na którym będzie działać aplikacja
EXPOSE 3000

# Komenda, która uruchomi aplikację
CMD [ "node", "index.js" ]