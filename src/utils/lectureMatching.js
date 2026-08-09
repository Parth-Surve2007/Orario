export const normalizeClassName = (value) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^DI/, 'D1');

export const normalizeBatch = (value) => {
    const text = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!text) return '';
    if (['B1', 'BATCH1', 'BATCHI', 'I', '1', 'A', 'BATCHA'].includes(text)) return 'B1';
    if (['B2', 'BATCH2', 'BATCHII', 'II', '2', '1I', 'B1I', 'BATCH1I', 'B', 'BATCHB'].includes(text)) return 'B2';
    if (['B3', 'BATCH3', 'BATCHIII', 'III', '3', 'C', 'BATCHC'].includes(text)) return 'B3';
    return text;
};

export const getLectureBatches = (lectureName) => {
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
};

export const lectureMatchesSelection = (lecture, selectedClass, selectedBatch, selectedPceBatch) => {
    if (!lecture) return false;

    const myClass = normalizeClassName(selectedClass);
    const lectureClass = normalizeClassName(lecture.className);
    if (lectureClass !== myClass) return false;

    const isPce = String(lecture.subject || lecture.name || '').toUpperCase().includes('PCE');
    const activeBatchToMatch = (isPce && selectedPceBatch) ? selectedPceBatch : selectedBatch;
    
    const batch = normalizeBatch(activeBatchToMatch);
    if (!batch) return true;

    if (lecture.batch) {
        const normLecBatch = normalizeBatch(lecture.batch);
        if (normLecBatch) {
            return normLecBatch === batch;
        }
    }

    const lectureBatches = getLectureBatches(lecture.name);
    return lectureBatches.length === 0 || lectureBatches.includes(batch);
};

/**
 * Given a date string (YYYY-MM-DD) and app state, returns the timetable
 * schedule object { MONDAY: [...], TUESDAY: [...], ... } that was active
 * on that date.
 *
 * Logic:
 *  1. If no `timetableVersions` exist, fall back to `timetableSchedule` (backward compat).
 *  2. Find the most recent version whose uploadedAt <= date.
 *  3. If date is before ALL versions, use the oldest version (assume it was always in use).
 */
export const getScheduleForDate = (date, state) => {
    const versions = state.timetableVersions;

    // No versioning yet, or corrupted (non-array) — fall back to the current schedule
    if (!Array.isArray(versions) || versions.length === 0) {
        return state.timetableSchedule || {};
    }

    // Sort versions oldest → newest (defensive; they should already be ordered)
    const sorted = [...versions].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));

    // Walk from newest to oldest, find last version uploaded on or before the date
    let active = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].uploadedAt <= date) {
            active = sorted[i];
            break;
        }
    }

    // Date is before all uploads — use oldest timetable
    if (!active) active = sorted[0];

    return active.schedule || {};
};

