import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { Hand, Upload, School, Donut, Check, X, Sun, CheckCheck, XSquare, CalendarOff, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

export default function Dashboard({ onNavigate }) {
    const { state, updateState } = useContext(AppContext);

    // Date navigation (today by default)
    const todayStr = new Date().toISOString().split('T')[0];
    const [viewDate, setViewDate] = useState(todayStr);

    const dateObj = new Date(viewDate + 'T12:00:00'); // noon to avoid TZ edge cases
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dayKey = dayName.toUpperCase();
    const displayDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const prevDay = () => {
        const d = new Date(viewDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        setViewDate(d.toISOString().split('T')[0]);
    };
    const nextDay = () => {
        const d = new Date(viewDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        setViewDate(d.toISOString().split('T')[0]);
    };
    const goToday = () => setViewDate(todayStr);

    // ── If no class selected ──────────────────────────────────────────────────
    if (!state.selectedClass) {
        return (
            <div className="flex flex-col items-center justify-center pt-10">
                <div className="voxel-card p-8 md:p-12 w-4/5 h-fit max-w-2xl text-center flex flex-col items-center gap-6">
                    <div className="w-16 h-16 bg-surface-container border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)]">
                        <Hand size={36} className="text-secondary animate-bounce" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <h2 className="text-headline-lg-mobile md:text-headline-lg text-on-surface font-header">Welcome to Orario</h2>
                        <p className="text-body-md text-on-surface-variant max-w-md mx-auto">Please upload your timetable and select your class to get started.</p>
                    </div>
                    <button className="voxel-btn-primary flex items-center gap-2" onClick={() => onNavigate?.('settings')}>
                        <Upload size={18} />
                        Setup Now
                    </button>
                </div>
            </div>
        );
    }

    // ── Attendance data ───────────────────────────────────────────────────────
    const attendance = state.attendance || {};
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];
    const isHoliday = holidays.includes(viewDate);

    const dayAttendance = attendance[viewDate] || {};

    // Overall stats
    let total = 0, present = 0;
    Object.values(attendance).forEach(day => {
        Object.values(day).forEach(status => {
            total++;
            if (status === 'present') present++;
        });
    });
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    const pctColor = pct >= 75 ? 'var(--color-secondary)' : (pct >= 50 ? 'var(--color-secondary-container)' : 'var(--color-error)');

    // Today's lectures
    const lectureMatches = (l) => {
        if (!l) return false;
        const myClass = (state.selectedClass || '').toUpperCase();
        const normalize = (s) => (s || '').replace(/I/g, '1').toUpperCase();
        const myClassNorm = normalize(myClass);
        const lClass = (l.className || '').toUpperCase();
        if (lClass !== myClass && normalize(lClass) !== myClassNorm) return false;
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

    // Keep full unfiltered list so original indices are stable for Stats lookups
    const allDayLectures = (state.timetableSchedule && state.timetableSchedule[dayKey]) || [];
    const lectures = allDayLectures
        .map((l, originalIdx) => ({ ...l, _origIdx: originalIdx }))
        .filter(l => lectureMatches(l));

    // ── Attendance helpers ────────────────────────────────────────────────────
    // Key uses ORIGINAL unfiltered index so Stats.jsx can look up dayLectures[index] correctly
    const getLectureKey = (l) => `${l.time}_${l.name}_${l._origIdx}`;

    const setLectureStatus = (l, status) => {
        const key = getLectureKey(l);
        const newDay = { ...dayAttendance, [key]: status };
        updateState({ attendance: { ...attendance, [viewDate]: newDay } });
    };

    const markAllPresent = () => {
        const newDay = {};
        lectures.forEach(l => { newDay[getLectureKey(l)] = 'present'; });
        updateState({ attendance: { ...attendance, [viewDate]: newDay } });
    };

    const markAllAbsent = () => {
        const newDay = {};
        lectures.forEach(l => { newDay[getLectureKey(l)] = 'absent'; });
        updateState({ attendance: { ...attendance, [viewDate]: newDay } });
    };

    const toggleHoliday = () => {
        if (isHoliday) {
            updateState({ holidays: holidays.filter(d => d !== viewDate) });
        } else {
            updateState({ holidays: [...holidays, viewDate] });
        }
    };

    // Count today's present/absent
    const todayPresent = lectures.filter(l => dayAttendance[getLectureKey(l)] === 'present').length;
    const todayAbsent = lectures.filter(l => dayAttendance[getLectureKey(l)] === 'absent').length;

    const statCardClass = "voxel-card p-6 min-h-[224px] sm:min-h-[240px] h-full flex flex-col relative";
    const statIconClass = "w-12 h-12 bg-surface-container border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0";
    const statBodyClass = "mt-auto flex flex-col gap-3 items-start pt-8";
    const statValueClass = "text-display-lg font-bold leading-none tabular-nums";
    const statTitleClass = "text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold leading-5";

    return (
        <div className="flex flex-col gap-4 w-full">

            {/* Stat Cards */}
            <div className="grid grid-cols-2 items-stretch gap-5 w-[92%] max-w-full mx-auto sm:gap-6">
                <article className={statCardClass}>
                    <div className={statIconClass}>
                        <Donut className="text-primary" size={20} />
                    </div>
                    <div className={statBodyClass}>
                        <div className={statValueClass} style={{ color: pctColor }}>{pct}%</div>
                        <div className={statTitleClass}>Overall Attendance</div>
                    </div>
                </article>

                <article className={statCardClass}>
                    <div className={statIconClass}>
                        <School className="text-secondary" size={20} />
                    </div>
                    <div className={statBodyClass}>
                        <div className={`${statValueClass} text-on-surface`}>{lectures.length}</div>
                        <div className={statTitleClass}>Lectures Today</div>
                    </div>
                </article>
            </div>

            {/* Smart Attendance Status */}
            {state.smartAttendance?.enabled && (
                <div className="voxel-card w-[92%] max-w-full mx-auto p-4 flex items-center gap-3 bg-surface-container-highest border-primary">
                    <div className="w-10 h-10 bg-surface-container border-2 border-outline flex items-center justify-center shrink-0">
                        <MapPin size={20} className="text-primary" />
                    </div>
                    <div>
                        <h4 className="text-label-sm font-bold text-on-surface uppercase tracking-wider">Smart Attendance Active</h4>
                        <p className="text-xs text-on-surface-variant">Checking location at scheduled lecture times.</p>
                    </div>
                </div>
            )}

            {/* Day Attendance Panel */}
            <section className="voxel-card w-[92%] max-w-full mx-auto p-5 flex flex-col gap-4">

                {/* Date Nav Header */}
                <div className="flex items-center justify-between">
                    <button onClick={prevDay} className="voxel-btn-secondary p-2">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="text-center flex-1 mx-2">
                        <h3 className="text-headline-lg-mobile font-header text-on-surface">{dayName}</h3>
                        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{displayDate}</p>
                    </div>
                    <button onClick={nextDay} className="voxel-btn-secondary p-2">
                        <ChevronRight size={18} />
                    </button>
                </div>

                {viewDate !== todayStr && (
                    <button onClick={goToday} className="text-label-sm text-center text-secondary font-bold uppercase tracking-wider underline underline-offset-2">
                        Back to Today
                    </button>
                )}

                {/* Holiday status banner */}
                {isHoliday && (
                    <div className="bg-surface-container-highest border-2 border-outline p-3 text-center">
                        <span className="text-label-sm font-black uppercase tracking-widest text-on-surface flex items-center justify-center gap-2">
                            <Sun size={14} /> Holiday / No Classes
                        </span>
                    </div>
                )}

                {/* Bulk Actions */}
                {!isHoliday && lectures.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={markAllPresent}
                            className="flex items-center gap-1.5 px-3 py-2 border-2 border-outline bg-surface-container font-bold text-label-sm uppercase tracking-wider shadow-[3px_3px_0px_var(--color-outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-surface-container-highest transition-all"
                        >
                            <CheckCheck size={14} /> All Present
                        </button>
                        <button
                            onClick={markAllAbsent}
                            className="flex items-center gap-1.5 px-3 py-2 border-2 border-outline bg-surface-container font-bold text-label-sm uppercase tracking-wider shadow-[3px_3px_0px_var(--color-outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-surface-container-highest transition-all"
                        >
                            <XSquare size={14} /> All Absent
                        </button>
                        <button
                            onClick={toggleHoliday}
                            className="flex items-center gap-1.5 px-3 py-2 border-2 border-outline bg-surface-container font-bold text-label-sm uppercase tracking-wider shadow-[3px_3px_0px_var(--color-outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-surface-container-highest transition-all"
                        >
                            <CalendarOff size={14} /> Holiday
                        </button>
                    </div>
                )}

                {/* Remove Holiday button if set */}
                {isHoliday && (
                    <button
                        onClick={toggleHoliday}
                        className="flex items-center justify-center gap-1.5 w-full px-3 py-2 border-2 border-outline bg-surface-container font-bold text-label-sm uppercase tracking-wider shadow-[3px_3px_0px_var(--color-outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-surface-container-highest transition-all"
                    >
                        <CalendarOff size={14} /> Remove Holiday
                    </button>
                )}

                {/* Today's summary mini stats */}
                {!isHoliday && lectures.length > 0 && (todayPresent > 0 || todayAbsent > 0) && (
                    <div className="flex gap-3 text-label-sm font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Check size={12} className="text-secondary" /> {todayPresent} Present</span>
                        <span className="flex items-center gap-1"><X size={12} className="text-error" /> {todayAbsent} Absent</span>
                        <span className="text-on-surface-variant">{lectures.length - todayPresent - todayAbsent} Unmarked</span>
                    </div>
                )}

                {/* Lecture list with P/A buttons */}
                {!isHoliday && lectures.length === 0 && (
                    <div className="text-center py-8 flex flex-col items-center opacity-80">
                        <div className="w-14 h-14 bg-surface-container border-2 border-outline flex items-center justify-center mb-4">
                            <School className="text-on-surface-variant" size={24} />
                        </div>
                        <p className="text-body-md text-on-surface-variant">No lectures scheduled.</p>
                    </div>
                )}

                {!isHoliday && lectures.length > 0 && (
                    <div className="flex flex-col gap-3 w-full px-1 sm:px-2">
                        {lectures.map((l) => {
                            const key = getLectureKey(l);
                            const status = dayAttendance[key];
                            return (
                                <div
                                    key={l._origIdx}
                                    className={`w-full border-2 border-outline p-4 shadow-[2px_2px_0px_var(--color-outline)] flex items-center gap-3 transition-all
                                        ${status === 'present' ? 'bg-[#d4f7e0]' : status === 'absent' ? 'bg-[#fde8e8]' : status === 'needs-review' ? 'bg-[#fdf0d5]' : 'bg-surface-container-lowest'}`}
                                >
                                    {/* Colour stripe */}
                                    <div className={`w-2 h-10 shrink-0 border border-outline
                                        ${status === 'present' ? 'bg-secondary' : status === 'absent' ? 'bg-error' : status === 'needs-review' ? 'bg-[#f59e0b]' : 'bg-surface-container'}`} />

                                    {/* Lecture info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="text-label-sm text-secondary uppercase tracking-wider font-bold mb-0.5">{l.time}</div>
                                            {status === 'needs-review' && (
                                                <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] border border-[#f59e0b] px-1 rounded-sm uppercase tracking-wider">Needs Review</span>
                                            )}
                                        </div>
                                        <div className="text-body-md font-medium text-on-surface truncate">{l.name}</div>
                                    </div>

                                    {/* P / A buttons */}
                                    <div className="flex gap-1.5 shrink-0">
                                        <button
                                            onClick={() => setLectureStatus(l, 'present')}
                                            className={`w-9 h-9 border-2 border-outline flex items-center justify-center font-black text-label-sm transition-all
                                                shadow-[2px_2px_0px_var(--color-outline)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none
                                                ${status === 'present' ? 'bg-secondary text-on-secondary' : 'bg-surface-container hover:bg-secondary/20'}`}
                                            title="Mark Present"
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button
                                            onClick={() => setLectureStatus(l, 'absent')}
                                            className={`w-9 h-9 border-2 border-outline flex items-center justify-center font-black text-label-sm transition-all
                                                shadow-[2px_2px_0px_var(--color-outline)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none
                                                ${status === 'absent' ? 'bg-error text-on-primary' : 'bg-surface-container hover:bg-error/20'}`}
                                            title="Mark Absent"
                                        >
                                            <X size={14} />
                                        </button>
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
