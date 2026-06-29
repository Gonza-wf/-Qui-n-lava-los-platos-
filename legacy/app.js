const STORAGE_KEY = 'quien-lava-platos-v3';

// NOTE: persistence enabled by default. To reset stored data for testing,
// use the "Reiniciar app" button in the UI which clears localStorage and reloads.

const initialState = {
  currentOwner: 0,
  selectedUser: null,
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
  },
  syncQueue: [],
  feedbackMessage: '',
  isAdmin: false
 };

const SYNC_ENDPOINT = '/sync';
let state = loadState();
let pendingAction = null;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed) return initialState;
    return {
      ...initialState,
      ...parsed,
      streaks: {
        ...initialState.streaks,
        ...(parsed.streaks || {})
      },
      punishments: {
        ...initialState.punishments,
        ...(parsed.punishments || {})
      },
      lastActionDate: parsed.lastActionDate || null,
      nextOwner: parsed.nextOwner || null,
      nextTurnAt: parsed.nextTurnAt || null,
      feedbackMessage: parsed.feedbackMessage || '',
      isAdmin: parsed.isAdmin || false
    };
  } catch {
    return initialState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isOnline() {
  return window.navigator.onLine;
}

function updateSyncStatus() {
  const statusElement = document.getElementById('syncStatus');
  if (!statusElement) return;

  if (!isOnline()) {
    statusElement.textContent = 'Estado de sincronización: sin conexión.';
    return;
  }

  if (state.syncQueue.length === 0) {
    statusElement.textContent = 'Estado de sincronización: todo sincronizado.';
  } else {
    statusElement.textContent = `Estado de sincronización: ${state.syncQueue.length} acción${state.syncQueue.length === 1 ? '' : 'es'} pendiente${state.syncQueue.length === 1 ? '' : 's'}.`;
  }
}

async function syncPendingActions() {
  updateSyncStatus();
  if (!isOnline() || state.syncQueue.length === 0) {
    return;
  }

  try {
    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: state.syncQueue })
    });

    if (!response.ok) {
      throw new Error('No se pudo sincronizar');
    }

    const result = await response.json();
    if (result.success) {
      state.syncQueue = [];
      saveState();
      updateSyncStatus();
      showFeedback('Datos sincronizados correctamente.');
    } else {
      updateSyncStatus();
    }
  } catch (error) {
    updateSyncStatus();
  }
}

function addToSyncQueue(payload) {
  state.syncQueue = [...state.syncQueue, payload];
  saveState();
  updateSyncStatus();
  if (isOnline()) {
    syncPendingActions();
  }
}

function getCurrentSlot() {
  const hour = new Date().getHours();
  if (hour >= 15 && hour < 21) return 'Tarde';
  if (hour >= 21 || hour < 6) return 'Noche';
  return 'Mañana';
}

function getOwnerName(index) {
  return index === 0 ? 'Goti' : 'Vale';
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isAfterTurnStart() {
  return new Date().getHours() >= 15;
}

function hasActionToday() {
  return state.lastActionDate === getTodayKey();
}

function getOtherOwnerIndex(index) {
  return index === 0 ? 1 : 0;
}

function computeNextTurnAt() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  return tomorrow.getTime();
}

function applyPendingOwnerChange() {
  if (state.nextOwner == null || !state.nextTurnAt) return;
  if (Date.now() >= state.nextTurnAt) {
    state.currentOwner = state.nextOwner;
    state.nextOwner = null;
    state.nextTurnAt = null;
    saveState();
  }
}

function cleanupRewardState(ownerName) {
  const streak = state.streaks[ownerName];
  if (streak.rewardExpiresAt && Date.now() > streak.rewardExpiresAt && !streak.rewardUsed) {
    streak.rewardAvailable = false;
    streak.rewardExpiresAt = null;
  }
}

