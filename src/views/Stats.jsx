import React, { useContext } from 'react';
import { AppContext } from '../App';
import { Donut, Calendar, Upload, FileQuestion } from 'lucide-react';

export default function Stats({ onNavigate }) {
  const { state } = useContext(AppContext);

  const getStatistics = () => {
    const attendance = state.attendance || {};
    const timetable = state.timetableSchedule || {};
    const mappings = state.selectedClass && state.subjectMappings?.[state.selectedClass]
      ? state.subjectMappings[state.selectedClass] : {};
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/II/g, '2');

    const lectureMatches = (l) => {
      if (!l) return false;
      const myClass = (state.selectedClass || '').toUpperCase();
      if (!myClass) return true; // no class filter if not set
      const normalize = (s) => (s || '').replace(/I/g, '1').toUpperCase();
      const lClass = (l.className || '').toUpperCase();
      if (lClass && lClass !== myClass && normalize(lClass) !== normalize(myClass)) return false;
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

    let totalLectures = 0;
    let presentLectures = 0;
    let daysWithMajority = 0;
    const subjects = {}; // { label: { present, total, teacher } }

    Object.entries(attendance).forEach(([date, dayMap]) => {
      if (holidays.includes(date)) return;
      if (!dayMap || typeof dayMap !== 'object') return;

      // Derive day from date
      const dateObj = new Date(date + 'T12:00:00');
      const dayKey = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      const dayLectures = timetable[dayKey] || [];

      let dayTotal = 0;
      let dayPresent = 0;

      Object.entries(dayMap).forEach(([id, status]) => {
        // ── Resolve lecture from key ─────────────────────────────────────────
        let lecture = null;

        // Strategy 1 — new key format "TIME_NAME_ORIGIDX"
        //   e.g. "9:00 AM_Mathematics_3"
        const lastUnder = id.lastIndexOf('_');
        const firstUnder = id.indexOf('_');

        if (lastUnder !== -1) {
          const idx = parseInt(id.slice(lastUnder + 1), 10);
          if (!isNaN(idx) && dayLectures[idx]) {
            lecture = dayLectures[idx];
          }
          // Strategy 2 — extract name from key and search by name
          if (!lecture && firstUnder !== -1 && firstUnder !== lastUnder) {
            const nameFromKey = id.slice(firstUnder + 1, lastUnder);
            lecture = dayLectures.find(l => l.name === nameFromKey) || null;
          }
        }

        // Strategy 3 — old key format "DATE-DAYKEY-INDEX"
        if (!lecture && id.includes('-')) {
          const parts = id.split('-');
          const idx = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(idx) && dayLectures[idx]) {
            lecture = dayLectures[idx];
          }
        }

        // ── Extract subject label ────────────────────────────────────────────
        let subLabel = null;
        let teacher = '';

        if (lecture && lectureMatches(lecture)) {
          const fullName = lecture.name.toUpperCase();
          const isLab = fullName.includes('LAB') || fullName.includes('PRACTICAL') || fullName.includes('PRAC');
          const base = fullName.split('(')[0].split('-')[0].trim();
          const search = clean(base);

          const matchedSub = Object.keys(mappings).find(s => {
            const t = clean(s);
            return search.startsWith(t) || t.startsWith(search);
          });

          subLabel = `${matchedSub || base} (${isLab ? 'Lab' : 'Theory'})`;
          teacher = matchedSub ? (mappings[matchedSub] || '') : '';

        } else if (!lecture && lastUnder !== -1 && firstUnder !== -1 && firstUnder !== lastUnder) {
          // No timetable match — still count using name embedded in the key
          const nameFromKey = id.slice(firstUnder + 1, lastUnder);
          if (nameFromKey) {
            const fullName = nameFromKey.toUpperCase();
            const isLab = fullName.includes('LAB') || fullName.includes('PRACTICAL');
            const base = fullName.split('(')[0].split('-')[0].trim();
            const search = clean(base);
            const matchedSub = Object.keys(mappings).find(s => {
              const t = clean(s);
              return search.startsWith(t) || t.startsWith(search);
            });
            subLabel = `${matchedSub || base} (${isLab ? 'Lab' : 'Theory'})`;
            teacher = matchedSub ? (mappings[matchedSub] || '') : '';
          }
        }

        if (!subLabel) return; // couldn't resolve anything — skip

        if (!subjects[subLabel]) {
          subjects[subLabel] = { present: 0, total: 0, teacher };
        }

        subjects[subLabel].total++;
        totalLectures++;
        dayTotal++;

        if (status === 'present') {
          subjects[subLabel].present++;
          presentLectures++;
          dayPresent++;
        }
      });

      if (dayTotal > 0 && (dayPresent / dayTotal) >= 0.5) daysWithMajority++;
    });

    return {
      overallPct: totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : 0,
      totalDaysAttended: daysWithMajority,
      subjects,
    };
  };

  const stats = getStatistics();
  const subjects = Object.entries(stats.subjects);
  const hasAlloc = state.selectedClass && state.subjectMappings?.[state.selectedClass]
    && Object.keys(state.subjectMappings[state.selectedClass]).length > 0;

  const pctColor = stats.overallPct >= 75
    ? 'var(--color-secondary)'
    : stats.overallPct >= 50
      ? 'var(--color-secondary-container)'
      : 'var(--color-error)';

  return (
    <div className="flex flex-col w-9/10 mx-auto gap-6">
      <h2 className="text-headline-lg-mobile w-9/10 mx-auto text-on-surface font-header">Statistics Overview</h2>

      {/* Top stat cards */}
      <section className="grid grid-cols-2 gap-gutter">
        <article className="voxel-card p-5 flex flex-col w-9/10 mx-auto justify-between aspect-square relative">
          <div className="w-10 h-10 bg-surface-container border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)]">
            <Calendar className="text-primary" size={20} />
          </div>
          <div className="mt-auto">
            <div className="text-display-lg text-on-surface font-bold mb-1">{stats.totalDaysAttended}</div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Days Attended</div>
          </div>
        </article>

        <article className="voxel-card p-5 flex flex-col w-9/10 mx-auto justify-between aspect-square relative">
          <div className="w-10 h-10 bg-surface-container border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)]">
            <Donut className="text-secondary" size={20} />
          </div>
          <div className="mt-auto">
            <div className="text-display-lg font-bold mb-1" style={{ color: pctColor }}>{stats.overallPct}%</div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Overall %</div>
          </div>
        </article>
      </section>

      {/* Subject-wise */}
      <section>
        <div className="flex items-center justify-between mb-4 pl-1">
          <h3 className="text-body-md w-9/10 mx-auto font-bold text-on-surface gap-6">Subject-wise Attendance</h3>
          {!hasAlloc && subjects.length > 0 && (
            <span className="text-label-sm text-on-surface-variant font-bold border border-outline px-2 py-0.5">
              No teacher data
            </span>
          )}
        </div>

        {subjects.length === 0 ? (
          <div className="voxel-card p-8 text-center flex flex-col w-9/10 mx-auto items-center justify-center min-h-[280px]">
            <div className="w-16 h-16 bg-surface-container border-2 border-outline flex items-center justify-center mb-6 shadow-[2px_2px_0px_var(--color-outline)]">
              <FileQuestion className="text-on-surface-variant" size={32} />
            </div>
            <p className="text-body-md text-on-surface font-bold mb-2">No attendance data yet</p>
            <p className="text-body-md text-on-surface-variant mb-6 max-w-xs">
              Mark attendance on the Dashboard to see subject-wise stats here.
            </p>
            {!hasAlloc && (
              <p className="text-label-sm text-on-surface-variant mb-6">
                Upload a <span className="font-bold text-on-surface">Divisionallocation</span> sheet in Settings to also see teacher names.
              </p>
            )}
            <button
              className="voxel-btn-primary flex items-center gap-2"
              onClick={() => onNavigate?.('settings')}
            >
              <Upload size={18} />
              Go to Settings
            </button>
          </div>
        ) : (
          <div className="voxel-card w-9/10 mx-auto p-6 flex flex-col gap-5">
            {subjects
              .sort(([, a], [, b]) => (a.present / (a.total || 1)) - (b.present / (b.total || 1)))
              .map(([name, data], i) => {
                const subPct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
                const barColor = subPct >= 75
                  ? 'var(--color-secondary)'
                  : subPct >= 50
                    ? 'var(--color-secondary-container)'
                    : 'var(--color-error)';

                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <span className="text-body-md font-bold text-on-surface block truncate">{name}</span>
                        {data.teacher && (
                          <span className="text-label-sm text-on-surface-variant font-medium block mt-0.5">{data.teacher}</span>
                        )}
                      </div>
                      <span className="text-body-md font-bold shrink-0 ml-3" style={{ color: barColor }}>{subPct}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-4 bg-surface-container-lowest border-2 border-outline shadow-[1px_1px_0px_var(--color-outline)]">
                      <div
                        className="h-full border-r-2 border-outline"
                        style={{ width: `${subPct}%`, backgroundColor: barColor, transition: 'width 500ms ease' }}
                      />
                    </div>

                    <div className="flex justify-between">
                      <span className="text-label-sm text-on-surface-variant font-bold">{data.present} / {data.total} lectures</span>
                      {subPct < 75 && (
                        <span className="text-label-sm font-bold" style={{ color: barColor }}>
                          {subPct < 75 && data.total > 0
                            ? `Need ${Math.ceil((0.75 * data.total - data.present) / 0.25)} more`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
