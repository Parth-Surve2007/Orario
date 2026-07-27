import { getLocalDateKey, parseLectureTime } from '../utils/geofence';
import { lectureMatchesSelection } from '../utils/lectureMatching';

const REVIEW_REMINDER_STORAGE_KEY = 'orario_review_attendance_reminders';
const DAILY_REMINDER_STORAGE_KEY = 'orario_daily_reminders';
const REVIEW_REMINDER_URL = '/?view=dashboard&focus=attendanceReview';
const DEFAULT_REVIEW_DELAY_MINUTES = 30;
const DEFAULT_DAILY_REMINDER_TIME = '08:20';

let scheduledTimeoutId = null;
let scheduledSignature = '';
let scheduledDailyTimeoutId = null;
let scheduledDailySignature = '';

function readReminderLog() {
    try {
        const parsed = JSON.parse(localStorage.getItem(REVIEW_REMINDER_STORAGE_KEY) || '{}');
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
        return {};
    }
}

function writeReminderLog(log) {
    localStorage.setItem(REVIEW_REMINDER_STORAGE_KEY, JSON.stringify(log));
}

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
    const lectures = ((state.timetableSchedule && state.timetableSchedule[dayKey]) || [])
        .map((lecture, originalIdx) => ({ ...lecture, _origIdx: originalIdx }))
        .filter((lecture) => lectureMatchesSelection(lecture, state.selectedClass, state.selectedBatch));

    return { dayKey, lectures };
}

function getReminderDelayMinutes(state) {
    const value = Number(state.smartAttendance?.reviewReminderDelayMinutes);
    return Number.isFinite(value) ? value : DEFAULT_REVIEW_DELAY_MINUTES;
}

function getScheduleSignature(state, date = new Date()) {
    const { dayKey, lectures } = getTodaysLectures(state, date);
    const lectureSignature = lectures
        .map((lecture) => `${lecture._origIdx}:${lecture.time}:${lecture.name}:${lecture.className}`)
        .join('|');
    return [
        getLocalDateKey(date),
        dayKey,
        state.selectedClass || '',
        state.selectedBatch || '',
        getReminderDelayMinutes(state),
        lectureSignature,
    ].join('::');
}

export function cancelReviewReminder() {
    if (scheduledTimeoutId !== null) {
        window.clearTimeout(scheduledTimeoutId);
    }
    scheduledTimeoutId = null;
    scheduledSignature = '';
}

export function cancelDailyReminder() {
    if (scheduledDailyTimeoutId !== null) {
        window.clearTimeout(scheduledDailyTimeoutId);
    }
    scheduledDailyTimeoutId = null;
    scheduledDailySignature = '';
}

export function calculateReviewReminder(state, date = new Date()) {
    const todayKey = getLocalDateKey(date);
    const smartAttendance = state.smartAttendance || {};
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    if (!smartAttendance.enabled || !smartAttendance.reviewReminderEnabled) return null;
    if (holidays.includes(todayKey)) return null;

    const { lectures } = getTodaysLectures(state, date);
    if (lectures.length === 0) return null;

    const lectureTimes = lectures
        .map((lecture) => ({ lecture, times: parseLectureTime(lecture.time) }))
        .filter(({ times }) => times?.end instanceof Date && !Number.isNaN(times.end.getTime()));

    if (lectureTimes.length === 0) return null;

    const finalLecture = lectureTimes.reduce((latest, current) => (
        current.times.end.getTime() > latest.times.end.getTime() ? current : latest
    ));
    const delayMinutes = getReminderDelayMinutes(state);
    const notifyAt = new Date(finalLecture.times.end.getTime() + delayMinutes * 60 * 1000);

    // If the review time has already passed, avoid waking the app later with a stale reminder.
    if (notifyAt.getTime() <= date.getTime()) return null;

    return {
        dateKey: todayKey,
        delayMinutes,
        finalLecture: finalLecture.lecture,
        finalLectureEndsAt: finalLecture.times.end,
        notifyAt,
        signature: getScheduleSignature(state, date),
    };
}

async function showReviewNotification(reminder) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
        body: "You've reached the end of today's schedule.\n\nPlease review today's attendance to make sure every lecture has been recorded correctly.",
        tag: `orario-review-attendance-${reminder.dateKey}`,
        renotify: false,
        requireInteraction: true,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: REVIEW_REMINDER_URL, dateKey: reminder.dateKey },
    };

    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.showNotification) {
            await registration.showNotification('Review Attendance', options);
            return;
        }
    }

    const notification = new Notification('Review Attendance', options);
    notification.onclick = () => {
        window.focus();
        window.history.replaceState(null, '', REVIEW_REMINDER_URL);
        window.dispatchEvent(new CustomEvent('orario-review-attendance-open'));
        notification.close();
    };
}

export function scheduleReviewReminder(state) {
    cancelReviewReminder();

    const reminder = calculateReviewReminder(state);
    if (!reminder) return null;

    const reminderLog = readReminderLog();
    if (reminderLog[reminder.dateKey] === reminder.signature) return null;

    const msUntilNotification = reminder.notifyAt.getTime() - Date.now();
    scheduledSignature = reminder.signature;

    // Web/PWA notification scheduling is local to the running app process. The service owns
    // this single timeout so UI components never duplicate scheduling logic.
    scheduledTimeoutId = window.setTimeout(async () => {
        const latestReminder = calculateReviewReminder(state);
        if (!latestReminder || latestReminder.signature !== scheduledSignature) return;

        await showReviewNotification(latestReminder);
        const latestLog = readReminderLog();
        latestLog[latestReminder.dateKey] = latestReminder.signature;
        writeReminderLog(latestLog);
        cancelReviewReminder();
    }, msUntilNotification);

    return reminder;
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

export const REVIEW_REMINDER_DELAYS = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
];

export { DEFAULT_REVIEW_DELAY_MINUTES, DEFAULT_DAILY_REMINDER_TIME, REVIEW_REMINDER_URL };
