import * as XLSX from 'xlsx';

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Preview Excel file without saving. Returns parsed data for user confirmation.
 */
export const previewExcelFile = async (file, currentClasses) => {
  const result = await processExcelFile(file, currentClasses);
  
  // Calculate preview statistics
  const daysDetected = Object.keys(result.timetableSchedule || {}).sort();
  const totalLectures = Object.values(result.timetableSchedule || {}).reduce((sum, dayLectures) => sum + dayLectures.length, 0);
  const subjects = new Set();
  const warnings = [...(result.parserWarnings || [])];
  
  // Extract unique subjects and detect potential issues
  Object.values(result.timetableSchedule || {}).forEach(dayLectures => {
    dayLectures.forEach(lecture => {
      const subjectName = lecture.name.split('(')[0].trim();
      subjects.add(subjectName);
    });
  });
  
  // Add heuristic warnings
  if (result.classes.length === 0) {
    warnings.push('No classes detected in timetable');
  }
  if (totalLectures === 0) {
    warnings.push('No lectures detected in timetable');
  }
  if (daysDetected.length < 5) {
    warnings.push(`Only ${daysDetected.length} days detected (expected 5-6)`);
  }
  
  return {
    ...result,
    preview: {
      daysDetected,
      totalLectures,
      subjects: Array.from(subjects).sort(),
      warnings,
      fileName: result.fileName
    }
  };
};

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

        // Parser warnings collection
        const parserWarnings = [];

        // ── Sheet 1: Faculty Initials (new format only) ───────────────────────
        const facultySheetName = sheetNames.find(n =>
          n.toUpperCase().includes('FACULTY') ||
          n.toUpperCase().includes('INITIAL')
        );

        let teacherMap = {}; // initial → full name (new format)
        let subjectMappings = {};

        if (facultySheetName) {
          teacherMap = parseFacultyInitialsSheet(allSheetsJSON[facultySheetName]);
        }

        // ── Detect timetable sheet ────────────────────────────────────────────
        // Prefer sheets named "Master…", "Timetable…", "Schedule…", "Shared TT…".
        // Fall back to the first sheet that actually contains a day-name cell.
        const ttKeywords = ['MASTER', 'TIME TABLE', 'TIMETABLE', 'SCHEDULE', 'SHARED'];
        const finalTimetableSheetName = sheetNames.find(n => {
          const upper = n.toUpperCase();
          return upper.includes('FINAL') && ttKeywords.some(k => upper.includes(k));
        });
        
        const timetableSheetName =
          finalTimetableSheetName ||
          sheetNames.find(n => ttKeywords.some(k => n.toUpperCase().includes(k))) ||
          sheetNames.find(n => containsDayRow(allSheetsJSON[n])) ||
          sheetNames[0];

        // Warning if using fallback sheet detection
        if (!finalTimetableSheetName && !sheetNames.find(n => ttKeywords.some(k => n.toUpperCase().includes(k)))) {
          parserWarnings.push('Timetable sheet not found by name, using fallback detection');
        }

        const activeData = allSheetsJSON[timetableSheetName];

        // ── Auto-detect format ────────────────────────────────────────────────
        // New Master TT: has "TIME/CLASS" (or "TIME / CLASS") cells
        // Old FE format: class names appear in rows below day headers (no TIME/CLASS)
        const isNewFormat = detectNewFormat(activeData);

        // Warning if format detection is uncertain
        if (!activeData || activeData.length === 0) {
          parserWarnings.push('Timetable sheet appears to be empty');
        }

        let parsedTimetable;
        if (isNewFormat) {
          parsedTimetable = parseMasterTimetable(activeData, teacherMap, wb.Sheets[timetableSheetName]);
        } else {
          // Old FE format — also check for allocation sheet
          const allocSheetName = sheetNames.find(n =>
            n.toUpperCase().includes('ALLOCATION') ||
            n.toUpperCase().includes('DIVISION') ||
            n.toUpperCase().includes('DIV')
          );
          if (allocSheetName) {
            subjectMappings = parseAllocationSheet(allSheetsJSON[allocSheetName]).subjectMappings;
          }
          parsedTimetable = parseFETimetable(activeData, wb.Sheets[timetableSheetName]);
        }

        let classes = parsedTimetable.classes;
        if (classes.length === 0) {
          (currentClasses || []).forEach(c => {
            const n = normalizeClassName(c);
            if (n && !classes.includes(n)) classes.push(n);
          });
        }

        resolve({
          sheetNames,
          selectedSheet: timetableSheetName,
          selectedAllocSheet: facultySheetName || '',
          subjectMappings,
          timetableSchedule: parsedTimetable.schedule,
          classes,
          fileName: file.name,
          rawTimetable: activeData,
          allSheetsJSON,
          teacherMap,
          parserWarnings,
        });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── Shared constants ─────────────────────────────────────────────────────────

