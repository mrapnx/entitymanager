# Basis Image
FROM node:18-alpine

# Verzeichnis
WORKDIR /app

# Dependencies
RUN npm init -y && npm install express

# Files
COPY server.js .
COPY entity_manager.html .

# Data Volume Ordner
RUN mkdir -p /app/data

# Port
EXPOSE 3000

# Start
CMD ["node", "server.js"]