function updateRewardState(ownerName) {
  const streak = state.streaks[ownerName];
  cleanupRewardState(ownerName);
  if (streak.current > 0 && streak.current % 30 === 0 && !streak.rewardAvailable) {
    streak.rewardAvailable = true;
    streak.rewardExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    streak.medals += 1;
    streak.medalsHistory = [...(streak.medalsHistory || []), getTodayKey()];
  }
}

function keepRecentDays(entries) {
  const seenDates = new Set();
  const filtered = [];

  for (const entry of entries) {
    if (seenDates.size < 7 || seenDates.has(entry.date)) {
      if (!seenDates.has(entry.date)) {
        seenDates.add(entry.date);
      }
      filtered.push(entry);
    }
  }

  return filtered;
}

function registerAction(action, reason = '') {
  const slot = getCurrentSlot();
  const ownerName = getOwnerName(state.currentOwner);
  const todayKey = getTodayKey();
  const entry = {
    id: `${todayKey}-${slot}`,
    date: todayKey,
    slot,
    owner: ownerName,
    action,
    reason,
    status: action === 'lavé' ? 'cumplido' : 'no-pude'
  };

  state.entries = keepRecentDays([entry, ...state.entries]);

  if (entry.status === 'cumplido') {
    state.completedDays += 1;
    state.lastActionDate = todayKey;
    const streak = state.streaks[ownerName];
    streak.current += 1;
    streak.best = Math.max(streak.best, streak.current);
    if (state.punishments[ownerName] > 0) {
      state.punishments[ownerName] = Math.max(0, state.punishments[ownerName] - 1);
      entry.action = 'Lavé (castigo)';
      entry.reason = state.punishments[ownerName] > 0
        ? `Días de castigo restantes: ${state.punishments[ownerName]}`
        : 'Último día de castigo cumplido.';
    }
    updateRewardState(ownerName);
    // Schedule owner change for the next day at 15:00 (do not switch immediately)
    state.nextOwner = getOtherOwnerIndex(state.currentOwner);
    state.nextTurnAt = computeNextTurnAt();
  } else {
    state.lastActionDate = todayKey;
    state.failedDays += 1;
    const streak = state.streaks[ownerName];
    streak.current = 0;
  }

  saveState();
  addToSyncQueue({ type: 'action', payload: entry });
  render();
  showFeedback(`${ownerName} · ${slot} · ${action}`);
}

function useReward() {
  const ownerName = state.selectedUser || getOwnerName(state.currentOwner);
  const streak = state.streaks[ownerName];
  cleanupRewardState(ownerName);
  const expired = streak.rewardExpiresAt && Date.now() > streak.rewardExpiresAt;

  if (!streak.rewardAvailable || expired) {
    showFeedback('El comodín ya no está disponible.');
    return;
  }

  streak.rewardAvailable = false;
  streak.rewardActivatedAt = getTodayKey();
  streak.rewardExpiresAt = null;
  streak.current += 1;
  streak.best = Math.max(streak.best, streak.current);
  state.completedDays += 1;
  state.lastActionDate = getTodayKey();

  // Schedule owner change for the next day at 15:00 (do not switch immediately)
  state.nextOwner = getOtherOwnerIndex(state.currentOwner);
  state.nextTurnAt = computeNextTurnAt();

  const entry = {
    id: `${getTodayKey()}-comodín`,
    date: getTodayKey(),
    slot: 'Comodín',
    owner: ownerName,
    action: 'Comodín activado',
    reason: 'Protección de un día sin castigo',
    status: 'cumplido'
  };
  state.entries = keepRecentDays([entry, ...state.entries]);

  saveState();
  render();
  showFeedback('Comodín activado. Día libre sin castigo.');
}

function addPunishment(user, reason, days = 1) {
  const todayKey = getTodayKey();
  const entry = {
    id: `${todayKey}-castigo-${user}-${Date.now()}`,
    date: todayKey,
    slot: 'Castigo',
    owner: user,
    action: `Castigo aplicado (${days} día${days === 1 ? '' : 's'})`,
    reason,
    status: 'castigo'
  };

  state.entries = keepRecentDays([entry, ...state.entries]);
  state.failedDays += 1;
  state.punishments[user] = (state.punishments[user] || 0) + days;
  const streak = state.streaks[user];
  if (streak) {
    streak.current = 0;
  }
  saveState();
  addToSyncQueue({ type: 'punishment', payload: entry });
  render();
  showFeedback(`Castigo aplicado a ${user}`);
}

