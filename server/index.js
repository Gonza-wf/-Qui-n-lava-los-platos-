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
  currentOwner: 0, // 0=Goti, 1=Vale
  streaks: {
    'Goti': { current: 0, best: 0, medals: 0, rewardAvailable: false, rewardExpiresAt: null, rewardUsed: false, medalsHistory: [] },
    'Vale': { current: 0, best: 0, medals: 0, rewardAvailable: false, rewardExpiresAt: null, rewardUsed: false, medalsHistory: [] }
  },
  entries: [],
  completedDays: { Goti: 0, Vale: 0 },
  failedDays: { Goti: 0, Vale: 0 },
  lastActionDate: null,
  nextOwner: null,
  nextTurnAt: null,
  punishments: { Goti: 0, Vale: 0 },
  slotsDoneToday: {},
  pendingMorning: { Goti: false, Vale: false },
  lastDayChangeDate: null
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
  return JSON.parse(JSON.stringify(initialState));
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

/**
 * Returns YYYY-MM-DD for the TURN DATE (Argentina timezone UTC-3).
 * The "turn" starts at 15:00 local. Before 15:00 we still belong to yesterday's turn.
 */
function getTurnDateKey() {
  // UTC offset for Argentina (UTC-3): subtract 3 hours
  const now = new Date();
  // Argentina local time = UTC - 3h
  const argOffset = -3 * 60; // minutes
  const localMs = now.getTime() + (argOffset * 60 * 1000);
  const localDate = new Date(localMs);
  const h = localDate.getUTCHours();
  if (h < 15) {
    localDate.setUTCDate(localDate.getUTCDate() - 1);
  }
  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function checkAndFlipTurn() {
  const currentTurnDateKey = getTurnDateKey();
  if (appState.lastDayChangeDate === currentTurnDateKey) return; // already flipped today

  console.log(`[Turn] Flipping from lastDayChangeDate=${appState.lastDayChangeDate} to ${currentTurnDateKey}`);

  if (appState.lastDayChangeDate !== null) {
    // Alternate owner
    appState.currentOwner = appState.currentOwner === 0 ? 1 : 0;
  }
  appState.lastDayChangeDate = currentTurnDateKey;
  saveState(appState);
  io.emit('stateUpdated', appState);
  console.log(`[Turn] New owner index: ${appState.currentOwner}`);
}

let appState = loadState();

// Run turn check immediately on server start and then every minute
checkAndFlipTurn();
setInterval(checkAndFlipTurn, 60_000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('stateUpdated', appState);

  socket.on('syncState', (newState) => {
    appState = { ...appState, ...newState };
    saveState(appState);
    socket.broadcast.emit('stateUpdated', appState);
  });

  socket.on('resetState', () => {
    appState = JSON.parse(JSON.stringify(initialState));
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
