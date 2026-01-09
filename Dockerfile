# Verwende ein leichtgewichtiges Node.js Image
FROM node:18-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Initialisiere ein minimales Projekt und installiere Express
# Wir machen das direkt hier, um keine package.json kopieren zu müssen
RUN npm init -y && npm install express

# Kopiere die Anwendungsdateien
COPY server.js .
COPY entity_manager.html .

# Erstelle das Datenverzeichnis
RUN mkdir -p /app/data

# Exponiere den Port, auf dem der Express-Server läuft
EXPOSE 3000

# Startbefehl
CMD ["node", "server.js"]