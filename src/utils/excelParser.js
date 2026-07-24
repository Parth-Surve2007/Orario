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
        let classes = [...(currentClasses || [])];
        
        // 1. Allocation Sheet
        const allocSheetName = sheetNames.find(n => n.toUpperCase().includes('ALLOCATION') || n.toUpperCase().includes('DIV'));
        if (allocSheetName) {
            const allocData = allSheetsJSON[allocSheetName];
            subjectMappings = parseAllocationSheet(allocData);
        }

        // 2. Timetable Sheet
        const timetableSheetName = sheetNames.find(n => n.toUpperCase().includes('TIMETABLE') || n.toUpperCase().includes('SCHEDULE')) || sheetNames[0];
        const activeData = allSheetsJSON[timetableSheetName];
        
        const parsedTimetable = parseTimetable(activeData);
        timetableSchedule = parsedTimetable.schedule;
        
        // Merge unique classes
        parsedTimetable.classes.forEach(c => {
            if (!classes.includes(c)) classes.push(c);
        });

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

function parseAllocationSheet(data) {
    if (!data || data.length === 0) return {};

    let mappings = {};
    let classColumns = [];

    data.forEach((row, rowIndex) => {
        const detectedClassesInRow = row.map((cell, i) => {
            const val = String(cell || '').trim().toUpperCase();
            if (!val) return null;
            const isClass = /^[A-DA-Z]\d+[A-Z]*$/.test(val) || val.length === 3 || val.length === 4;
            const isNoise = ['VES', 'TIME', 'ROOM', 'DAY', 'SUBJ', 'TEACH'].some(n => val.includes(n));
            return (isClass && !isNoise) ? { name: val, index: i } : null;
        }).filter(x => x);

        if (detectedClassesInRow.length > 2) {
            classColumns = detectedClassesInRow;
            classColumns.forEach(c => { if (!mappings[c.name]) mappings[c.name] = {}; });
        } else if (classColumns.length > 0) {
            const subjectName = String(row[0] || '').trim().replace(/\n/g, ' ').toUpperCase();
            if (subjectName && subjectName.length >= 2 && subjectName.length < 25 && !subjectName.includes('VES')) {
                classColumns.forEach(cls => {
                    let teacherName = String(row[cls.index] || '').trim().replace(/\n/g, ' ');
                    if (!teacherName || teacherName.toLowerCase() === 'null') teacherName = 'Assigned';
                    mappings[cls.name][subjectName] = teacherName;
                });
            }
        }
    });

    return mappings;
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

        const isPotentialHeader = row.some(c => {
            if (typeof c !== 'string') return false;
            const clean = c.trim().toUpperCase();
            return clean.length >= 3 && clean.length <= 8 && !noise.includes(clean) && !days.includes(clean) && !abbr[clean];
        });

        if (isPotentialHeader) {
            row.forEach((cell, i) => {
                if (cell && i > 0) {
                    const cellStr = String(cell).toUpperCase().trim();
                    const parts = cellStr.split(/[\s\/(,)]+/);
                    parts.forEach(p => {
                        if (p.length >= 3 && !noise.includes(p) && !days.includes(p) && !abbr[p] && !/^\d+$/.test(p)) {
                            if (!classes.includes(p)) classes.push(p);
                            if (!mappings[i]) mappings[i] = [];
                            if (!mappings[i].includes(p)) mappings[i].push(p);
                        }
                    });
                }
            });
        }

        const first = String(row[0] || '').toUpperCase().trim();
        const isTime = /(\d{1,2})[\.:](\d{2})/.test(first) || first.includes('AM') || first.includes('PM');

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
