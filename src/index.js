
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const dataPath = path.join(__dirname, '../data/data.json');

// Helper function to read data from JSON file
const readData = () => {
    try {
        const jsonData = fs.readFileSync(dataPath, 'utf-8');
        return JSON.parse(jsonData);
    } catch (error) {
        console.error("Error reading data:", error);
        return { types: [], entities: [] };
    }
};

// Helper function to write data to JSON file
const writeData = (data) => {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error writing data:", error);
    }
};

// API routes
app.get('/api/data', (req, res) => {
    res.json(readData());
});

app.post('/api/data', (req, res) => {
    const newData = req.body;
    writeData(newData);
    res.json({ message: 'Data imported successfully' });
});

// Type routes
app.post('/api/types', (req, res) => {
    const data = readData();
    const newType = req.body;
    newType.id = Date.now().toString();
    data.types.push(newType);
    writeData(data);
    res.json({ message: 'Type created successfully', type: newType });
});

app.put('/api/types/:id', (req, res) => {
    const data = readData();
    const typeId = req.params.id;
    const updatedType = req.body;
    const typeIndex = data.types.findIndex(t => t.id === typeId);
    if (typeIndex !== -1) {
        data.types[typeIndex] = { ...data.types[typeIndex], ...updatedType };
        writeData(data);
        res.json({ message: 'Type updated successfully' });
    } else {
        res.status(404).json({ message: 'Type not found' });
    }
});

app.delete('/api/types/:id', (req, res) => {
    const data = readData();
    const typeId = req.params.id;
    const initialLength = data.types.length;
    data.types = data.types.filter(t => t.id !== typeId);
    if (data.types.length < initialLength) {
        writeData(data);
        res.json({ message: 'Type deleted successfully' });
    } else {
        res.status(404).json({ message: 'Type not found' });
    }
});

// Entity routes
app.post('/api/entities', (req, res) => {
    const data = readData();
    const newEntity = req.body;
    newEntity.id = Date.now().toString();
    data.entities.push(newEntity);
    writeData(data);
    res.json({ message: 'Entity created successfully', entity: newEntity });
});

app.put('/api/entities/:id', (req, res) => {
    const data = readData();
    const entityId = req.params.id;
    const updatedEntity = req.body;
    const entityIndex = data.entities.findIndex(e => e.id === entityId);
    if (entityIndex !== -1) {
        data.entities[entityIndex] = { ...data.entities[entityIndex], ...updatedEntity };
        writeData(data);
        res.json({ message: 'Entity updated successfully' });
    } else {
        res.status(404).json({ message: 'Entity not found' });
    }
});

app.delete('/api/entities/:id', (req, res) => {
    const data = readData();
    const entityId = req.params.id;
    const initialLength = data.entities.length;
    data.entities = data.entities.filter(e => e.id !== entityId);
    if (data.entities.length < initialLength) {
        writeData(data);
        res.json({ message: 'Entity deleted successfully' });
    } else {
        res.status(404).json({ message: 'Entity not found' });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
