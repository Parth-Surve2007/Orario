import { useEffect, useRef } from 'react';
import { getLocalDateKey, parseLectureTime } from '../utils/geofence';
import { lectureMatchesSelection } from '../utils/lectureMatching';

const CHECK_INTERVAL_MS = 60 * 1000;
const DEFAULT_REMINDER_MINUTES = 10;

async function showLectureNotification(lecture, minutesBefore) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const title = minutesBefore > 0
        ? `Lecture in ${minutesBefore} min`
        : 'Lecture starting now';
    const body = `${lecture.time} - ${String(lecture.name || '').replace(/\s+/g, ' ').trim()}`;

    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.showNotification) {
            registration.showNotification(title, {
                body,
                tag: `orario-${getLocalDateKey()}-${lecture.time}-${lecture.name}`,
                renotify: false,
                icon: '/icons/icon-192.png',
            });
            return;
        }
    }

    new Notification(title, { body });
}

export function useLectureReminders(state, updateState) {
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const interval = window.setInterval(async () => {
            const currentState = stateRef.current;
            if (!currentState?.notificationsEnabled) return;
            if (!('Notification' in window) || Notification.permission !== 'granted') return;

            const reminderMinutes = Number.isFinite(Number(currentState.reminderMinutesBefore))
                ? Number(currentState.reminderMinutesBefore)
                : DEFAULT_REMINDER_MINUTES;
            const todayStr = getLocalDateKey();
            if ((currentState.holidays || []).includes(todayStr)) return;

            const dayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
            const lectures = ((currentState.timetableSchedule && currentState.timetableSchedule[dayKey]) || [])
                .map((lecture, originalIdx) => ({ ...lecture, _origIdx: originalIdx }))
                .filter((lecture) => lectureMatchesSelection(lecture, currentState.selectedClass, currentState.selectedBatch));

            const sent = { ...(currentState.reminderLastNotified || {}) };
            let changed = false;
            const now = Date.now();

            for (const lecture of lectures) {
                const times = parseLectureTime(lecture.time);
                if (!times) continue;

                const reminderAt = times.start.getTime() - reminderMinutes * 60 * 1000;
                const msUntilReminder = reminderAt - now;
                const key = `${todayStr}_${reminderMinutes}_${lecture.time}_${lecture.name}_${lecture._origIdx}`;
                if (sent[key] || msUntilReminder > 0 || msUntilReminder < -CHECK_INTERVAL_MS) continue;

                await showLectureNotification(lecture, reminderMinutes);
                sent[key] = Date.now();
                changed = true;
            }

            if (changed) {
                updateState({ reminderLastNotified: sent });
            }
        }, CHECK_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [updateState]);
}
