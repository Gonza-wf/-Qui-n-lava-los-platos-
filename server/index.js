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
const USERS = ['Goti', 'Vale'];

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
      const parsed = JSON.parse(data);
      // Merge with initialState to ensure all fields exist
      return { ...JSON.parse(JSON.stringify(initialState)), ...parsed };
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

function isDefaultState(state) {
  // Detects if the state is effectively empty (no history = server just restarted and lost data)
  return (!state.entries || state.entries.length === 0) && state.lastDayChangeDate === null;
}

// ─── Argentina time helpers ───────────────────────────────────────────────────

function getArgNow() {
  // UTC-3 fixed offset for Argentina
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function getArgHour() {
  return getArgNow().getUTCHours();
}

function getTurnDateKey() {
  // Turn starts at 15:00 Argentina time.
  // Before 15:00 → still on yesterday's turn.
  const arg = getArgNow();
  const h = arg.getUTCHours();
  if (h < 15) {
    arg.setUTCDate(arg.getUTCDate() - 1);
  }
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, '0');
  const d = String(arg.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayKey() {
  const arg = getArgNow();
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, '0');
  const d = String(arg.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 'mañana' = 06:00-14:59, 'tarde' = 15:00-19:59, 'noche' = 20:00-05:59
function getCurrentSlot() {
  const h = getArgHour();
  if (h >= 6 && h < 15) return 'mañana';
  if (h >= 15 && h < 20) return 'tarde';
  return 'noche';
}

// ─── Turn-flip logic (runs on server every minute) ────────────────────────────

function checkAndFlipTurn() {
  const currentTurnDateKey = getTurnDateKey();
  if (appState.lastDayChangeDate === currentTurnDateKey) return; // already done

  console.log(`[Turn] ${appState.lastDayChangeDate} → ${currentTurnDateKey}, flipping owner`);

  if (appState.lastDayChangeDate !== null) {
    appState.currentOwner = appState.currentOwner === 0 ? 1 : 0;
  }
  appState.lastDayChangeDate = currentTurnDateKey;
  saveState(appState);
  io.emit('stateUpdated', appState);
  console.log(`[Turn] New owner index: ${appState.currentOwner} (${appState.currentOwner === 0 ? 'Goti' : 'Vale'})`);
}

// ─── Expired-makeup punishment logic (runs on server every minute) ────────────

function checkExpiredMakeups() {
  const slot = getCurrentSlot();
  // Only apply punishment when tarde starts (morning window has closed)
  if (slot !== 'tarde') return;

  let changed = false;
  const todayKey = getTodayKey();

  for (const user of USERS) {
    if (appState.pendingMorning && appState.pendingMorning[user]) {
      console.log(`[Punishment] ${user} missed morning makeup → auto-punish`);
      appState.pendingMorning[user] = false;
      appState.punishments[user] = (appState.punishments[user] || 0) + 2;
      if (appState.streaks[user]) appState.streaks[user].current = 0;
      if (typeof appState.failedDays === 'object') appState.failedDays[user] = (appState.failedDays[user] || 0) + 1;

      const entry = {
        id: `${todayKey}-auto-castigo-${user}-${Date.now()}`,
        date: todayKey,
        slot: 'Mañana',
        owner: user,
        action: 'Castigo automático',
        reason: 'No recuperó el turno de mañana. +2 días de castigo.',
        status: 'castigo'
      };
      appState.entries = [entry, ...appState.entries].slice(0, 500);
      changed = true;
    }
  }

  if (changed) {
    saveState(appState);
    io.emit('stateUpdated', appState);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

let appState = loadState();
let stateRestoredFromClient = false;
let waitingForBackup = isDefaultState(appState);

// Give up waiting for backup after 15 seconds so app can function if no backup exists
if (waitingForBackup) {
  setTimeout(() => { waitingForBackup = false; }, 15000);
}

// Run turn-flip + expired-makeup check every minute
setInterval(() => {
  if (waitingForBackup) return;
  checkAndFlipTurn();
  checkExpiredMakeups();
}, 60_000);

// Also run at boot (after socket server is ready)
setTimeout(() => {
  if (waitingForBackup) return;
  checkAndFlipTurn();
  checkExpiredMakeups();
}, 1000);

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // If the server just restarted and lost data, ask clients to restore
  if (isDefaultState(appState) && !stateRestoredFromClient) {
    console.log('[State] Server has no data, requesting backup from client...');
    socket.emit('requestStateBackup');
    // Tell client not to overwrite its backup with this empty state
    socket.emit('stateUpdated', { ...appState, isDefaultState: true });
  } else {
    socket.emit('stateUpdated', appState);
  }

  // Client sends back its localStorage backup
  socket.on('restoreStateBackup', (clientState) => {
    if (!stateRestoredFromClient && clientState && clientState.entries && clientState.entries.length > 0) {
      console.log(`[State] Restoring ${clientState.entries.length} entries from client backup`);
      stateRestoredFromClient = true;
      waitingForBackup = false;
      appState = { ...JSON.parse(JSON.stringify(initialState)), ...clientState };
      saveState(appState);
      io.emit('stateUpdated', appState);
      
      // Now that we have state, check if we need to flip turns immediately
      checkAndFlipTurn();
      checkExpiredMakeups();
    }
  });

  socket.on('syncState', (newState) => {
    appState = { ...appState, ...newState };
    saveState(appState);
    socket.broadcast.emit('stateUpdated', appState);
  });

  socket.on('resetState', () => {
    stateRestoredFromClient = false;
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
