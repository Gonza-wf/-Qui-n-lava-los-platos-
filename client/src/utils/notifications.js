/**
 * Notification utilities for "¿Quién lava los platos?"
 * Uses the Web Notifications API + a repeating check via setInterval.
 */

const NOTIF_TARDE_KEY = 'lastNotifTarde';
const NOTIF_NOCHE_KEY = 'lastNotifNoche';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function sendNotification(title, body, icon = '/icon.svg') {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, badge: '/icon.svg' });
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

/**
 * Get local date string YYYY-MM-DD
 */
function getLocalDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Schedule daily reminders:
 * - At 15:00 (or when app opens after 15:00): "Hoy le toca a X"
 * - At 20:00 (or when app opens after 20:00): "¡Acordate de lavar los platos esta noche!"
 *
 * Fires as soon as the app opens if we're already past the reminder time and it
 * hasn't been sent yet today.
 */
export function scheduleDailyReminder(getOwnerName) {
  const check = () => {
    const now = new Date();
    const hour = now.getHours();
    const todayKey = getLocalDateKey();

    // --- Tarde reminder: fire any time between 15:00 and 19:59 if not sent yet today ---
    if (hour >= 15 && hour < 20) {
      const lastTarde = localStorage.getItem(NOTIF_TARDE_KEY);
      if (lastTarde !== todayKey) {
        const owner = getOwnerName();
        localStorage.setItem(NOTIF_TARDE_KEY, todayKey);
        sendNotification(
          '🍽️ ¿Quién lava los platos?',
          `Hoy le toca a ${owner}. ¡El turno de tarde ya está abierto!`
        );
      }
    }

    // --- Noche reminder: fire any time between 20:00 and 23:59 if not sent yet today ---
    if (hour >= 20) {
      const lastNoche = localStorage.getItem(NOTIF_NOCHE_KEY);
      if (lastNoche !== todayKey) {
        const owner = getOwnerName();
        localStorage.setItem(NOTIF_NOCHE_KEY, todayKey);
        sendNotification(
          '🌙 Turno de noche',
          `¡${owner}, no te olvides de lavar los platos antes de dormir!`
        );
      }
    }
  };

  // Run immediately in case app opens after 15:00 or 20:00
  check();
  // Then check every 5 minutes
  return setInterval(check, 5 * 60_000);
}
