import { useEffect } from 'react';
import { cancelDailyReminder, scheduleDailyReminder } from '../services/ReminderService';

export function useDailyReminder(state) {
    useEffect(() => {
        const hasNotificationAccess = 'Notification' in window && Notification.permission === 'granted';

        if (!state.dailyReminder?.enabled || !hasNotificationAccess) {
            cancelDailyReminder();
            return undefined;
        }

        scheduleDailyReminder(state);
        return () => cancelDailyReminder();
    }, [
        state.dailyReminder?.enabled,
        state.dailyReminder?.time,
        state.selectedClass,
        state.selectedBatch,
        state.selectedPceBatch,
        state.holidays,
    ]);
}
