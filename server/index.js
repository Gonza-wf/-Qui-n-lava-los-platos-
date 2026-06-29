const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.sendStatus(200));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const DATA_FILE = path.join(__dirname, 'data.json');

const initialState = {
  currentOwner: 1, // 0=Goti, 1=Vale — cambia esto para decidir quién empieza
  streaks: {
    'Goti': { current: 0, best: 0, medals: 0, rewardAvailable: false, rewardExpiresAt: null, rewardUsed: false, medalsHistory: [] },
    'Vale': { current: 0, best: 0, medals: 0, rewardAvailable: false, rewardExpiresAt: null, rewardUsed: false, medalsHistory: [] }
  },
  entries: [],
  completedDays: 0,
  failedDays: 0,
  lastActionDate: null,
  nextOwner: null,
  nextTurnAt: null,
  punishments: {
    Goti: 0,
    Vale: 0
  }
};

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
  return initialState;
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

let appState = loadState();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('stateUpdated', appState);

  socket.on('syncState', (newState) => {
    appState = { ...appState, ...newState };
    saveState(appState);
    socket.broadcast.emit('stateUpdated', appState);
  });

  socket.on('resetState', () => {
    appState = initialState;
    saveState(appState);
    io.emit('stateUpdated', appState);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
