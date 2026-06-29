/**
 * Notification utilities for "¿Quién lava los platos?"
 * Uses the Web Notifications API + a repeating check via setInterval.
 */

const NOTIF_CHECK_KEY = 'lastNotifDate';

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
 * Schedule a daily reminder at 15:00 for whoever's turn it is.
 * Runs a check every minute and fires the notification once per day.
 */
export function scheduleDailyReminder(getOwnerName) {
  const check = () => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const todayKey = now.toISOString().slice(0, 10);
    const lastSent = localStorage.getItem(NOTIF_CHECK_KEY);

    // Fire exactly at 15:00, once per day
    if (hour === 15 && min === 0 && lastSent !== todayKey) {
      const owner = getOwnerName();
      localStorage.setItem(NOTIF_CHECK_KEY, todayKey);
      sendNotification(
        '¿Quién lava los platos?',
        `Hoy le toca a ${owner}. ¡No te olvides!`
      );
    }
  };

  // Run immediately in case app opens exactly at 15:00
  check();
  // Then check every 30 seconds
  return setInterval(check, 30_000);
}
