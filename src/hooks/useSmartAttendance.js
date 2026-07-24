import { useEffect, useRef } from 'react';
import { getCurrentLocation, isInsideCampus, parseLectureTime } from '../utils/geofence';

export function useSmartAttendance(state, updateState) {
    
    // We use a ref to prevent stale closures inside the interval
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        const checkInterval = setInterval(async () => {
            const currentState = stateRef.current;
            if (!currentState?.smartAttendance?.enabled) return;
            
            const todayStr = new Date().toISOString().split('T')[0];
            const holidays = Array.isArray(currentState.holidays) ? currentState.holidays : [];
            if (holidays.includes(todayStr)) return; // Holiday, no checks

            const dateObj = new Date();
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            const dayKey = dayName.toUpperCase();
            
            const allDayLectures = (currentState.timetableSchedule && currentState.timetableSchedule[dayKey]) || [];
            
            const lectureMatches = (l) => {
                if (!l) return false;
                const myClass = (currentState.selectedClass || '').toUpperCase();
                const normalize = (s) => (s || '').replace(/I/g, '1').toUpperCase();
                const myClassNorm = normalize(myClass);
                const lClass = (l.className || '').toUpperCase();
                if (lClass !== myClass && normalize(lClass) !== myClassNorm) return false;
                if (currentState.selectedBatch) {
                    const name = (l.name || '').toUpperCase();
                    const matches = name.match(/\(([^)]+)\)/g);
                    if (matches) {
                        const hasBatchIndicator = matches.some(m => m.includes('(B') || m.includes(' B'));
                        if (hasBatchIndicator) {
                            const batchMatch = matches.some(m => m.includes(currentState.selectedBatch));
                            if (!batchMatch) return false;
                        }
                    }
                }
                return true;
            };

            const lectures = allDayLectures
                .map((l, originalIdx) => ({ ...l, _origIdx: originalIdx }))
                .filter(l => lectureMatches(l));
                
            const getLectureKey = (l) => `${l.time}_${l.name}_${l._origIdx}`;
            
            let needsUpdate = false;
            let updatedChecks = { ...(currentState.smartAttendance.lastChecks || {}) };
            let updatedAttendance = { ...(currentState.attendance || {}) };
            let updatedDayAttendance = { ...(updatedAttendance[todayStr] || {}) };
            
            for (const l of lectures) {
                const times = parseLectureTime(l.time);
                if (!times) continue;
                
                const now = new Date();
                const nowTime = now.getTime();
                const startTime = times.start.getTime();
                const endTime = times.end.getTime();
                
                // 5 minutes in milliseconds
                const FIVE_MIN = 5 * 60 * 1000;
                
                const key = `${todayStr}_${getLectureKey(l)}`;
                const checks = updatedChecks[key] || { startChecked: false, endChecked: false, entryPassed: false, exitPassed: false };
                
                let checkedSomething = false;
                
                // Check Start
                if (!checks.startChecked && Math.abs(nowTime - startTime) <= FIVE_MIN) {
                    const loc = await getCurrentLocation();
                    checks.entryPassed = isInsideCampus(loc, currentState.smartAttendance.collegeLocation, currentState.smartAttendance.radius);
                    checks.startChecked = true;
                    checkedSomething = true;
                }
                
                // Check End
                if (!checks.endChecked && Math.abs(nowTime - endTime) <= FIVE_MIN) {
                    const loc = await getCurrentLocation();
                    checks.exitPassed = isInsideCampus(loc, currentState.smartAttendance.collegeLocation, currentState.smartAttendance.radius);
                    checks.endChecked = true;
                    checkedSomething = true;
                }
                
                if (checkedSomething) {
                    updatedChecks[key] = checks;
                    needsUpdate = true;
                    
                    // Decide attendance
                    if (checks.startChecked && checks.endChecked) {
                        const lectKey = getLectureKey(l);
                        // Do not overwrite manual markings (if already marked present or absent manually)
                        if (!updatedDayAttendance[lectKey]) {
                            if (checks.entryPassed && checks.exitPassed) {
                                updatedDayAttendance[lectKey] = 'present';
                            } else if (checks.entryPassed || checks.exitPassed) {
                                updatedDayAttendance[lectKey] = 'needs-review';
                            } else {
                                updatedDayAttendance[lectKey] = 'absent';
                            }
                        }
                    }
                }
            }
            
            if (needsUpdate) {
                updatedAttendance[todayStr] = updatedDayAttendance;
                updateState({
                    smartAttendance: { ...currentState.smartAttendance, lastChecks: updatedChecks },
                    attendance: updatedAttendance
                });
            }

        }, 60000); // Check every minute

        return () => clearInterval(checkInterval);
    }, [updateState]);
}