function syncBrowserState() {
  updateSyncStatus();
  if (isOnline()) {
    syncPendingActions();
  }
}

function render() {
  // Apply any pending owner change if its scheduled time has arrived
  applyPendingOwnerChange();
  const slot = getCurrentSlot();
  const ownerName = getOwnerName(state.currentOwner);
  const displayUser = state.selectedUser || ownerName;
  const streak = state.streaks[ownerName];
  const displayStreak = state.streaks[displayUser];
  cleanupRewardState(ownerName);
  cleanupRewardState(displayUser);
  const hasAvailableReward = displayStreak.rewardAvailable && (!displayStreak.rewardExpiresAt || Date.now() <= displayStreak.rewardExpiresAt);
  const isActiveReward = Boolean(displayStreak.rewardActivatedAt);

  document.getElementById('slotBadge').textContent = slot;
  document.getElementById('currentPerson').textContent = ownerName;

  const rewardText = document.getElementById('rewardText');
  const rewardExpiry = document.getElementById('rewardExpiry');
  if (isActiveReward) {
    rewardText.textContent = `Comodín activo desde ${displayStreak.rewardActivatedAt}`;
    rewardExpiry.textContent = '';
  } else if (hasAvailableReward) {
    const expires = new Date(displayStreak.rewardExpiresAt).toLocaleDateString('es-ES');
    rewardText.textContent = `Disponible para ${displayUser} hasta ${expires}`;
    rewardExpiry.textContent = `Vence ${expires}`;
  } else {
    rewardText.textContent = 'Sin comodín activo';
    rewardExpiry.textContent = '';
  }

  document.getElementById('rewardFill').style.width = `${Math.min(100, (displayStreak.current / 30) * 100)}%`;
  document.getElementById('completedDays').textContent = state.completedDays;
  document.getElementById('failedDays').textContent = state.failedDays;
  document.getElementById('medalsCount').textContent = displayStreak.medals;
  document.getElementById('useRewardButton').style.display = hasAvailableReward ? 'inline-flex' : 'none';

  const mainRewardPanel = document.getElementById('mainRewardPanel');
  if (isActiveReward) {
    mainRewardPanel.textContent = `Comodín activo de ${displayUser} desde ${displayStreak.rewardActivatedAt}.`;
    mainRewardPanel.classList.remove('hidden');
  } else if (hasAvailableReward) {
    mainRewardPanel.textContent = `¡${displayUser} tiene un comodín disponible! Activalo en Rachas antes del ${new Date(displayStreak.rewardExpiresAt).toLocaleDateString('es-ES')}.`;
    mainRewardPanel.classList.remove('hidden');
  } else {
    mainRewardPanel.classList.add('hidden');
  }

  const userOverlay = document.getElementById('userSelectOverlay');
  const isSelected = Boolean(state.selectedUser);
  userOverlay.classList.toggle('hidden', isSelected);

  const currentUser = state.selectedUser;
  const isCurrentTurn = currentUser === ownerName;
  const turnAvailable = isAfterTurnStart() && !hasActionToday();
  document.getElementById('view-today').querySelector('.actions').style.display = isSelected && isCurrentTurn && turnAvailable ? 'grid' : 'none';

  const punishmentNotice = document.getElementById('punishmentNotice');
  const punishedDays = state.punishments[displayUser] || 0;
  const otherUser = displayUser === 'Goti' ? 'Vale' : 'Goti';
  const otherPunishedDays = state.punishments[otherUser] || 0;

  if (isSelected && punishedDays > 0) {
    punishmentNotice.innerHTML = `
      <div class="punishment-panel__content">
        <strong>Tienes ${punishedDays} día${punishedDays === 1 ? '' : 's'} de castigo pendiente.</strong>
        <p>Completa el día para reducirlo.</p>
      </div>`;
    punishmentNotice.classList.remove('hidden');
  } else if (isSelected && otherPunishedDays > 0) {
    punishmentNotice.innerHTML = `
      <div class="punishment-panel__content">
        <strong>${otherUser} tiene ${otherPunishedDays} día${otherPunishedDays === 1 ? '' : 's'} de castigo.</strong>
        <p>Decidí si perdonar o no perdonar el castigo.</p>
        <div class="punishment-actions">
          <button class="primary-btn small" id="forgiveButton">Perdonar</button>
          <button class="secondary-btn small" id="denyForgivenessButton">No perdonar</button>
        </div>
      </div>`;
    punishmentNotice.classList.remove('hidden');
  } else {
    punishmentNotice.classList.add('hidden');
    punishmentNotice.innerHTML = '';
  }

  if (isSelected && otherPunishedDays > 0) {
    document.getElementById('forgiveButton').addEventListener('click', () => {
      state.punishments[otherUser] = 0;
      state.entries = keepRecentDays([{ id: `${getTodayKey()}-perdonar`, date: getTodayKey(), slot: 'Perdón', owner: currentUser, action: `Perdonó a ${otherUser}`, reason: `${otherUser} fue perdonado`, status: 'cumplido' }, ...state.entries]);
      saveState();
      addToSyncQueue({ type: 'forgiveness', payload: { owner: currentUser, target: otherUser, action: 'perdonó' } });
      render();
      showFeedback(`${otherUser} fue perdonado.`);
    });
    document.getElementById('denyForgivenessButton').addEventListener('click', () => {
      state.entries = keepRecentDays([{ id: `${getTodayKey()}-no-perdonar`, date: getTodayKey(), slot: 'Perdón', owner: currentUser, action: `No perdonó a ${otherUser}`, reason: `${otherUser} mantiene el castigo`, status: 'no-pude' }, ...state.entries]);
      saveState();
      addToSyncQueue({ type: 'forgiveness', payload: { owner: currentUser, target: otherUser, action: 'no-perdonó' } });
      render();
      showFeedback(`No se perdonó a ${otherUser}.`);
    });
  }

  const defaultFeedback = isSelected
    ? hasActionToday()
      ? 'Turno completado hoy.'
      : isCurrentTurn
        ? isAfterTurnStart()
          ? 'Esperando acción.'
          : 'El turno comienza hoy a las 15:00.'
        : `Le toca a ${ownerName}`
    : 'Seleccioná tu nombre para continuar.';
  document.getElementById('feedbackMessage').textContent = state.feedbackMessage || defaultFeedback;

  const history = document.getElementById('historyList');
  if (!state.entries.length) {
    history.innerHTML = '<div class="history-item"><div><strong>Aún no hay registros</strong><div class="history-meta">Tu primer registro aparecerá aquí.</div></div></div>';
  } else {
    history.innerHTML = state.entries.map((entry) => `
      <div class="history-item">
        <div>
          <strong>${entry.date}</strong>
          <div class="history-meta">${entry.owner} · ${entry.slot}</div>
        </div>
        <div class="history-controls">
          <div class="history-status ${entry.status}">${entry.action}</div>
          ${entry.reason ? `<button class="ghost-btn small show-reason" data-reason="${encodeURIComponent(entry.reason)}">Ver motivo</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  history.querySelectorAll('.show-reason').forEach((button) => {
    button.addEventListener('click', () => {
      const reason = decodeURIComponent(button.dataset.reason);
      openReasonView(reason);
    });
  });
}

function openReasonView(reason) {
  const overlay = document.getElementById('reasonViewOverlay');
  const text = document.getElementById('reasonViewText');
  text.textContent = reason;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeReasonView() {
  const overlay = document.getElementById('reasonViewOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function openMedalsView() {
  const overlay = document.getElementById('medalsOverlay');
  const list = document.getElementById('medalsList');
  const user = state.selectedUser || getOwnerName(state.currentOwner);
  const medals = state.streaks[user]?.medalsHistory || [];
  list.innerHTML = medals.length
    ? medals.map((date, index) => `<div class="medal-item"><span>🏅</span><div><strong>Medalla ${index + 1}</strong><span>${date}</span></div></div>`).join('')
    : '<div class="medal-empty">Aún no hay medallas obtenidas.</div>';
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeMedalsView() {
  const overlay = document.getElementById('medalsOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function showFeedback(message) {
  state.feedbackMessage = message;
  const feedback = document.getElementById('feedbackMessage');
  feedback.textContent = message;
}

function openReasonModal() {
  const modal = document.getElementById('reasonModal');
  const input = document.getElementById('reasonInput');
  input.value = '';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  input.focus();
}

function closeReasonModal() {
  const modal = document.getElementById('reasonModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'no-pude') {
      pendingAction = 'no-pude';
      openReasonModal();
      return;
    }
    registerAction(action);
  });
});

document.querySelectorAll('.user-select').forEach((button) => {
  button.addEventListener('click', () => {
    state.selectedUser = button.dataset.user;
    saveState();
    render();
  });
});

document.getElementById('saveReason').addEventListener('click', () => {
  const reason = document.getElementById('reasonInput').value.trim();
  closeReasonModal();
  registerAction(pendingAction || 'no-pude', reason);
  pendingAction = null;
});

document.getElementById('cancelReason').addEventListener('click', () => {
  pendingAction = null;
  closeReasonModal();
});

document.getElementById('reasonModal').addEventListener('click', (event) => {
  if (event.target.id === 'reasonModal') closeReasonModal();
});

document.getElementById('closeReasonView').addEventListener('click', closeReasonView);

document.getElementById('reasonViewOverlay').addEventListener('click', (event) => {
  if (event.target.id === 'reasonViewOverlay') closeReasonView();
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

// Admin access (hidden): open admin login with Ctrl+Alt+A
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
    const modal = document.getElementById('adminLoginModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('adminPassword').focus();
  }
});

document.getElementById('adminCancel').addEventListener('click', () => {
  const modal = document.getElementById('adminLoginModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
});

document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const ADMIN_PASSWORD = 'admin123';
  const value = document.getElementById('adminPassword').value;
  if (value === ADMIN_PASSWORD) {
    state.isAdmin = true;
    saveState();
    const modal = document.getElementById('adminLoginModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    switchView('admin');
    render();
  } else {
    showFeedback('Clave administrativa incorrecta.');
  }
});

document.getElementById('useRewardButton').addEventListener('click', useReward);
document.getElementById('medalsButton').addEventListener('click', openMedalsView);
document.getElementById('closeMedalsView').addEventListener('click', closeMedalsView);
document.getElementById('medalsOverlay').addEventListener('click', (event) => {
  if (event.target.id === 'medalsOverlay') closeMedalsView();
});
// Admin controls: punishment and admin reset
document.getElementById('addPunishmentButton').addEventListener('click', () => {
  if (!state.isAdmin) { showFeedback('Acceso denegado.'); return; }
  const user = document.getElementById('adminUserSelect').value;
  const days = Math.max(1, Number(document.getElementById('adminPunishmentDays').value) || 1);
  const reason = document.getElementById('adminReason').value.trim() || 'Castigo aplicado por administrador';
  addPunishment(user, reason, days);
});

document.getElementById('resetAppAdmin').addEventListener('click', () => {
  if (!state.isAdmin) { showFeedback('Acceso denegado.'); return; }
  if (confirm('Reiniciar app y borrar datos locales?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

window.addEventListener('online', syncBrowserState);
window.addEventListener('offline', syncBrowserState);

window.addEventListener('load', () => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 900);
  }
});

syncBrowserState();
render();
