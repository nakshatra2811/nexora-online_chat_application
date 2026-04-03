/**
 * Nexora Time Protocol - Force Indian Standard Time (IST) 
 * Specifically configured for Mumbai/India as per Protocol requirements.
 */

export const INDIAN_LOCALE = "en-IN";
export const MUMBAI_TIMEZONE = "Asia/Kolkata";

/**
 * Returns formatted time in IST (HH:MM AM/PM)
 */
export function formatToIndianTime(date: Date = new Date()): string {
  return date.toLocaleTimeString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/**
 * Returns formatted date in IST (DD/MM/YYYY)
 */
export function formatToIndianDate(date: Date = new Date()): string {
  return date.toLocaleDateString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/**
 * Returns full timestamp in IST
 */
export function formatToIndianDateTime(date: Date = new Date()): string {
  return date.toLocaleString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
/**
 * Returns a human-readable "last seen" relative time with precise HH:MM AM/PM.
 */
export function formatLastSeen(timestamp?: number | string | Date | null): string {
  if (!timestamp) return "offline";
  const date = new Date(timestamp);
  const now = new Date();
  
  const timeStr = date.toLocaleTimeString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).toLowerCase();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "just now";
    return `today at ${timeStr}`;
  }
  
  if (isYesterday) return `yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return `${dateStr} at ${timeStr}`;
}

/**
 * Returns a very short version (e.g., 12:13 PM or 03 Apr) for tiny UI elements.
 */
export function formatLastSeenShort(timestamp?: number | string | Date | null): string {
  if (!timestamp) return "?";
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(INDIAN_LOCALE, {
      timeZone: MUMBAI_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false // Use 24h for tiny elements as requested?
    });
  }

  return date.toLocaleDateString(INDIAN_LOCALE, {
    timeZone: MUMBAI_TIMEZONE,
    day: "2-digit",
    month: "short"
  });
}
