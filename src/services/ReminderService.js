import { lectureMatchesSelection, getScheduleForDate } from '../utils/lectureMatching';
import { getLocalDateKey } from '../utils/dateUtils';

const DAILY_REMINDER_STORAGE_KEY = 'orario_daily_reminders';
const DEFAULT_DAILY_REMINDER_TIME = '08:20';

let scheduledDailyTimeoutId = null;
let scheduledDailySignature = '';

// getLocalDateKey is now imported from dateUtils (local timezone, not UTC)

function readDailyReminderLog() {
    try {
        const parsed = JSON.parse(localStorage.getItem(DAILY_REMINDER_STORAGE_KEY) || '{}');
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
        return {};
    }
}

function writeDailyReminderLog(log) {
    localStorage.setItem(DAILY_REMINDER_STORAGE_KEY, JSON.stringify(log));
}

function getDayKey(date = new Date()) {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

function getTodaysLectures(state, date = new Date()) {
    const dayKey = getDayKey(date);
    const dateKey = getLocalDateKey(date); // local timezone
    const todaySchedule = getScheduleForDate(dateKey, state); // versioned lookup
    const lectures = ((todaySchedule && todaySchedule[dayKey]) || [])
        .map((lecture, originalIdx) => ({ ...lecture, _origIdx: originalIdx }))
        .filter((lecture) => lectureMatchesSelection(lecture, state.selectedClass, state.selectedBatch, state.selectedPceBatch));

    return { dayKey, lectures };
}

export function cancelDailyReminder() {
    if (scheduledDailyTimeoutId !== null) {
        window.clearTimeout(scheduledDailyTimeoutId);
    }
    scheduledDailyTimeoutId = null;
    scheduledDailySignature = '';
}

function getDailyReminderTime(state) {
    const value = String(state.dailyReminder?.time || DEFAULT_DAILY_REMINDER_TIME).trim();
    return /^\d{2}:\d{2}$/.test(value) ? value : DEFAULT_DAILY_REMINDER_TIME;
}

export function calculateDailyReminder(state, date = new Date()) {
    const dailyReminder = state.dailyReminder || {};
    if (!dailyReminder.enabled) return null;

    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    const [hours, minutes] = getDailyReminderTime(state).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    let notifyAt = null;
    let reminderDateKey = '';
    for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
        const candidate = new Date(date);
        candidate.setDate(candidate.getDate() + dayOffset);
        candidate.setHours(hours, minutes, 0, 0);

        const candidateDateKey = getLocalDateKey(candidate);
        if (holidays.includes(candidateDateKey)) continue;
        if (candidate.getTime() <= date.getTime()) continue;

        notifyAt = candidate;
        reminderDateKey = candidateDateKey;
        break;
    }

    if (!notifyAt || !reminderDateKey) return null;

    const signature = [
        reminderDateKey,
        state.selectedClass || '',
        state.selectedBatch || '',
        getDailyReminderTime(state),
    ].join('::');

    return {
        dateKey: reminderDateKey,
        notifyAt,
        time: getDailyReminderTime(state),
        signature,
    };
}

async function showDailyNotification(reminder) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
        body: 'Your timetable is ready for today. Check your classes before the day starts.',
        tag: `orario-daily-reminder-${reminder.dateKey}`,
        renotify: false,
        requireInteraction: false,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: '/?view=timetable', dateKey: reminder.dateKey },
    };

    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.showNotification) {
            await registration.showNotification('Today\'s Timetable', options);
            return;
        }
    }

    const notification = new Notification('Today\'s Timetable', options);
    notification.onclick = () => {
        window.focus();
        window.history.replaceState(null, '', '/?view=timetable');
        window.dispatchEvent(new CustomEvent('orario-open-timetable'));
        notification.close();
    };
}

export function scheduleDailyReminder(state) {
    cancelDailyReminder();

    const reminder = calculateDailyReminder(state);
    if (!reminder) return null;

    const reminderLog = readDailyReminderLog();
    if (reminderLog[reminder.dateKey] === reminder.signature) return null;

    const msUntilNotification = reminder.notifyAt.getTime() - Date.now();
    scheduledDailySignature = reminder.signature;

    scheduledDailyTimeoutId = window.setTimeout(async () => {
        const latestReminder = calculateDailyReminder(state);
        if (!latestReminder || latestReminder.signature !== scheduledDailySignature) return;

        await showDailyNotification(latestReminder);
        const latestLog = readDailyReminderLog();
        latestLog[latestReminder.dateKey] = latestReminder.signature;
        writeDailyReminderLog(latestLog);
        cancelDailyReminder();
    }, msUntilNotification);

    return reminder;
}

export { DEFAULT_DAILY_REMINDER_TIME };
