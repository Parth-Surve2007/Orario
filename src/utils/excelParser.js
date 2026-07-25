import * as XLSX from 'xlsx';

export const processExcelFile = async (file, currentClasses) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetNames = wb.SheetNames;
        
        let allSheetsJSON = {};
        sheetNames.forEach(n => {
            allSheetsJSON[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
        });

        let subjectMappings = {};
        let timetableSchedule = {};
        let classes = [];
        
        // 1. Allocation Sheet
        const allocSheetName = sheetNames.find(n => n.toUpperCase().includes('ALLOCATION') || n.toUpperCase().includes('DIV'));
        if (allocSheetName) {
            const allocData = allSheetsJSON[allocSheetName];
            const allocationResult = parseAllocationSheet(allocData);
            subjectMappings = allocationResult.subjectMappings;
            allocationResult.classes.forEach(c => {
                if (!classes.includes(c)) classes.push(c);
            });
        }

        // 2. Timetable Sheet
        const timetableSheetName = sheetNames.find(n => n.toUpperCase().includes('TIMETABLE') || n.toUpperCase().includes('SCHEDULE')) || sheetNames[0];
        const activeData = allSheetsJSON[timetableSheetName];
        
        const parsedTimetable = parseTimetable(activeData);
        timetableSchedule = parsedTimetable.schedule;
        
        // Merge unique classes. Prefer explicit allocation-sheet classes when available;
        // fall back to timetable headers for files without allocation data.
        parsedTimetable.classes.forEach(c => {
            if (!classes.includes(c)) classes.push(c);
        });

        if (classes.length === 0) {
            (currentClasses || []).forEach(c => {
                const normalized = normalizeClassName(c);
                if (isClassName(normalized) && !classes.includes(normalized)) classes.push(normalized);
            });
        }

        resolve({
            sheetNames,
            selectedSheet: timetableSheetName,
            selectedAllocSheet: allocSheetName || '',
            subjectMappings,
            timetableSchedule,
            classes,
            fileName: file.name,
            rawTimetable: activeData,
            allSheetsJSON
        });
      } catch (e) {
          reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const CLASS_NAME_PATTERN = /^D\d+[A-Z]{0,3}(?:-[A-Z])?$/;

function normalizeClassName(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/^DI/, 'D1');
}

function isClassName(value) {
    return CLASS_NAME_PATTERN.test(normalizeClassName(value));
}

function extractClassTokens(value) {
    return String(value || '')
        .toUpperCase()
        .split(/[\s/(),:;|]+/)
        .map(normalizeClassName)
        .filter(isClassName);
}

function parseAllocationSheet(data) {
    if (!data || data.length === 0) return { subjectMappings: {}, classes: [] };

    const subjectMappings = {};
    const classes = [];
    let matrixClassColumns = [];

    data.forEach((row) => {
        const explicitClassHeaderIndex = row.findIndex((cell) => String(cell || '').trim().toUpperCase() === 'CLASS');
        if (explicitClassHeaderIndex !== -1) {
            data.forEach((candidateRow) => {
                const detectedClass = normalizeClassName(candidateRow[explicitClassHeaderIndex]);
                if (isClassName(detectedClass) && !classes.includes(detectedClass)) {
                    classes.push(detectedClass);
                    if (!subjectMappings[detectedClass]) subjectMappings[detectedClass] = {};
                }
            });
        }

        const detectedClassesInRow = row
            .map((cell, index) => {
                const tokens = extractClassTokens(cell);
                return tokens.length === 1 ? { name: tokens[0], index } : null;
            })
            .filter(Boolean);

        if (detectedClassesInRow.length > 1) {
            matrixClassColumns = detectedClassesInRow;
            matrixClassColumns.forEach((c) => {
                if (!classes.includes(c.name)) classes.push(c.name);
                if (!subjectMappings[c.name]) subjectMappings[c.name] = {};
            });
        } else if (matrixClassColumns.length > 0) {
            const subjectName = String(row[0] || '').trim().replace(/\n/g, ' ').toUpperCase();
            if (subjectName && subjectName.length >= 2 && subjectName.length < 25 && !subjectName.includes('VES')) {
                matrixClassColumns.forEach((cls) => {
                    let teacherName = String(row[cls.index] || '').trim().replace(/\n/g, ' ');
                    if (!teacherName || teacherName.toLowerCase() === 'null') teacherName = 'Assigned';
                    subjectMappings[cls.name][subjectName] = teacherName;
                });
            }
        }
    });

    return { subjectMappings, classes };
}

function parseTimetable(data) {
    let classes = [];
    let mappings = {}, schedule = {}, currentDay = '';
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const abbr = { 'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY', 'THU': 'THURSDAY', 'FRI': 'FRIDAY', 'SAT': 'SATURDAY' };
    const noise = ['BREAK', 'LUNCH', 'RECESS', 'TIME', 'ROOM', 'LAB', 'LEC', 'SEC', 'SEM', 'YEAR', 'DURATION', 'SUBJECT', 'TEACHER', 'FACULTY', 'CLASS'];

    if (!data || data.length === 0) return { classes, schedule };

    data.forEach((row, rowIndex) => {
        row.forEach(cell => {
            const val = String(cell || '').toUpperCase().trim();
            const d = days.find(d => val === d || val.startsWith(d + ' '));
            if (d) { currentDay = d; if (!schedule[d]) schedule[d] = []; }
            else {
                const a = Object.keys(abbr).find(a => val === a || val.startsWith(a + ' '));
                if (a) { currentDay = abbr[a]; if (!schedule[currentDay]) schedule[currentDay] = []; }
            }
        });

        const first = String(row[0] || '').toUpperCase().trim();
        const isTime = /(\d{1,2})[\.:](\d{2})/.test(first) || first.includes('AM') || first.includes('PM');

        if (!isTime) {
            row.forEach((cell, i) => {
                if (!cell || i === 0) return;

                const tokens = extractClassTokens(cell);
                tokens.forEach((className) => {
                    if (!classes.includes(className)) classes.push(className);
                    if (!mappings[i]) mappings[i] = [];
                    if (!mappings[i].includes(className)) mappings[i].push(className);
                });
            });
        }

        if (currentDay && isTime) {
            Object.keys(mappings).forEach(i => {
                const content = row[i];
                if (content && String(content).trim().length > 1) {
                    const cleanContent = String(content).trim();
                    if (!noise.includes(cleanContent.toUpperCase())) {
                        mappings[i].forEach(cls => {
                            schedule[currentDay].push({ time: first, name: cleanContent, className: cls });
                        });
                    }
                }
            });
        }
    });

    return { classes, schedule };
}
