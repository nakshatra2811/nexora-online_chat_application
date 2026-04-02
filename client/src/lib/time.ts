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
