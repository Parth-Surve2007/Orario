import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CalendarX } from 'lucide-react';
import { lectureMatchesSelection } from '../utils/lectureMatching';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_ABBR = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };

export default function Timetable({ onNavigate }) {
  const { state } = useContext(AppContext);

  const todayKey = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
  const defaultDay = DAYS.includes(todayKey) ? todayKey : 'MONDAY';

  const [selectedDay, setSelectedDay] = useState(
    state.currentTimetableDay && DAYS.includes(state.currentTimetableDay)
      ? state.currentTimetableDay
      : defaultDay
  );

  // ── helpers ───────────────────────────────────────
  const lectureMatches = (l) => {
    if (!l) return false;
    const myClass = (state.selectedClass || '').toUpperCase();
    const normalize = (s) => (s || '').replace(/I/g, '1').toUpperCase();
    const lClass = (l.className || '').toUpperCase();
    if (lClass !== myClass && normalize(lClass) !== normalize(myClass)) return false;
    if (state.selectedBatch) {
      const name = (l.name || '').toUpperCase();
      const matches = name.match(/\(([^)]+)\)/g);
      if (matches) {
        const hasBatchIndicator = matches.some(m => m.includes('(B') || m.includes(' B'));
        if (hasBatchIndicator) {
          const batchMatch = matches.some(m => m.includes(state.selectedBatch));
          if (!batchMatch) return false;
        }
      }
    }
    return true;
  };

  const getTeacher = (lectureName) => {
    const mappings = state.subjectMappings?.[state.selectedClass] || {};
    const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/II/g, '2');
    const search = clean(lectureName.split('(')[0].split('-')[0].trim());
    const key = Object.keys(mappings).find((s) => {
      const t = clean(s);
      return search.startsWith(t) || t.startsWith(search);
    });
    return mappings[key] || '';
  };

  // ── empty state ───────────────────────────────────
  if (!state.timetableSchedule) {
    return (
      <div className="flex-grow flex items-center justify-center pt-10">
        <div className="voxel-card p-8 max-w-md w-9/10 mx-auto flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-6 bg-surface-container border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)]">
            <CalendarX size={36} className="text-primary" />
          </div>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-3">No Timetable Uploaded</h2>
          <p className="text-body-md text-on-surface-variant mb-8 px-4">
            Upload your timetable Excel file in Settings to view your schedule.
          </p>
          <button
            className="voxel-btn-primary w-full flex items-center justify-center gap-2"
            onClick={() => onNavigate?.('settings')}
          >
            <Upload size={18} /> Go to Settings
          </button>
        </div>
      </div>
    );
  }

  const lectures = (state.timetableSchedule[selectedDay] || [])
    .filter((lecture) => lectureMatchesSelection(lecture, state.selectedClass, state.selectedBatch));

  return (
    <div className="flex flex-col w-9/10 mx-auto gap-4 w-full">

      {/* Day chip strip */}
      <div className="flex gap-2 w-94/100 mx-auto overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {DAYS.map((day) => {
          const isActive = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`relative px-4 py-2 border-2 border-outline font-bold tracking-wide shrink-0 transition-all duration-150 cursor-pointer
                ${isActive ? 'text-on-primary' : 'text-on-surface bg-surface-container-low/60 hover:bg-surface-container shadow-[2px_2px_0px_var(--color-outline)]'}`}
            >
              {isActive && (
                <motion.span
                  layoutId="dayTab"
                  className="absolute inset-0 bg-primary border-2 border-outline z-[-1] shadow-[2px_2px_0px_var(--color-outline)]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              {DAY_ABBR[day]}
            </button>
          );
        })}
      </div>

      {/* Day panel */}
      <AnimatePresence mode="wait">
        <motion.section
          key={selectedDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="voxel-card p-6 mx-auto md:p-12 w-9/10 h-fit flex flex-col items-center gap-4"
        >
          <div>
            <h3 className="text-headline-lg-mobile text-on-surface font-header">
              {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()}
            </h3>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mt-0.5">
              {state.selectedClass || 'No class selected'}
              {state.selectedBatch ? ` · ${state.selectedBatch}` : ''}
            </p>
          </div>

          {lectures.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center opacity-80">
              <CalendarX size={36} className="text-on-surface-variant mb-3 animate-pulse" />
              <p className="text-body-md text-on-surface-variant">No lectures scheduled.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full px-1 sm:px-2">
              {lectures.map((l, i) => {
                const teacher = getTeacher(l.name);
                return (
                  <motion.div
                    key={`${l.time}-${l.name}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className="w-full bg-surface-container-lowest border-2 border-outline p-4 shadow-[2px_2px_0px_var(--color-outline)] flex items-start gap-4"
                  >
                    <div className="w-2 h-10 bg-secondary shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-body-md font-medium text-on-surface leading-5 whitespace-normal break-words">{l.name}</div>
                      {teacher && (
                        <div className="text-label-sm text-on-surface-variant font-medium mt-1 leading-4 whitespace-normal break-words">{teacher}</div>
                      )}
                      <div className="text-label-sm text-secondary uppercase tracking-wider font-bold mt-1">{l.time}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
