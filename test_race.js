import fs from 'fs';

let state = { attendance: {} };
function setState(cb) {
    state = cb(state);
}
function updateState(updates) {
    setState(prev => ({ ...prev, ...updates }));
}

// Simulate Dashboard render
const attendance = state.attendance || {};
const viewDate = '2026-08-10';
const dayAttendance = attendance[viewDate] || {};

const setLectureStatus = (key, status) => {
    const newDay = { ...dayAttendance, [key]: status };
    updateState({ attendance: { ...attendance, [viewDate]: newDay } });
};

setLectureStatus('L1', 'present');
setLectureStatus('L2', 'present');
setLectureStatus('L3', 'present');

console.log(JSON.stringify(state, null, 2));
