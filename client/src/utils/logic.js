export function getCurrentSlot() {
  const hour = new Date().getHours();
  if (hour >= 15 && hour < 21) return 'Tarde';
  if (hour >= 21 || hour < 6) return 'Noche';
  return 'Mañana';
}

export function getOwnerName(index) {
  return index === 0 ? 'Goti' : 'Vale';
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function isAfterTurnStart() {
  return new Date().getHours() >= 15;
}

export function hasActionToday(appState) {
  return appState.lastActionDate === getTodayKey();
}

export function getOtherOwnerIndex(index) {
  return index === 0 ? 1 : 0;
}

export function computeNextTurnAt() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  return tomorrow.getTime();
}

export function keepRecentDays(entries) {
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

export function processAction(appState, action, reason = '') {
  const newState = JSON.parse(JSON.stringify(appState)); // Deep clone
  const slot = getCurrentSlot();
  const ownerName = getOwnerName(newState.currentOwner);
  const todayKey = getTodayKey();
  
  const entry = {
    id: `${todayKey}-${slot}-${Date.now()}`,
    date: todayKey,
    slot,
    owner: ownerName,
    action,
    reason,
    status: action === 'lavé' ? 'cumplido' : 'no-pude'
  };

  newState.entries = keepRecentDays([entry, ...newState.entries]);

  if (entry.status === 'cumplido') {
    newState.completedDays += 1;
    newState.lastActionDate = todayKey;
    const streak = newState.streaks[ownerName];
    streak.current += 1;
    streak.best = Math.max(streak.best, streak.current);
    
    if (newState.punishments[ownerName] > 0) {
      newState.punishments[ownerName] -= 1;
      entry.action = 'Lavé (castigo)';
      entry.reason = newState.punishments[ownerName] > 0
        ? `Castigos restantes: ${newState.punishments[ownerName]}`
        : 'Castigo cumplido.';
    }

    if (streak.current > 0 && streak.current % 30 === 0 && !streak.rewardAvailable) {
      streak.rewardAvailable = true;
      streak.rewardExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      streak.medals += 1;
      streak.medalsHistory.push(todayKey);
    }

    newState.nextOwner = getOtherOwnerIndex(newState.currentOwner);
    newState.nextTurnAt = computeNextTurnAt();
  } else {
    newState.lastActionDate = todayKey;
    newState.failedDays += 1;
    newState.streaks[ownerName].current = 0;
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
    action: `Castigo aplicado (${days} día${days === 1 ? '' : 's'})`,
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

export function checkPendingOwnerChange(appState) {
  if (appState.nextOwner != null && appState.nextTurnAt) {
    if (Date.now() >= appState.nextTurnAt) {
      const newState = { ...appState };
      newState.currentOwner = newState.nextOwner;
      newState.nextOwner = null;
      newState.nextTurnAt = null;
      return newState;
    }
  }
  return appState;
}
