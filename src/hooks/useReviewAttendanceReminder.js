import { useEffect } from 'react';
import { cancelReviewReminder, scheduleReviewReminder } from '../services/ReminderService';

export function useReviewAttendanceReminder(state) {
    useEffect(() => {
        const hasNotificationAccess = 'Notification' in window && Notification.permission === 'granted';

        if (!state.smartAttendance?.enabled || !state.smartAttendance?.reviewReminderEnabled || !hasNotificationAccess) {
            cancelReviewReminder();
            return undefined;
        }

        scheduleReviewReminder(state);
        return () => cancelReviewReminder();
    }, [
        state.smartAttendance?.enabled,
        state.smartAttendance?.reviewReminderEnabled,
        state.smartAttendance?.reviewReminderDelayMinutes,
        state.timetableSchedule,
        state.selectedClass,
        state.selectedBatch,
        state.holidays,
    ]);
}
