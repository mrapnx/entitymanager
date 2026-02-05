
const express = require('express');
const fs = require('fs');
const path = require('path');
const xmlJs = require('xml-js');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const dataPath = path.join(__dirname, '../data/data.xml');

// Helper function to read data from XML file
const readData = () => {
    try {
        const xmlData = fs.readFileSync(dataPath, 'utf-8');
        const jsonData = xmlJs.xml2json(xmlData, { compact: true, spaces: 4 });
        return JSON.parse(jsonData);
    } catch (error) {
        console.error("Error reading data:", error);
        return { data: { types: { type: [] }, entities: { entity: [] } } };
    }
};

// Helper function to write data to XML file
const writeData = (data) => {
    try {
        const options = { compact: true, ignoreComment: true, spaces: 4 };
        const xmlData = xmlJs.json2xml(JSON.stringify(data), options);
        fs.writeFileSync(dataPath, xmlData, 'utf-8');
    } catch (error) {
        console.error("Error writing data:", error);
    }
};

// API routes
app.get('/api/data', (req, res) => {
    res.json(readData());
});

app.post('/api/types', (req, res) => {
    const data = readData();
    const newType = req.body;
    if (!Array.isArray(data.data.types.type)) {
        data.data.types.type = [];
    }
    data.data.types.type.push(newType);
    writeData(data);
    res.json({ message: 'Type created successfully' });
});

app.post('/api/entities', (req, res) => {
    const data = readData();
    const newEntity = req.body;
    newEntity._attributes = { id: Date.now().toString() };
    if (!Array.isArray(data.data.entities.entity)) {
        data.data.entities.entity = [];
    }
    data.data.entities.entity.push(newEntity);
    writeData(data);
    res.json({ message: 'Entity created successfully', entity: newEntity });
});

app.put('/api/entities/:id', (req, res) => {
    const data = readData();
    const entityId = req.params.id;
    const updatedEntity = req.body;
    if (!Array.isArray(data.data.entities.entity)) {
        data.data.entities.entity = [];
    }
    const entityIndex = data.data.entities.entity.findIndex(e => e._attributes.id === entityId);
    if (entityIndex !== -1) {
        data.data.entities.entity[entityIndex] = { ...data.data.entities.entity[entityIndex], ...updatedEntity };
        writeData(data);
        res.json({ message: 'Entity updated successfully' });
    } else {
        res.status(404).json({ message: 'Entity not found' });
    }
});

app.delete('/api/entities/:id', (req, res) => {
    const data = readData();
    const entityId = req.params.id;
    if (!Array.isArray(data.data.entities.entity)) {
        data.data.entities.entity = [];
    }
    const initialLength = data.data.entities.entity.length;
    data.data.entities.entity = data.data.entities.entity.filter(e => e._attributes.id !== entityId);
    if (data.data.entities.entity.length < initialLength) {
        writeData(data);
        res.json({ message: 'Entity deleted successfully' });
    } else {
        res.status(404).json({ message: 'Entity not found' });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
