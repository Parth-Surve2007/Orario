import React, { useContext, useRef, useState } from 'react';
import { AppContext } from '../App';
import ExcelPreviewModal from '../components/ExcelPreviewModal';
import { processExcelFile, previewExcelFile } from '../utils/excelParser';
import { THEMES } from '../utils/themes';
import {
  clearAllData,
  downloadJsonBackup,
  exportAllData,
  importAllData,
  saveExcelSheets,
} from '../utils/db';
import { Moon, Sun, Bell, Calendar, Save, Upload, Trash2, Plus, X, Check, Download, FileUp } from 'lucide-react';


export default function SettingsView() {
  const { state, updateState, theme, setTheme, colorTheme, setColorTheme } = useContext(AppContext);
  const fileInputRef = useRef(null);
  const holidayInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const selectedColorTheme = THEMES[colorTheme] || Object.values(THEMES)[0];

  const closeDialog = () => {
    const action = dialog?.onClose;
    setDialog(null);
    action?.();
  };

  const showNotice = (title, message, onClose) => {
    setDialog({ type: 'notice', title, message, onClose });
  };

  const showConfirm = (title, message, onConfirm) => {
    setDialog({ type: 'confirm', title, message, onConfirm });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      showNotice('File Too Large', 'The file exceeds 10MB. Please use a smaller Excel file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const result = await previewExcelFile(file, state.classes);
      setExcelPreview(result);
      setPendingFile(file);
    } catch (err) {
      console.error(err);
      showNotice('Upload Failed', 'Error parsing Excel file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmExcelImport = async (effectiveFrom) => {
    if (!excelPreview || !pendingFile) return;

    try {
      const uploadedAt = effectiveFrom || new Date().toISOString().split('T')[0];
      const prevVersions = Array.isArray(state.timetableVersions) ? state.timetableVersions : [];

      // Migration: if no versions exist yet but we already have an old schedule,
      // preserve it as the "from the beginning" version so past dates still show it.
      let baseVersions = prevVersions;
      if (prevVersions.length === 0 && state.timetableSchedule && Object.keys(state.timetableSchedule).length > 0) {
        baseVersions = [{ uploadedAt: '1900-01-01', schedule: state.timetableSchedule }];
      }

      // If there's already a version for this date, replace it; otherwise append
      const versionsWithoutDate = baseVersions.filter(v => v.uploadedAt !== uploadedAt);
      const newVersions = [
        ...versionsWithoutDate,
        { uploadedAt, schedule: excelPreview.timetableSchedule }
      ].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));

      // Always set timetableSchedule to the LATEST version
      const latestSchedule = newVersions[newVersions.length - 1].schedule;

      updateState({
        sheetNames: excelPreview.sheetNames,
        selectedSheet: excelPreview.selectedSheet,
        selectedAllocSheet: excelPreview.selectedAllocSheet,
        subjectMappings: excelPreview.subjectMappings,
        timetableSchedule: latestSchedule,
        classes: excelPreview.classes,
        lastUploadedFile: excelPreview.fileName,
        rawTimetable: excelPreview.rawTimetable,
        timetableVersions: newVersions,
      });

      await saveExcelSheets(excelPreview.allSheetsJSON);

      setExcelPreview(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      showNotice('Upload Complete', `Detected ${excelPreview.classes.length} classes.`);
    } catch (err) {
      console.error(err);
      showNotice('Upload Failed', 'Error saving Excel file.');
    }
  };

  const cancelExcelImport = () => {
    setExcelPreview(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClassChange = (e) => {
    updateState({ selectedClass: e.target.value.toUpperCase() });
  };

  const handleBatchChange = (e) => {
    updateState({ selectedBatch: e.target.value });
  };

  const saveSemesterDates = () => {
    const start = document.getElementById('sem-start').value;
    const end = document.getElementById('sem-end').value;
    if (!start || !end) return showNotice('Missing Dates', 'Fill both dates.');
    updateState({ semester: { start, end } });
    showNotice('Settings Saved', 'Semester dates saved successfully.');
  };

  const addHoliday = () => {
    const date = holidayInputRef.current?.value;
    if (!date) return showNotice('Pick a Date', 'Pick a date first.');
    if ((state.holidays || []).includes(date)) return showNotice('Already Added', 'This holiday is already in your list.');
    updateState({ holidays: [...(state.holidays || []), date].sort() });
    holidayInputRef.current.value = '';
  };

  const removeHoliday = (date) => {
    updateState({ holidays: (state.holidays || []).filter(d => d !== date) });
  };

  const resetApp = async () => {
    showConfirm(
      'Clear All Data?',
      'This action cannot be undone. Orario will reset and reload.',
      async () => {
        await clearAllData();
        window.location.reload();
      }
    );
  };

  const handleExportData = async () => {
    try {
      const payload = await exportAllData();
      const date = new Date().toISOString().slice(0, 10);
      downloadJsonBackup(payload, `orario-backup-${date}.json`);
    } catch (error) {
      console.error(error);
      showNotice('Export Failed', 'Failed to export data.');
    }
  };

  const handleImportData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      // Validate payload structure before importing
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid file format');
      }

      if (!payload.app || typeof payload.app !== 'string') {
        throw new Error('Invalid backup file: missing app identifier');
      }

      // Import the data
      await importAllData(payload);

      showNotice('Backup Imported', 'Reloading Orario now...', () => window.location.reload());
    } catch (error) {
      console.error(error);
      let errorMessage = 'Please choose a valid Orario JSON file.';

      if (error.message.includes('Invalid Orario backup file')) {
        errorMessage = 'This is not a valid Orario backup file.';
      } else if (error.message.includes('Invalid file format')) {
        errorMessage = 'The file is not valid JSON.';
      } else if (error.message.includes('missing app identifier')) {
        errorMessage = 'The backup file is corrupted or invalid.';
      }

      showNotice('Import Failed', errorMessage);
    }
  };

  const subjects = state.selectedClass && state.subjectMappings?.[state.selectedClass]
    ? Object.entries(state.subjectMappings[state.selectedClass])
    : [];

  const handleAttendanceReminderToggle = () => {
    const currentValue = Boolean(state.attendanceReminder?.enabled);
    updateState({
      attendanceReminder: {
        enabled: !currentValue
      }
    });
  };


  return (
    <div className="flex flex-col gap-6 w-full">

      {/* Preferences Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4">
        <h2 className="text-headline-lg-mobile text-on-surface font-header">Preferences</h2>

        <div className="flex items-center justify-between py-2 border-b border-outline/10">
          <div className="flex flex-col">
            <span className="text-body-md text-on-surface font-bold">Dark Mode</span>
            <span className="text-label-sm text-on-surface-variant">Toggle dark voxel world</span>
          </div>
          <button
            className={`border-2 border-outline p-3 flex items-center justify-center transition-all shadow-[2px_2px_0px_var(--color-outline)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--color-outline)] ${theme === 'dark' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="flex flex-col gap-3 py-2 border-b border-outline/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-body-md text-on-surface font-bold">Attendance Reminder</span>
            <span className="text-label-sm text-on-surface-variant">
              {state.attendanceReminder?.enabled ? 'On' : 'Off'}
            </span>
          </div>
          <button
            className={`voxel-btn-secondary text-label-sm flex items-center gap-2 font-bold ${state.attendanceReminder?.enabled ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
            onClick={handleAttendanceReminderToggle}
          >
            <Bell size={16} />
            {state.attendanceReminder?.enabled ? 'Enabled' : 'Enable'}
          </button>
        </div>

        {state.attendanceReminder?.enabled && (
          <div className="voxel-card bg-surface-container-lowest p-4 border border-outline/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary border-2 border-outline flex items-center justify-center shrink-0">
                <Bell size={16} className="text-on-primary" />
              </div>
              <div>
                <h4 className="text-label-sm font-bold text-on-surface uppercase tracking-wider mb-1">How it works</h4>
                <p className="text-label-sm text-on-surface-variant leading-5">
                  Whenever you open Orario, it automatically checks today's timetable for lectures whose attendance hasn't been marked yet.
                </p>
                <p className="text-label-sm text-on-surface-variant leading-5 mt-2">
                  Everything works completely offline. No notifications. No background tracking. No location access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Colour Theme Picker ── */}
        <div className="pt-2">
          <span className="text-body-md text-on-surface font-bold block mb-1">Colour Theme</span>
          <span className="text-label-sm text-on-surface-variant block mb-4">Select voxel dimension theme</span>
          <div className="border-2 border-outline bg-surface-container-lowest shadow-[3px_3px_0px_var(--color-outline)] p-3 flex items-center gap-3">
            <div className="flex shrink-0 border border-outline">
              {selectedColorTheme.preview.map((col, i) => (
                <span
                  key={i}
                  className="w-5 h-5 border-r last:border-r-0 border-outline shadow-sm"
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
            <select
              value={colorTheme}
              onChange={(event) => setColorTheme(event.target.value)}
              className="neo-input flex-1 min-w-0 bg-transparent border-0 shadow-none p-0 text-label-sm font-bold text-on-surface uppercase tracking-wider focus:ring-0"
              aria-label="Colour theme"
            >
              {Object.entries(THEMES).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
            <span className="w-5 h-5 bg-primary border-2 border-outline flex items-center justify-center shadow-[1px_1px_0px_var(--color-outline)] shrink-0">
              <Check size={12} className="text-on-primary" />
            </span>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2 pl-1">
            {selectedColorTheme.description}
          </p>
        </div>
      </section>

      {dialog && (
        <div className="fixed inset-0 z-[90] bg-black/50 px-4 py-8 flex items-center justify-center">
          <div className="voxel-card w-full max-w-sm p-5 bg-surface flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0">
                {dialog.type === 'confirm' ? <Trash2 size={18} className="text-on-primary" /> : <Check size={18} className="text-on-primary" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-body-md text-on-surface font-header uppercase">{dialog.title}</h3>
                <p className="text-label-sm text-on-surface-variant mt-1 leading-5">{dialog.message}</p>
              </div>
            </div>

            {dialog.type === 'confirm' ? (
              <div className="grid grid-cols-2 gap-3">
                <button className="voxel-btn-secondary text-label-sm" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button
                  className="voxel-btn-primary text-label-sm"
                  onClick={() => {
                    const action = dialog.onConfirm;
                    setDialog(null);
                    action?.();
                  }}
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button className="voxel-btn-primary text-label-sm" onClick={closeDialog}>
                OK
              </button>
            )}
          </div>
        </div>
      )}


      {/* Setup Section */}
      <section id="tour-setup-dates" className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-6 scroll-mt-6 overflow-hidden">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1">Setup</h2>
          <p className="text-body-md text-on-surface-variant">Configure your semester dates to initialize attendance tracking.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Start Date</label>
            <input type="date" id="sem-start" defaultValue={state.semester?.start} className="voxel-input w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">End Date</label>
            <input type="date" id="sem-end" defaultValue={state.semester?.end} className="voxel-input w-full" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="voxel-btn-primary flex items-center gap-2" onClick={saveSemesterDates}>
            <Save size={18} /> Save Settings
          </button>
        </div>
      </section>

      {/* Upload Timetable Section */}
      <section id="tour-upload-file" className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-5 scroll-mt-6 overflow-hidden">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1">Upload Timetable</h2>
          <p className="text-body-md text-on-surface-variant">
            {state.lastUploadedFile
              ? <span><span className="font-bold text-on-surface">Active:</span> <span className="font-normal text-on-surface-variant">{state.lastUploadedFile}</span></span>
              : 'Import your class schedule to begin tracking attendance.'}
          </p>
        </header>

        <div className="flex flex-col gap-4">

          {/* Sheet selectors */}
          {state.sheetNames && state.sheetNames.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Timetable Sheet</label>
                <select
                  className="voxel-input w-full"
                  value={state.selectedSheet || ''}
                  onChange={e => updateState({ selectedSheet: e.target.value })}
                >
                  {state.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Allocation Sheet</label>
                <select
                  className="voxel-input w-full"
                  value={state.selectedAllocSheet || ''}
                  onChange={e => updateState({ selectedAllocSheet: e.target.value })}
                >
                  <option value="">-- Auto-detect --</option>
                  {state.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Class Name Input */}
          <div id="tour-class-select" className="flex flex-col gap-2 scroll-mt-6">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Class Name (e.g. DIEC)</label>
            <input
              type="text"
              className="voxel-input w-full uppercase"
              value={state.selectedClass || ''}
              onChange={handleClassChange}
              placeholder="Enter class name"
            />
          </div>

          {/* Batch Select */}
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Select Batch</label>
            <select
              className="voxel-input w-full"
              value={state.selectedBatch || ''}
              onChange={handleBatchChange}
            >
              <option value="">-- All Batches --</option>
              <option value="B1">Batch 1 (B1)</option>
              <option value="B2">Batch 2 (B2)</option>
              <option value="B3">Batch 3 (B3)</option>
            </select>
          </div>

          {/* PCE Batch Select */}
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">PCE Batch (If Different)</label>
            <select
              className="voxel-input w-full"
              value={state.selectedPceBatch || ''}
              onChange={e => updateState({ selectedPceBatch: e.target.value })}
            >
              <option value="">-- Follow Main Batch --</option>
              <option value="B1">Batch 1 (B1)</option>
              <option value="B2">Batch 2 (B2)</option>
              <option value="B3">Batch 3 (B3)</option>
            </select>
          </div>

          {/* Detected classes dropdown */}
          {state.classes && state.classes.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Or select detected class</label>
              <select
                className="voxel-input w-full"
                value={state.selectedClass || ''}
                onChange={handleClassChange}
              >
                <option value="">-- Select --</option>
                {state.classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* File Upload Zone (Tactile Gaming Zone Style) */}
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Timetable File</label>
            <div
              className="w-full border-4 border-dashed border-outline bg-surface-container-lowest p-8 flex flex-col items-center justify-center cursor-pointer shadow-[2px_2px_0px_var(--color-outline)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_var(--color-outline)] transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="text-outline mb-3 animate-bounce" size={36} />
              <p className="text-body-md text-on-surface font-bold text-center">Drag & drop your Excel file here</p>
              <p className="text-label-sm text-on-surface-variant text-center mt-1">or click to browse (.xlsx, .xls)</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Detected Subjects List */}
        {subjects.length > 0 && (
          <div className="mt-2">
            <label className="text-label-sm text-secondary uppercase tracking-wider mb-3 block font-bold">
              Detected Subjects ({state.selectedClass})
            </label>
            <div className="voxel-card p-4 flex flex-col divide-y divide-outline/10">
              {subjects.map(([subject, teacher]) => (
                <div key={subject} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                  <span className="text-body-md font-bold text-on-surface">{subject}</span>
                  <span className="text-label-sm text-on-surface-variant ml-4 text-right font-bold">{teacher}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Holidays Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-headline-lg-mobile text-on-surface font-header">Holidays</h3>
          <span className="text-label-sm text-on-surface-variant font-bold border-2 border-outline px-2 py-1 bg-surface-container-lowest">
            {(state.holidays || []).length}
          </span>
        </div>

        {/* Add holiday row */}
        <div className="flex flex-col gap-2">
          <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Add Holiday</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              ref={holidayInputRef}
              className="voxel-input flex-1 min-w-0"
            />
            <button
              className="voxel-btn-primary flex items-center gap-1 font-bold shrink-0"
              onClick={addHoliday}
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* Holiday list */}
        <div className="flex flex-col divide-y divide-outline/10 max-h-28 overflow-y-auto pr-1">
          {(state.holidays || []).length === 0
            ? <p className="text-label-sm text-on-surface-variant py-3 font-bold">No holidays added.</p>
            : (state.holidays || []).map(d => (
              <div key={d} className="flex justify-between items-center py-3">
                <span className="text-body-md text-on-surface font-bold">{d}</span>
                <button
                  className="w-8 h-8 border-2 border-red-500 bg-red-500/10 text-red-500 flex items-center justify-center shadow-[2px_2px_0px_rgba(239,68,68,1)] hover:bg-red-500/20 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_rgba(239,68,68,1)]"
                  onClick={() => removeHoliday(d)}
                >
                  <X size={16} />
                </button>
              </div>
            ))
          }
        </div>
      </section>

      {/* Backup Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1">Backup & Restore</h2>
          <p className="text-body-md text-on-surface-variant">
            Export your attendance data to move it to another phone, or restore from a previous backup.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="voxel-btn-primary flex items-center justify-center gap-2 flex-1"
            onClick={handleExportData}
          >
            <Download size={18} /> Export Data
          </button>
          <button
            type="button"
            className="voxel-btn-secondary flex items-center justify-center gap-2 flex-1"
            onClick={() => backupInputRef.current?.click()}
          >
            <FileUp size={18} /> Import Data
          </button>
          <input
            type="file"
            ref={backupInputRef}
            accept="application/json,.json"
            onChange={handleImportData}
            className="hidden"
          />
        </div>
      </section>

      {/* Reset Section */}
      <section className="border-2 border-red-500 bg-red-500/10 p-6 w-9/10 mx-auto flex flex-col gap-3 shadow-[2px_2px_0px_rgba(239,68,68,1)]">
        <h3 className="text-headline-lg-mobile text-red-500 font-header mb-2 font-bold">Reset</h3>
        <p className="text-body-md text-red-500/80 mb-4 font-medium">Clear all app data and start fresh. This action cannot be undone.</p>
        <button
          className="w-fit border-2 border-red-700 bg-red-600 text-white px-6 py-3 font-bold shadow-[2px_2px_0px_rgba(153,27,27,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_rgba(153,27,27,1)]"
          onClick={resetApp}
        >
          <Trash2 size={18} /> Reset All Data
        </button>
      </section>

      {/* Excel Preview Modal */}
      {excelPreview && (
        <ExcelPreviewModal
          previewData={excelPreview}
          onConfirm={confirmExcelImport}
          onCancel={cancelExcelImport}
        />
      )}
    </div>
  );
}
