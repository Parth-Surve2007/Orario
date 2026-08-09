import { useEffect, useRef, useState } from 'react';
import { lectureMatchesSelection, getScheduleForDate } from '../utils/lectureMatching';
import { getLocalDateKey } from '../utils/dateUtils';

/**
 * Attendance Reminder Hook
 *
 * Checks for unmarked attendance when the app becomes visible/active.
 * Works entirely offline with no background execution required.
 */

const GRACE_PERIOD_MINUTES = 5;

export function useAttendanceReminder(state, updateState) {
  const [pendingLectures, setPendingLectures] = useState([]);
  const [showReminder, setShowReminder] = useState(false);
  const hasRemindedThisSession = useRef(false);

  // Keep a ref to the latest state so the visibilitychange handler is never stale
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const getDayKey = (date = new Date()) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  };

  const parseLectureTime = (timeStr) => {
    if (!timeStr) return null;
    const [start, end] = timeStr.split('-').map(t => t.trim());
    if (!start || !end) return null;

    const parseTime = (t) => {
      const [hours, minutes] = t.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    };

    const startDate = parseTime(start);
    const endDate = parseTime(end);
    if (!startDate || !endDate) return null;
    return { start: startDate, end: endDate };
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const checkPendingAttendance = () => {
    const currentState = stateRef.current; // always latest state — fixes stale closure bug
    const todayKey = getLocalDateKey();    // local timezone — fixes UTC midnight bug
    const dayKey = getDayKey();
    const now = new Date();
    const holidays = Array.isArray(currentState.holidays) ? currentState.holidays : [];

    if (holidays.includes(todayKey)) return [];
    if (!currentState.attendanceReminder?.enabled) return [];

    // Use versioned schedule so today's correct timetable is always used
    const todaySchedule = getScheduleForDate(todayKey, currentState);
    const lectures = ((todaySchedule && todaySchedule[dayKey]) || [])
      .map((lecture, originalIdx) => ({ ...lecture, _origIdx: originalIdx }))
      .filter((lecture) => lectureMatchesSelection(
        lecture,
        currentState.selectedClass,
        currentState.selectedBatch,
        currentState.selectedPceBatch,
      ));

    if (lectures.length === 0) return [];

    const dayAttendance = currentState.attendance?.[todayKey] || {};

    const pending = lectures.filter(lecture => {
      const times = parseLectureTime(lecture.time);
      if (!times) return false;
      const gracePeriodEnd = new Date(times.start.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
      if (now >= gracePeriodEnd) {
        const lectureKey = `${lecture.time}_${lecture.name}_${lecture._origIdx}`;
        if (!dayAttendance[lectureKey]) return true;
      }
      return false;
    }).map(lecture => {
      const times = parseLectureTime(lecture.time);
      return { ...lecture, formattedTime: times ? formatTime(times.start) : '' };
    });

    return pending;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !hasRemindedThisSession.current) {
      const pending = checkPendingAttendance();
      if (pending.length > 0) {
        setPendingLectures(pending);
        setShowReminder(true);
        hasRemindedThisSession.current = true;
      }
    }
  };

  useEffect(() => {
    const pending = checkPendingAttendance();
    if (pending.length > 0) {
      setPendingLectures(pending);
      setShowReminder(true);
      hasRemindedThisSession.current = true;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissReminder = () => {
    setShowReminder(false);
    setPendingLectures([]);
  };

  const goToDashboard = () => {
    setShowReminder(false);
    setPendingLectures([]);
  };

  return { showReminder, pendingLectures, dismissReminder, goToDashboard };
}
