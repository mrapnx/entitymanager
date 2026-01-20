const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Pfad zur Datenbank-Datei im gemounteten Volume
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Middleware für JSON-Parsing und statische Dateien
app.use(express.json());
// Serviert entity_manager.html als Startseite
app.use(express.static(__dirname, { index: 'entity_manager.html' }));

// Initialisierung der Datenbank
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Standard-Datenstruktur, falls noch keine DB existiert
const defaultData = {
    types: [
        { id: 't1', name: 'Beispiel-Typ', attributes: [{ name: 'Titel', type: 'text' }] }
    ],
    entities: []
};

// API: Daten laden
app.get('/api/data', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json(defaultData);
        }
    } catch (err) {
        console.error("Ladefehler:", err);
        res.status(500).json({ error: "Konnte Datenbank nicht lesen." });
    }
});

// API: Daten speichern
app.post('/api/save', (req, res) => {
    try {
        const newData = req.body;
        // Einfache Validierung
        if (!newData || !newData.types || !newData.entities) {
            return res.status(400).json({ error: "Ungültiges Datenformat." });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error("Speicherfehler:", err);
        res.status(500).json({ error: "Konnte Datenbank nicht schreiben." });
    }
});

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Datenbank-Pfad: ${DB_FILE}`);
});