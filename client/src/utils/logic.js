// ─── Slots ────────────────────────────────────────────────────────────────────
// Tarde:  15:00 – 20:59
// Noche:  21:00 – 05:59
// Mañana:  6:00 – 14:59  (slot de recuperación)

export const SLOTS = { TARDE: 'tarde', NOCHE: 'noche', MANANA: 'mañana' };
export const USERS = ['Goti', 'Vale'];

export function getCurrentSlot() {
  const h = new Date().getHours();
  if (h >= 15 && h < 21) return SLOTS.TARDE;
  if (h >= 21 || h < 6)  return SLOTS.NOCHE;
  return SLOTS.MANANA;
}

export function getSlotLabel(slot) {
  return { tarde: 'Tarde', noche: 'Noche', mañana: 'Mañana' }[slot] || slot;
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getOwnerName(index) {
  return index === 0 ? 'Goti' : 'Vale';
}

export function getOtherUser(user) {
  return user === 'Goti' ? 'Vale' : 'Goti';
}

export function getOtherOwnerIndex(index) {
  return index === 0 ? 1 : 0;
}

export function computeNextTurnAt(slotAfter) {
  const now = new Date();
  const next = new Date(now);
  if (slotAfter === SLOTS.TARDE) {
    // Next tarde is today at 15:00 or tomorrow
    next.setHours(15, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (slotAfter === SLOTS.NOCHE) {
    next.setHours(21, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else {
    // Mañana = tomorrow 6 AM
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return next.getTime();
}

export function keepRecentDays(entries) {
  const seenDates = new Set();
  const filtered = [];
  for (const entry of entries) {
    if (seenDates.size < 7 || seenDates.has(entry.date)) {
      if (!seenDates.has(entry.date)) seenDates.add(entry.date);
      filtered.push(entry);
    }
  }
  return filtered;
}

// ─── Slots done today ─────────────────────────────────────────────────────────
// slotsDoneToday: { Goti: { tarde: bool, noche: bool }, Vale: { tarde: bool, noche: bool } }
// pendingMorning: { Goti: bool, Vale: bool } — need makeup slot
// pendingDate: the date string for which the pending morning applies

export function getUserSlotDoneToday(appState, user, slot) {
  const today = getTodayKey();
  return appState.slotsDoneToday?.[today]?.[user]?.[slot] === true;
}

export function getUserPendingMorning(appState, user) {
  return appState.pendingMorning?.[user] === true;
}

/**
 * Which slot should a given user act on right now?
 * Returns: { slot, available, message, isMakeup }
 */
export function getUserTurnInfo(appState, user) {
  const now = new Date();
  const h = now.getHours();
  const currentSlot = getCurrentSlot();
  const today = getTodayKey();
  const isPending = getUserPendingMorning(appState, user);

  const tardeDone = getUserSlotDoneToday(appState, user, SLOTS.TARDE);
  const nocheDone = getUserSlotDoneToday(appState, user, SLOTS.NOCHE);

  // If user has a pending morning makeup slot
  if (isPending && currentSlot === SLOTS.MANANA) {
    return {
      slot: SLOTS.MANANA,
      available: true,
      message: 'Tienes que lavar ahora para compensar ayer.',
      isMakeup: true
    };
  }

  // If pending morning but we're past morning — auto-punishment territory
  if (isPending && currentSlot !== SLOTS.MANANA) {
    return {
      slot: SLOTS.MANANA,
      available: false,
      message: 'Se venció la compensación. El admin debe aplicar castigo.',
      isMakeup: true,
      expired: true
    };
  }

  // Tarde slot
  if (currentSlot === SLOTS.TARDE) {
    if (tardeDone) {
      return { slot: SLOTS.TARDE, available: false, done: true, message: 'Ya lavaste en la tarde.' };
    }
    return { slot: SLOTS.TARDE, available: true, message: 'Es tu turno de la tarde. (Opcional — si no podés, podés hacerlo en la noche.)' };
  }

  // Noche slot
  if (currentSlot === SLOTS.NOCHE) {
    if (nocheDone) {
      return { slot: SLOTS.NOCHE, available: false, done: true, message: 'Ya lavaste en la noche.' };
    }
    return { slot: SLOTS.NOCHE, available: true, message: '¡Turno de noche! Si no podés, tendrás que hacerlo mañana a la mañana.' };
  }

  // Mañana slot
  if (currentSlot === SLOTS.MANANA) {
    // No pending: waiting for tarde
    return {
      slot: SLOTS.TARDE,
      available: false,
      message: 'El próximo turno comienza a las 15:00.',
      waiting: true
    };
  }

  return { slot: currentSlot, available: false, message: '' };
}

/**
 * Process an action (lavé / no-pude) for a user in a given slot.
 */
export function processAction(appState, user, slot, action, reason = '') {
  const newState = JSON.parse(JSON.stringify(appState));
  const todayKey = getTodayKey();

  // Ensure structures exist
  if (!newState.slotsDoneToday) newState.slotsDoneToday = {};
  if (!newState.slotsDoneToday[todayKey]) newState.slotsDoneToday[todayKey] = {};
  if (!newState.slotsDoneToday[todayKey][user]) {
    newState.slotsDoneToday[todayKey][user] = { tarde: false, noche: false, mañana: false };
  }
  if (!newState.pendingMorning) newState.pendingMorning = { Goti: false, Vale: false };

  const isMakeup = slot === SLOTS.MANANA;

  const entry = {
    id: `${todayKey}-${slot}-${user}-${Date.now()}`,
    date: todayKey,
    slot: getSlotLabel(slot),
    owner: user,
    action: action === 'lavé' ? (isMakeup ? 'Lavé (compensación)' : 'Lavé') : 'No pude',
    reason,
    status: action === 'lavé' ? 'cumplido' : 'no-pude'
  };

  newState.entries = keepRecentDays([entry, ...newState.entries]);

  if (action === 'lavé') {
    newState.slotsDoneToday[todayKey][user][slot] = true;
    newState.completedDays += 1;
    newState.lastActionDate = todayKey;

    if (isMakeup) newState.pendingMorning[user] = false;

    const streak = newState.streaks[user];
    streak.current += 1;
    streak.best = Math.max(streak.best, streak.current);

    // Reduce punishment if any
    if (newState.punishments[user] > 0) {
      newState.punishments[user] -= 1;
      entry.action = isMakeup ? 'Lavé (castigo/comp.)' : 'Lavé (castigo)';
      entry.reason = newState.punishments[user] > 0
        ? `Castigos restantes: ${newState.punishments[user]}`
        : 'Castigo cumplido.';
    }

    // Medal every 30 completed slots
    if (streak.current > 0 && streak.current % 30 === 0 && !streak.rewardAvailable) {
      streak.rewardAvailable = true;
      streak.rewardExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      streak.medals += 1;
      streak.medalsHistory.push(todayKey);
    }

  } else {
    // Missed slot
    newState.lastActionDate = todayKey;

    if (isMakeup) {
      // ❌ Missed morning makeup → automatic 2-day punishment
      newState.pendingMorning[user] = false;
      newState.failedDays += 1;
      newState.streaks[user].current = 0;
      newState.punishments[user] = (newState.punishments[user] || 0) + 2;
      entry.action = 'Castigo automático';
      entry.reason = 'No recuperó el turno de mañana. +2 días de castigo.';
      entry.status = 'castigo';

    } else if (slot === SLOTS.TARDE) {
      // ❌ Missed tarde → no penalty, just logged as skipped
      // Streak is not broken, no morning obligation
      entry.action = 'Saltó turno tarde';
      entry.status = 'no-pude';

    } else if (slot === SLOTS.NOCHE) {
      // ❌ Missed noche → morning makeup required
      newState.pendingMorning[user] = true;
      newState.failedDays += 1;
      newState.streaks[user].current = 0;
      entry.action = 'Falló noche — recuperar mañana';
      entry.status = 'no-pude';
    }
  }

  return newState;
}

export function processPunishment(appState, user, reason, days) {
  const newState = JSON.parse(JSON.stringify(appState));
  const todayKey = getTodayKey();
  const entry = {
    id: `${todayKey}-castigo-${user}-${Date.now()}`,
    date: todayKey,
    slot: 'Castigo',
    owner: user,
    action: `Castigo (${days} día${days === 1 ? '' : 's'})`,
    reason,
    status: 'castigo'
  };

  newState.entries = keepRecentDays([entry, ...newState.entries]);
  newState.failedDays += 1;
  newState.punishments[user] = (newState.punishments[user] || 0) + days;
  if (newState.streaks[user]) {
    newState.streaks[user].current = 0;
  }
  return newState;
}

export function checkExpiredMakeup(appState) {
  // Called on app load to auto-flag expired makeups
  const currentSlot = getCurrentSlot();
  if (currentSlot === SLOTS.MANANA) return appState; // still time

  let changed = false;
  const newState = JSON.parse(JSON.stringify(appState));
  if (!newState.pendingMorning) return appState;

  for (const user of USERS) {
    if (newState.pendingMorning[user] && currentSlot === SLOTS.TARDE) {
      // Morning is now over, auto-punish
      newState.pendingMorning[user] = false;
      newState.punishments[user] = (newState.punishments[user] || 0) + 2;
      newState.streaks[user].current = 0;
      newState.failedDays += 1;
      const todayKey = getTodayKey();
      newState.entries = keepRecentDays([{
        id: `${todayKey}-auto-castigo-${user}-${Date.now()}`,
        date: todayKey,
        slot: 'Auto',
        owner: user,
        action: 'Castigo automático',
        reason: 'No recuperó el turno de mañana. +2 días de castigo.',
        status: 'castigo'
      }, ...newState.entries]);
      changed = true;
    }
  }

  return changed ? newState : appState;
}
