/**
 * Returns today's date as a YYYY-MM-DD string in LOCAL timezone.
 * Using toISOString() is wrong because it's UTC — in IST (+5:30),
 * midnight to 5:30 AM would return the previous day's date.
 */
export function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