const DAYS_LIST = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Abbreviations accepted in either format
const DAY_ABBR = {
  MON: 'MONDAY', TUE: 'TUESDAY', WED: 'WEDNESDAY',
  THU: 'THURSDAY', FRI: 'FRIDAY', SAT: 'SATURDAY',
};

// ─── Format Detection ─────────────────────────────────────────────────────────

/**
 * New Master TT format: has a cell that reads "TIME/CLASS" (or close variant).
 * Falls back to checking whether many cells contain the slash-separated
 * "SUBJ/CODE/ROOM" pattern which is unique to the new format.
 */
function detectNewFormat(data) {
  if (!data) return false;
  let slashCellCount = 0;
  for (const row of data) {
    if (!row) continue;
    for (const cell of row) {
      const v = String(cell || '').trim().toUpperCase().replace(/\s+/g, '');
      // Primary signal: TIME/CLASS header cell (accepts "TIME / CLASS", "TIME-CLASS" etc.)
      if (v === 'TIME/CLASS' || v === 'TIMECLASS' || v === 'TIME-CLASS') return true;
      // Secondary signal: slash-delimited lecture cells like "AOA/A/KUS/CAII"
      if (/^[A-Z]{2,10}\/[A-Z0-9]{1,5}\/[A-Z]{2,6}\//.test(v)) slashCellCount++;
    }
    if (slashCellCount >= 3) return true; // strong secondary signal
  }
  return false;
}

/** Quick check: does this sheet data contain any recognisable day-name row? */
function containsDayRow(data) {
  if (!data) return false;
  for (const row of data) {
    if (row && detectDay(row)) return true;
  }
  return false;
}

// ─── Faculty / Initials Sheet Parser (new format) ────────────────────────────
// Scans every cell-pair in each row looking for (name, initial) combos.
// Works regardless of how many columns the sheet has or whether the
// layout shifts between departments.

function parseFacultyInitialsSheet(data) {
  const map = {}; // INITIAL (upper) → full name
  if (!data || data.length === 0) return map;

  // First pass: find which columns hold "Faculty" and "Initial" headers.
  // The sheet may repeat these headers for each department group.
  let headerPairs = []; // [{nameCol, initCol}]
  data.forEach(row => {
    const headerCols = [];
    row.forEach((cell, i) => {
      const v = String(cell || '').trim().toUpperCase();
      if (v === 'FACULTY' || v === 'NAME') headerCols.push({ type: 'name', col: i });
      if (v === 'INITIAL' || v === 'INITIALS' || v === 'CODE') headerCols.push({ type: 'init', col: i });
    });
    // Pair adjacent name/init headers
    headerCols.filter(h => h.type === 'name').forEach(nameH => {
      const initH = headerCols.find(h => h.type === 'init' && h.col > nameH.col && h.col <= nameH.col + 3);
      if (initH) headerPairs.push({ nameCol: nameH.col, initCol: initH.col });
    });
  });

  // If no explicit headers found, fall back to scanning every group of 4 cols
  // (the layout seen in the mock: [idx, name, initial, gap] repeated)
  if (headerPairs.length === 0) {
    for (let c = 0; c + 2 < (data[0]?.length || 12); c += 4) {
      headerPairs.push({ nameCol: c + 1, initCol: c + 2 });
    }
    // Also try offset 0 in case the sheet starts differently
    for (let c = 0; c + 1 < (data[0]?.length || 12); c += 4) {
      if (!headerPairs.find(h => h.nameCol === c)) {
        headerPairs.push({ nameCol: c, initCol: c + 1 });
      }
    }
  }

  // Second pass: extract name/initial pairs using detected column positions
  data.forEach(row => {
    headerPairs.forEach(({ nameCol, initCol }) => {
      if (nameCol >= row.length || initCol >= row.length) return;
      const name = String(row[nameCol] || '').trim();
      const init = String(row[initCol] || '').trim().toUpperCase();
      if (!name || !init) return;
      if (init === 'INITIAL' || init === 'INITIALS' || init === 'FACULTY' || init === 'NAME' || init === 'CODE') return;
      if (/^\d+$/.test(init)) return; // row-number column
      if (name === 'Faculty' || name === 'Name') return;
      // Accept 2-7 uppercase letters as a valid initial
      if (/^[A-Z]{2,7}$/.test(init)) {
        map[init] = name;
      }
    });
  });

  return map;
}

// ─── Shared class-name normalisation ─────────────────────────────────────────

function normalizeClassName(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    // Strip anything after \r\n (FE format appends room numbers like "D2A\r\n517")
    .replace(/[\r\n][\s\S]*/g, '')
    .replace(/\s+/g, '')     // "D20 B" → "D20B", "D6AD A" → "D6ADA"
    .replace(/^DI/, 'D1');
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FORMAT — Master Time Table 25-26 Even (and future variants)
// ═══════════════════════════════════════════════════════════════════════════════

const BREAK_TOKENS = new Set([
  'BREAK', 'LUNCH', 'RECESS', 'NPTEL', 'PROJECT', 'FIELDPROJECT',
]);

const isNewTimeStr = (v) => {
  const s = String(v || '').trim();
  // Must contain a range separator (hyphen/en-dash), not just a single time
  return /\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(s) ||
    // Also handle "8.30 AM-9.30AM" variants for robustness
    /\d{1,2}[:.]\d{2}\s*(AM|PM)?\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(s);
};

const isBreakContent = (v) => {
  const u = String(v || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/B\s*R\s*E\s*A\s*K/g, 'BREAK');
  return BREAK_TOKENS.has(u) || u.startsWith('BREAK') || u.startsWith('BREA');
};

// Teacher initials: 2–7 uppercase letters (widened to catch BNCY, AnP etc.)
const INIT_RE = /^[A-Z]{2,7}$/;

function isBatchToken(s) {
  const u = String(s || '').trim().toUpperCase();
  if (!u) return false;
  if (/^[A-H]$/.test(u)) return true;
  if (/^[AB][1-9]$/.test(u)) return true;
  if (/^B[1-9]\s*\([^)]*\)$/.test(u)) return true;
  if (/^BATCH\s*[-:]?\s*[0-9A-Z]+/i.test(u)) return true;
  if (/^(DIV\s*[A-Z]|[A-Z]\s*DIV)$/i.test(u)) return true;
  if (/^A5[1-9]$/.test(u) || /^B41[1-9]$/.test(u)) return true;
  if (/^[1-9]$/.test(u)) return true;
  const noSpace = u.replace(/\s+/g, '');
  if (noSpace.includes('1TO34') || noSpace.includes('1TO35') || noSpace.includes('1-34') || noSpace.includes('1-35')) return true;
  if (noSpace.includes('35ONWARDS') || noSpace.includes('36ONWARDS') || noSpace.includes('34ONWARDS')) return true;
  return false;
}

function extractBatchString(s) {
  const u = String(s || '').trim().toUpperCase();
  if (!u) return '';
  if (/^[A-H]$/.test(u)) return u;
  if (/^[AB][1-9]$/.test(u)) return u;
  const bMatch = u.match(/^B([1-9])/);
  if (bMatch) return `B${bMatch[1]}`;
  const batchMatch = u.match(/^BATCH\s*[-:]?\s*([0-9A-Z]+)/);
  if (batchMatch) return batchMatch[1];
  const divMatch = u.match(/(?:DIV\s*([A-Z])|([A-Z])\s*DIV)/);
  if (divMatch) return divMatch[1] || divMatch[2];
  const noSpace = u.replace(/\s+/g, '');
  if (noSpace.includes('1TO34') || noSpace.includes('1TO35') || noSpace.includes('1-34') || noSpace.includes('1-35')) return 'B1';
  if (noSpace.includes('35ONWARDS') || noSpace.includes('36ONWARDS') || noSpace.includes('34ONWARDS')) return 'B2';
  return u;
}

/**
 * Parse a timetable cell into an array of { subject, teacher, batch }.
 * Handles all observed variants and some extra ones for robustness:
 *   1. "SUBJ\n(CODE)\nROOM"          (3-line multiline)
 *   2. "SUBJ\n(CODE)"                (2-line multiline)
 *   3. "SUBJ/BATCH/CODE/ROOM\n…"     (slash-delimited, multi-lecture)
 *   4. "SUBJ (CODE) ROOM"            (inline parens, with/without room)
 *   5. "SUBJ [CODE] ROOM"            (square-bracket variant)
 *   6. Plain text                    (just a subject name)
 */
function parseCellLectures(cellText, teacherMap) {
  const raw = String(cellText || '').trim();
  if (!raw || isBreakContent(raw)) return [];

  const rawLines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !isBreakContent(l));
  if (rawLines.length === 0) return [];

  const lines = [];
  rawLines.forEach(line => {
    if (line.includes('/') && line.length > 15) {
      const splitSegments = line.split(/\s*\/\s*(?=[A-Z0-9\s&-]{2,15}\/)/i);
      splitSegments.forEach(s => {
        if (s.trim()) lines.push(s.trim());
      });
    } else {
      lines.push(line);
    }
  });

  // ── N-line Block: SUBJ \n (CODE) \n ROOM \n BATCH ─────────────────────────
  if (lines.length >= 2 && !lines[0].includes('/')) {
    const subj = cleanSubject(lines[0]);
    let code = '', batch = '', room = '';

    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].replace(/[()[\]]/g, '').trim().toUpperCase();
      if (!l) continue;
      
      // Identify tokens using existing helpers
      if (!batch && isBatchToken(l)) { batch = extractBatchString(l); continue; }
      if (!code && INIT_RE.test(l) && !isRoomNumber(l) && !isBatchToken(l)) { code = l; continue; }
      if (!room && isRoomNumber(l)) { room = l; continue; }
    }

    if (subj && !isBreakContent(subj)) {
      return [{ 
        subject: subj, 
        teacher: resolveTeacher(code, teacherMap), 
        batch: batch || '',
        room: room || ''
      }];
    }
  }

  // ── Multi-line or single slash/inline entries ──────────────────────────────
  const results = [];
  lines.forEach(line => {
    const lec = parseInlineLecture(line, teacherMap);
    if (lec) results.push(lec);
  });
  return results.filter(l => l && l.subject && !isBreakContent(l.subject));
}

