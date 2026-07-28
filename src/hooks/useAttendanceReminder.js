import { useEffect, useRef, useState } from 'react';

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

  const getLocalDateKey = () => new Date().toISOString().split('T')[0];

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
    const todayKey = getLocalDateKey();
    const dayKey = getDayKey();
    const now = new Date();
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    // Don't remind on holidays
    if (holidays.includes(todayKey)) return [];

    // Don't remind if feature is disabled
    if (!state.attendanceReminder?.enabled) return [];

    // Get today's lectures
    const lectures = ((state.timetableSchedule && state.timetableSchedule[dayKey]) || [])
      .map((lecture, originalIdx) => ({ ...lecture, _origIdx: originalIdx }))
      .filter((lecture) => {
        if (!state.selectedClass) return false;
        if (lecture.className && lecture.className !== state.selectedClass) return false;
        if (state.selectedBatch && lecture.batch && lecture.batch !== state.selectedBatch) return false;
        return true;
      });

    if (lectures.length === 0) return [];

    // Get today's attendance
    const dayAttendance = state.attendance?.[todayKey] || {};

    // Check for lectures that have started (after grace period) but not marked
    const pending = lectures.filter(lecture => {
      const times = parseLectureTime(lecture.time);
      if (!times) return false;

      // Lecture has started and grace period has passed
      const gracePeriodEnd = new Date(times.start.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
      if (now >= gracePeriodEnd) {
        // Attendance not marked
        const lectureKey = `${lecture.time}_${lecture.name}_${lecture._origIdx}`;
        if (!dayAttendance[lectureKey]) {
          return true;
        }
      }

      return false;
    }).map(lecture => {
      const times = parseLectureTime(lecture.time);
      return {
        ...lecture,
        formattedTime: times ? formatTime(times.start) : ''
      };
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
    // Check on mount
    const pending = checkPendingAttendance();
    if (pending.length > 0) {
      setPendingLectures(pending);
      setShowReminder(true);
      hasRemindedThisSession.current = true;
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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

  return {
    showReminder,
    pendingLectures,
    dismissReminder,
    goToDashboard,
  };
}

