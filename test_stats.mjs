import fs from 'fs';

const state = {
  selectedClass: 'D6',
  selectedBatch: 'B1',
  timetableSchedule: {
    'MONDAY': [
      { time: '9:00', name: 'MPMC' },
      { time: '10:00', name: 'MPMC' },
      { time: '11:00', name: 'MPMC' }
    ]
  },
  attendance: {
    '2026-08-10': { // A Monday
      '9:00_MPMC_0': 'present',
      '10:00_MPMC_1': 'present',
      '11:00_MPMC_2': 'present'
    }
  },
  subjectMappings: {
    'D6': {}
  },
  holidays: []
};

function normalizeBatch(value) {
    const text = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!text) return '';
    if (['B1', 'BATCH1', 'BATCHI', 'I', '1', 'A', 'BATCHA'].includes(text)) return 'B1';
    if (['B2', 'BATCH2', 'BATCHII', 'II', '2', '1I', 'B1I', 'BATCH1I', 'B', 'BATCHB'].includes(text)) return 'B2';
    if (['B3', 'BATCH3', 'BATCHIII', 'III', '3', 'C', 'BATCHC'].includes(text)) return 'B3';
    return text;
}

function getLectureBatches(lectureName) {
    const text = String(lectureName || '').toUpperCase();
    const batches = new Set();
    const patterns = [
        /\bBATCH\s*[-:]?\s*(1I|I{1,3}|[1-3]|[A-C])\b/g,
        /\bB\s*[-:]?\s*([1-3]|[A-C])\b/g,
        /\((?:BATCH\s*)?([1-3]|[A-C])\)/g,
    ];
    patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const normalized = normalizeBatch(match[1]);
            if (normalized) batches.add(normalized);
        }
    });
    return [...batches];
}

function normalizeClassName(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/^DI/, 'D1');
}

function lectureMatchesSelection(lecture, selectedClass, selectedBatch, selectedPceBatch) {
    if (!lecture) return false;
    const myClass = normalizeClassName(selectedClass);
    const lectureClass = normalizeClassName(lecture.className || 'D6'); // mock class
    if (lectureClass !== myClass) return false;
    const isPce = String(lecture.subject || lecture.name || '').toUpperCase().includes('PCE');
    const activeBatchToMatch = (isPce && selectedPceBatch) ? selectedPceBatch : selectedBatch;
    const batch = normalizeBatch(activeBatchToMatch);
    if (!batch) return true;
    if (lecture.batch) {
        const normLecBatch = normalizeBatch(lecture.batch);
        if (normLecBatch) return normLecBatch === batch;
    }
    const lectureBatches = getLectureBatches(lecture.name);
    return lectureBatches.length === 0 || lectureBatches.includes(batch);
}

function getScheduleForDate(date, state) {
  return state.timetableSchedule || {};
}

function getStatistics() {
    const attendance = state.attendance || {};
    const timetable = state.timetableSchedule || {};
    const mappings = state.selectedClass && state.subjectMappings?.[state.selectedClass]
      ? state.subjectMappings[state.selectedClass] : {};
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];

    const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/II/g, '2');
    const cleanSubjectName = (value) => String(value || '')
      .toUpperCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\bBATCH\b.*$/g, ' ')
      .replace(/\b\d{3,4}\b/g, ' ')
      .replace(/\b(LANGUAGE\s+)?LAB\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const getSelectedBatchSubject = (lectureName) => {
      return '';
    };

    const resolveSubjectInfo = (lectureName) => {
      const fullName = String(lectureName || '').toUpperCase();
      const batchSubject = getSelectedBatchSubject(fullName);
      const base = batchSubject || cleanSubjectName(fullName.split('-')[0]);
      if (!base) return null;

      const search = clean(base);
      const matchedSub = Object.keys(mappings).find(s => {
        const t = clean(s);
        return search.startsWith(t) || t.startsWith(search);
      });
      const isLab = Boolean(batchSubject) || fullName.includes('LAB') || fullName.includes('PRACTICAL') || fullName.includes('PRAC');

      return {
        label: `${matchedSub || base} (${isLab ? 'Lab' : 'Theory'})`,
        teacher: matchedSub ? (mappings[matchedSub] || '') : '',
      };
    };

    const lectureMatches = (l) =>
      lectureMatchesSelection(l, state.selectedClass, state.selectedBatch, state.selectedPceBatch);

    let totalLectures = 0;
    let presentLectures = 0;
    let daysWithMajority = 0;
    const subjects = {}; 
    const scheduleCache = new Map();

    Object.entries(attendance).forEach(([date, dayMap]) => {
      if (holidays.includes(date)) return;
      if (!dayMap || typeof dayMap !== 'object') return;

      const dateObj = new Date(date + 'T12:00:00');
      const dayKey = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      
      if (!scheduleCache.has(date)) {
        scheduleCache.set(date, getScheduleForDate(date, state));
      }
      const dayLectures = scheduleCache.get(date)[dayKey] || [];

      let dayTotal = 0;
      let dayPresent = 0;

      Object.entries(dayMap).forEach(([id, status]) => {
        let lecture = null;
        const lastUnder = id.lastIndexOf('_');
        const firstUnder = id.indexOf('_');

        if (lastUnder !== -1) {
          const idx = parseInt(id.slice(lastUnder + 1), 10);
          if (!isNaN(idx) && dayLectures[idx]) {
            lecture = dayLectures[idx];
          }
          if (!lecture && firstUnder !== -1 && firstUnder !== lastUnder) {
            const nameFromKey = id.slice(firstUnder + 1, lastUnder);
            lecture = dayLectures.find(l => l.name === nameFromKey) || null;
          }
        }

        if (!lecture && id.includes('-')) {
          const parts = id.split('-');
          const idx = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(idx) && dayLectures[idx]) {
            lecture = dayLectures[idx];
          }
        }

        let subLabel = null;
        let teacher = '';

        if (lecture && lectureMatches(lecture)) {
          const resolved = resolveSubjectInfo(lecture.name);
          if (resolved) {
            subLabel = resolved.label;
            teacher = resolved.teacher;
          }
        } else if (!lecture && lastUnder !== -1 && firstUnder !== -1 && firstUnder !== lastUnder) {
          const nameFromKey = id.slice(firstUnder + 1, lastUnder);
          if (nameFromKey) {
            const resolved = resolveSubjectInfo(nameFromKey);
            if (resolved) {
              subLabel = resolved.label;
              teacher = resolved.teacher;
            }
          }
        }

        if (!subLabel) return;

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

    return subjects;
}

console.log(JSON.stringify(getStatistics(), null, 2));