/**
 * Parse a single-line lecture string.
 * Tries slash-split first, then parenthesis/bracket form, then plain text.
 */
function parseInlineLecture(line, teacherMap) {
  const raw = line.trim();
  if (!raw || isBreakContent(raw)) return null;

  // ── Slash-separated ────────────────────────────────────────────────────────
  if (raw.includes('/')) {
    const parts = raw.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const subject = cleanSubject(parts[0]);
    if (!subject || isBreakContent(subject)) return null;

    let code = '';
    let batch = '';
    let room = '';

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const upper = part.replace(/\s+/g, '').toUpperCase();

      if (!batch && isBatchToken(part)) {
        batch = extractBatchString(part);
        continue;
      }

      if (!room && isRoomNumber(upper)) {
        room = upper;
        continue;
      }

      if (!code && (teacherMap[upper] || (INIT_RE.test(upper) && !isRoomNumber(upper)))) {
        code = upper;
        continue;
      }
    }

    return {
      subject,
      teacher: resolveTeacher(code, teacherMap),
      batch: batch || '',
      room: room || '',
    };
  }

  // ── Paren form: "SUBJ (CODE) ROOM ..." or square brackets ────────────────
  const bracketMatch = raw.match(/^(.+?)\s*[(\[]([\w\s-]+)[\)|\]](.*)/);
  if (bracketMatch) {
    const subject = cleanSubject(bracketMatch[1]);
    const code = bracketMatch[2].trim().toUpperCase();
    const rest = bracketMatch[3] || '';
    if (!subject || isBreakContent(subject)) return null;
    const batchCandidate = isBatchToken(code) ? extractBatchString(code) : '';
    const teacherCandidate = INIT_RE.test(code) && !isBatchToken(code) ? resolveTeacher(code, teacherMap) : '';
    // Try to find a room number in the remaining text after the bracket
    const restTokens = rest.split(/[\s/,]+/).map(t => t.replace(/[()[\]]/g, '').trim()).filter(Boolean);
    const roomToken = restTokens.find(t => isRoomNumber(t.toUpperCase()));
    return { subject, teacher: teacherCandidate, batch: batchCandidate, room: roomToken ? roomToken.toUpperCase() : '' };
  }

  // ── Plain text ─────────────────────────────────────────────────────────────
  const subject = cleanSubject(raw);
  if (subject && !isBreakContent(subject)) return { subject, teacher: '', batch: '', room: '' };
  return null;
}

