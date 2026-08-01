import Dexie from 'dexie';

const LEGACY_DB_NAME = 'AttendEaseDB';
const DB_NAME = 'OrarioDB';
const LEGACY_STATE_KEYS = ['orario_state', 'attendease_state'];
const VALID_APP_NAMES = ['Orario', 'AttendEase'];

const db = new Dexie(DB_NAME);

db.version(1).stores({
  appState: 'id',
  excelSheets: 'id',
});

export const APP_STATE_ID = 1;
export const EXCEL_SHEETS_ID = 1;
export const BACKUP_VERSION = 1;

let migrationPromise = null;

async function migrateFromLegacyDb() {
  const legacyDb = new Dexie(LEGACY_DB_NAME);
  legacyDb.version(1).stores({
    appState: 'id',
    excelSheets: 'id',
  });

  try {
    await legacyDb.open();
    const [appStateRow, excelSheetsRow] = await Promise.all([
      legacyDb.appState.get(APP_STATE_ID),
      legacyDb.excelSheets.get(EXCEL_SHEETS_ID),
    ]);

    if (appStateRow?.data) {
      await db.appState.put(appStateRow);
    }
    if (excelSheetsRow?.data) {
      await db.excelSheets.put(excelSheetsRow);
    }

    legacyDb.close();
    await Dexie.delete(LEGACY_DB_NAME);
  } catch {
    legacyDb.close();
  }
}

async function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await db.open();
      const hasData = await db.appState.get(APP_STATE_ID);
      if (!hasData) {
        await migrateFromLegacyDb();
      }
    })();
  }
  return migrationPromise;
}

function getLegacyLocalStorageState() {
  for (const key of LEGACY_STATE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function clearLegacyLocalStorageState() {
  for (const key of LEGACY_STATE_KEYS) {
    localStorage.removeItem(key);
  }
}

export async function loadAppState() {
  await ensureMigrated();
  const row = await db.appState.get(APP_STATE_ID);
  if (row?.data) return row.data;

  const legacy = getLegacyLocalStorageState();
  if (!legacy) return null;

  try {
    const parsed = JSON.parse(legacy);
    await saveAppState(parsed);
    clearLegacyLocalStorageState();
    return parsed;
  } catch (error) {
    console.error('Failed to migrate state from localStorage', error);
    return null;
  }
}

export async function saveAppState(data) {
  await ensureMigrated();
  await db.appState.put({
    id: APP_STATE_ID,
    data,
    updatedAt: Date.now(),
  });
}

export async function loadExcelSheets() {
  await ensureMigrated();
  const row = await db.excelSheets.get(EXCEL_SHEETS_ID);
  return row?.data ?? null;
}

export async function saveExcelSheets(allSheetsJSON) {
  await ensureMigrated();
  if (!allSheetsJSON) {
    await db.excelSheets.delete(EXCEL_SHEETS_ID);
    return;
  }

  await db.excelSheets.put({
    id: EXCEL_SHEETS_ID,
    data: allSheetsJSON,
    updatedAt: Date.now(),
  });
}

export async function clearAllData() {
  await ensureMigrated();
  await db.transaction('rw', db.appState, db.excelSheets, async () => {
    await db.appState.delete(APP_STATE_ID);
    await db.excelSheets.delete(EXCEL_SHEETS_ID);
  });
  clearLegacyLocalStorageState();
}

export async function exportAllData() {
  const [state, allSheetsJSON] = await Promise.all([
    loadAppState(),
    loadExcelSheets(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Orario',
    state,
    allSheetsJSON,
  };
}

export async function importAllData(payload) {
  if (!payload || !VALID_APP_NAMES.includes(payload.app)) {
    throw new Error('Invalid Orario backup file.');
  }

  if (payload.state) {
    const s = payload.state;
    if (s.attendance && (typeof s.attendance !== 'object' || Array.isArray(s.attendance))) {
      throw new Error('Invalid backup file: attendance must be an object');
    }
    if (s.holidays && !Array.isArray(s.holidays)) {
      throw new Error('Invalid backup file: holidays must be an array');
    }
    if (s.timetableSchedule && (typeof s.timetableSchedule !== 'object' || Array.isArray(s.timetableSchedule))) {
      throw new Error('Invalid backup file: timetableSchedule must be an object');
    }
    if (s.semester && (typeof s.semester !== 'object' || Array.isArray(s.semester))) {
      throw new Error('Invalid backup file: semester must be an object');
    }
    if (s.classes && !Array.isArray(s.classes)) {
      throw new Error('Invalid backup file: classes must be an array');
    }
    
    await saveAppState(payload.state);
  }

  if (payload.allSheetsJSON) {
    if (typeof payload.allSheetsJSON !== 'object' || Array.isArray(payload.allSheetsJSON)) {
      throw new Error('Invalid backup file: allSheetsJSON must be an object');
    }
    await saveExcelSheets(payload.allSheetsJSON);
  } else {
    await saveExcelSheets(null);
  }
}

export function downloadJsonBackup(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      if (import.meta.env.DEV) {
        console.log(`[Storage] Persistent storage granted: ${isPersisted}`);
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          console.log(`[Storage] Usage: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB of ${(estimate.quota / 1024 / 1024).toFixed(2)} MB`);
        }
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('[Storage] navigator.storage API unsupported on this browser.');
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Storage] Error requesting persistent storage:', error);
    }
  }
}
