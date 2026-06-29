const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'server-data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function loadServerData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { actions: [] };
  }
}

function saveServerData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/sync', (req, res) => {
  const { actions } = req.body;
  if (!Array.isArray(actions)) {
    return res.status(400).json({ success: false, error: 'Formato inválido' });
  }

  const serverData = loadServerData();
  serverData.actions = [...serverData.actions, ...actions];
  saveServerData(serverData);

  return res.json({ success: true, synced: actions.length });
});

app.get('/server-data', (req, res) => {
  const serverData = loadServerData();
  res.json(serverData);
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutando en http://localhost:${PORT}`);
});