function isRoomNumber(s) {
  const u = String(s || '').trim().toUpperCase();
  if (/^\d+$/.test(u)) return true;
  if (/^[A-Z]{1,3}\d+$/.test(u)) return true;
  if (/^CA\s*-?\s*[0-9IVX]+$/i.test(u)) return true;
  if (/^\d+[A-Z]?$/i.test(u)) return true;
  return false;
}

function resolveTeacher(code, teacherMap) {
  if (!code) return '';
  const upper = String(code).toUpperCase();
  return teacherMap[upper] || code; // fall back to code if not in map
}

function cleanSubject(s) {
  return String(s || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeTime(t) {
  // "10.30-11.30" → "10:30-11:30" | "8.30 AM-9.30AM" → "8:30-9:30"
  return String(t)
    .trim()
    .replace(/\./g, ':')            // dots to colons
    .replace(/\s*(AM|PM)\s*/gi, '') // strip AM/PM
    .replace(/\s+/g, '');
}

function parseMasterTimetable(data, teacherMap, worksheet) {
  if (!data || data.length === 0) return { classes: [], schedule: {} };

  const schedule  = {};
  const classSet  = new Set();
  let columnClassMap = {}; // col index → normalized class name
  let currentDay = '';

  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || row.length === 0) continue;

    // ── Day row ───────────────────────────────────────────────────────────
    const dayFound = detectDay(row);
    if (dayFound && currentDay !== dayFound) {
      currentDay = dayFound;
      if (!schedule[currentDay]) schedule[currentDay] = [];
    }

    // ── Class-header row (contains TIME/CLASS or close variant) ───────────
    if (isClassHeaderRow(row)) {
      columnClassMap = {};
      row.forEach((cell, colIdx) => {
        const val = String(cell || '').trim();
        const upper = val.toUpperCase().replace(/[\s\-\/]/g, '');
        if (!val || upper === 'TIMECLASS' || upper === 'TIME') return;
        const className = normalizeClassName(val);
        if (className && className.length >= 2) {
          columnClassMap[colIdx] = className;
          classSet.add(className);
        }
      });
      continue;
    }

    // ── Time-slot data row ────────────────────────────────────────────────
    if (!currentDay || Object.keys(columnClassMap).length === 0) continue;

    let timeStr = '';
    row.forEach(cell => {
      if (!timeStr && isNewTimeStr(cell)) timeStr = normalizeTime(cell);
    });
    if (!timeStr) continue;

    Object.entries(columnClassMap).forEach(([colIdxStr, className]) => {
      const colIdx = Number(colIdxStr);
      const cell = row[colIdx];
      if (!cell) return;
      
      let finalTimeStr = timeStr;
      
      if (worksheet && worksheet['!merges']) {
        const merge = worksheet['!merges'].find(m => m.s.r === rowIdx && m.s.c === colIdx && m.e.r > m.s.r);
        if (merge) {
          let endTimeStr = '';
          const endRow = data[merge.e.r];
          if (endRow) {
            endRow.forEach(c => {
              if (!endTimeStr && isNewTimeStr(c)) endTimeStr = normalizeTime(c);
            });
          }
          if (endTimeStr) {
            const startParts = timeStr.split('-');
            const endParts = endTimeStr.split('-');
            if (startParts.length >= 2 && endParts.length >= 2) {
              finalTimeStr = `${startParts[0].trim()}-${endParts[1].trim()}`;
            }
          }
        }
      }

      parseCellLectures(cell, teacherMap).forEach(({ subject, teacher, batch, room }) => {
        let displayName = subject;
        if (batch) {
          displayName = `${subject} (Batch ${batch})`;
        }
        if (teacher) {
          displayName = `${displayName} (${teacher})`;
        }

        schedule[currentDay].push({
          time: finalTimeStr,
          name: displayName,
          className,
          batch: batch || '',
          room: room || '',
        });
      });
    });
  }

  return {
    classes: [...classSet].sort(classSort),
    schedule,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects the current day from any cell in a row.
 * Accepts full names ("MONDAY"), abbreviations ("MON", "TUE."),
 * and cells where the day has trailing text ("MONDAY (online mini project…)").
 */
function detectDay(row) {
  for (const cell of row) {
    const val = String(cell || '').trim().toUpperCase();
    // Full name — exact, or followed by space/newline/paren
    const full = DAYS_LIST.find(d =>
      val === d ||
      val.startsWith(d + ' ') ||
      val.startsWith(d + '\n') ||
      val.startsWith(d + '(')
    );
    if (full) return full;
    // 3-letter abbreviation — exact, or followed by space/period
    const abbr = Object.keys(DAY_ABBR).find(a =>
      val === a ||
      val.startsWith(a + ' ') ||
      val.startsWith(a + '.')
    );
    if (abbr) return DAY_ABBR[abbr];
  }
  return null;
}

/**
 * Returns true when a row is a class-header row in the new Master TT format.
 * Matches "TIME/CLASS", "TIME / CLASS", "TIME-CLASS", "TIME CLASS" etc.
 */
function isClassHeaderRow(row) {
  return row.some(cell => {
    const v = String(cell || '').trim().toUpperCase().replace(/[\s\-\/]/g, '');
    return v === 'TIMECLASS';
  });
}

function classSort(a, b) {
  const parse = (s) => {
    const m = s.match(/^D(\d+)([A-Z]*)/);
    if (m) return [0, parseInt(m[1], 10), m[2] || ''];
    if (s.startsWith('ME'))  return [1, 0, s];
    if (s.startsWith('MCA')) return [2, 0, s];
    return [3, 0, s];
  };
  const [ta, na, sa] = parse(a);
  const [tb, nb, sb] = parse(b);
  if (ta !== tb) return ta - tb;
  if (na !== nb) return na - nb;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OLD FORMAT — FE Shared Timetable (original logic, preserved + hardened)
// ═══════════════════════════════════════════════════════════════════════════════

// Wider pattern: also accepts D1ADA, D1EC, D1K, D3, D16AD, D19B, etc.
const OLD_CLASS_NAME_PATTERN = /^D\d+[A-Z]{0,5}$/;

/**
 * Normalise a class name token coming from the FE timetable.
 * Handles trailing room-numbers ("D2A\r\n517"), spaces, dash separators.
 */
function oldNormalizeClassName(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    // Strip room number appended after \r\n (e.g. "D2A\r\n517" → "D2A")
    .replace(/[\r\n][\s\S]*/g, '')
    .replace(/\s+/g, '')
    .replace(/^DI/, 'D1')
    // "D1AD-A" → "D1ADA"  (dash or underscore separator)
    .replace(/^(D\d+[A-Z]*)[-_]([A-Z])$/, '$1$2');
}

function isOldClassName(value) {
  return OLD_CLASS_NAME_PATTERN.test(oldNormalizeClassName(value));
}

/**
 * Split a cell value into class-name tokens.
 * Splits on whitespace, newlines, slashes, parens, commas, etc.
 */
function extractClassTokens(value) {
  return String(value || '')
    .toUpperCase()
    .split(/[\s\r\n/(),:;|]+/)
    .map(oldNormalizeClassName)
    .filter(isOldClassName);
}

function parseAllocationSheet(data) {
  if (!data || data.length === 0) return { subjectMappings: {}, classes: [] };

  const subjectMappings = {};
  const classes = [];
  let matrixClassColumns = [];

  data.forEach((row) => {
    // Explicit CLASS column header
    const classColIdx = row.findIndex(cell => String(cell || '').trim().toUpperCase() === 'CLASS');
    if (classColIdx !== -1) {
      data.forEach(candidateRow => {
        const cn = oldNormalizeClassName(candidateRow[classColIdx]);
        if (isOldClassName(cn) && !classes.includes(cn)) {
          classes.push(cn);
          if (!subjectMappings[cn]) subjectMappings[cn] = {};
        }
      });
    }

    // Matrix header row: several class names appear in one row
    const classesInRow = row
      .map((cell, index) => {
        const tokens = extractClassTokens(cell);
        return tokens.length === 1 ? { name: tokens[0], index } : null;
      })
      .filter(Boolean);

    if (classesInRow.length > 1) {
      matrixClassColumns = classesInRow;
      matrixClassColumns.forEach(c => {
        if (!classes.includes(c.name)) classes.push(c.name);
        if (!subjectMappings[c.name]) subjectMappings[c.name] = {};
      });
    } else if (matrixClassColumns.length > 0) {
      const subjectName = String(row[0] || '').trim().replace(/\n/g, ' ').toUpperCase();
      // Accept subject names 2–30 chars, skip institution name rows
      if (subjectName && subjectName.length >= 2 && subjectName.length < 30 && !subjectName.includes('VES')) {
        matrixClassColumns.forEach(cls => {
          let teacherName = String(row[cls.index] || '').trim().replace(/\n/g, ' ');
          if (!teacherName || teacherName.toLowerCase() === 'null') teacherName = 'Assigned';
          subjectMappings[cls.name][subjectName] = teacherName;
        });
      }
    }
  });

  return { subjectMappings, classes };
}

function parseFETimetable(data, worksheet) {
  let classes = [];
  const mappings = {}, schedule = {};
  let currentDay = '';

  const noise = new Set([
    'BREAK', 'LUNCH', 'RECESS', 'TIME', 'ROOM', 'LAB', 'LEC', 'SEC', 'SEM',
    'YEAR', 'DURATION', 'SUBJECT', 'TEACHER', 'FACULTY', 'CLASS',
  ]);

  // Accepts both "HH.MM" / "H.MM AM-…" variants
  const isTimeCell = (value) => /\d{1,2}[:.][0-5]\d/.test(String(value || '').trim());

  if (!data || data.length === 0) return { classes, schedule };

  data.forEach((row, rowIdx) => {
    // ── Day detection ───────────────────────────────────────────────────────
    row.forEach(cell => {
      const val = String(cell || '').toUpperCase().trim();
      const d = DAYS_LIST.find(d => val === d || val.startsWith(d + ' ') || val.startsWith(d + '\n'));
      if (d) {
        currentDay = d;
        if (!schedule[d]) schedule[d] = [];
      } else {
        const a = Object.keys(DAY_ABBR).find(a => val === a || val.startsWith(a + ' ') || val.startsWith(a + '.'));
        if (a) {
          currentDay = DAY_ABBR[a];
          if (!schedule[currentDay]) schedule[currentDay] = [];
        }
      }
    });

    // ── Classify row ──────────────────────────────────────────────────────────
    const timeCols = row
      .map((cell, index) => ({ index, value: String(cell || '').trim() }))
      .filter(({ value }) => isTimeCell(value));
    const first = timeCols[0]?.value || String(row[0] || '').trim();
    const isTimeRow = timeCols.length > 0;

    if (!isTimeRow) {
      // Non-time row: scan for class-name tokens
      row.forEach((cell, i) => {
        if (!cell || i === 0) return;
        extractClassTokens(cell).forEach(className => {
          if (!classes.includes(className)) classes.push(className);
          if (!mappings[i]) mappings[i] = [];
          if (!mappings[i].includes(className)) mappings[i].push(className);
        });
      });
    }

    if (currentDay && isTimeRow) {
      Object.keys(mappings).forEach(i => {
        const content = row[i];
        if (!content || String(content).trim().length <= 1) return;
        const timeForCol = getOldTimeForMergedCell(data, worksheet, rowIdx, Number(i), timeCols, first);
        const cc = String(content).trim();
        // Skip noise words and bare room-number strings
        if (noise.has(cc.toUpperCase()) || /^\d+$/.test(cc)) return;
        mappings[i].forEach(cls => {
          if (!Array.isArray(schedule[currentDay])) schedule[currentDay] = [];
          schedule[currentDay].push({ time: timeForCol, name: cc, className: cls });
        });
      });
    }
  });

  return { classes, schedule };
}

function getOldTimeForMergedCell(data, worksheet, rowIdx, colIdx, timeCols, fallbackTime) {
  const startTime = getOldTimeForColumn(timeCols, colIdx, fallbackTime);
  const merge = (worksheet?.['!merges'] || []).find(m =>
    m.s.r === rowIdx && m.s.c === colIdx && m.e.r > m.s.r
  );
  if (!merge) return startTime;

  const endTime = getOldTimeForRow(data, merge.e.r, colIdx, fallbackTime);
  return combineOldTimeRanges(startTime, endTime) || startTime;
}

function getOldTimeForRow(data, rowIdx, colIdx, fallbackTime) {
  const row = data[rowIdx] || [];
  const timeCols = row
    .map((cell, index) => ({ index, value: String(cell || '').trim() }))
    .filter(({ value }) => /\d{1,2}[:.][0-5]\d/.test(value));
  return getOldTimeForColumn(timeCols, colIdx, fallbackTime);
}

function getOldTimeForColumn(timeCols, colIdx, fallbackTime) {
  return [...timeCols]
    .reverse()
    .find(({ index }) => index < colIdx)?.value || fallbackTime;
}

function combineOldTimeRanges(startRange, endRange) {
  const start = splitOldTimeRange(startRange);
  const end = splitOldTimeRange(endRange);
  if (!start || !end) return '';
  return `${start.start}-${end.end}`;
}

function splitOldTimeRange(value) {
  const parts = String(value || '').split(/\s*[-–]\s*/);
  if (parts.length < 2) return null;
  return {
    start: parts[0].trim(),
    end: parts.slice(1).join('-').trim(),
  };
}
