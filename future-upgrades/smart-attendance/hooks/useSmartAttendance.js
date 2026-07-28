import { useEffect, useRef } from 'react';
import { getCurrentLocationWithConfidence, getLocalDateKey, isInsideCampus, parseLectureTime } from '../utils/geofence';
import { lectureMatchesSelection } from '../utils/lectureMatching';

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
            
            const todayStr = getLocalDateKey();
            const holidays = Array.isArray(currentState.holidays) ? currentState.holidays : [];
            if (holidays.includes(todayStr)) return; // Holiday, no checks

            const dateObj = new Date();
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            const dayKey = dayName.toUpperCase();
            
            const allDayLectures = (currentState.timetableSchedule && currentState.timetableSchedule[dayKey]) || [];
            
            const lectures = allDayLectures
                .map((l, originalIdx) => ({ ...l, _origIdx: originalIdx }))
                .filter(l => lectureMatchesSelection(l, currentState.selectedClass, currentState.selectedBatch));
                
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
                const checks = updatedChecks[key] || { 
                    startChecked: false, 
                    endChecked: false, 
                    entryPassed: false, 
                    exitPassed: false,
                    entryConfidence: 'NONE',
                    exitConfidence: 'NONE',
                    entryStatus: '',
                    exitStatus: ''
                };

                let checkedSomething = false;

                // Check Start
                if (!checks.startChecked && Math.abs(nowTime - startTime) <= FIVE_MIN) {
                    const result = await getCurrentLocationWithConfidence();
                    checks.entryPassed = result.location ? isInsideCampus(result.location, currentState.smartAttendance.collegeLocation, currentState.smartAttendance.radius) : false;
                    checks.entryConfidence = result.confidence;
                    checks.entryStatus = result.status;
                    checks.startChecked = true;
                    checkedSomething = true;
                }

                // Check End
                if (!checks.endChecked && Math.abs(nowTime - endTime) <= FIVE_MIN) {
                    const result = await getCurrentLocationWithConfidence();
                    checks.exitPassed = result.location ? isInsideCampus(result.location, currentState.smartAttendance.collegeLocation, currentState.smartAttendance.radius) : false;
                    checks.exitConfidence = result.confidence;
                    checks.exitStatus = result.status;
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
                            // Only mark present if both checks have HIGH or MEDIUM confidence
                            const entryHasConfidence = checks.entryConfidence === 'HIGH' || checks.entryConfidence === 'MEDIUM';
                            const exitHasConfidence = checks.exitConfidence === 'HIGH' || checks.exitConfidence === 'MEDIUM';

                            if (checks.entryPassed && checks.exitPassed && entryHasConfidence && exitHasConfidence) {
                                updatedDayAttendance[lectKey] = 'present';
                            } else if (checks.entryPassed && checks.exitPassed) {
                                // Inside campus but low confidence - needs review
                                updatedDayAttendance[lectKey] = 'needs-review';
                            } else if (checks.entryPassed || checks.exitPassed) {
                                // Mixed results - needs review
                                updatedDayAttendance[lectKey] = 'needs-review';
                            } else {
                                // Both outside - absent
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
