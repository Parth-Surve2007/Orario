import React, { useContext, useRef } from 'react';
import { AppContext } from '../App';
import { processExcelFile } from '../utils/excelParser';
import { THEMES } from '../utils/themes';
import {
  clearAllData,
  downloadJsonBackup,
  exportAllData,
  importAllData,
  saveExcelSheets,
} from '../utils/db';
import { Moon, Sun, Bell, BellOff, Calendar, Save, Upload, Trash2, Plus, X, Check, MapPin, Locate, Download, FileUp } from 'lucide-react';

export default function SettingsView() {
  const { state, updateState, theme, setTheme, colorTheme, setColorTheme } = useContext(AppContext);
  const fileInputRef = useRef(null);
  const holidayInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await processExcelFile(file, state.classes);

      updateState({
        sheetNames: result.sheetNames,
        selectedSheet: result.selectedSheet,
        selectedAllocSheet: result.selectedAllocSheet,
        subjectMappings: result.subjectMappings,
        timetableSchedule: result.timetableSchedule,
        classes: result.classes,
        lastUploadedFile: result.fileName,
        rawTimetable: result.rawTimetable
      });

      await saveExcelSheets(result.allSheetsJSON);

      alert(`File uploaded! Detected ${result.classes.length} classes.`);
    } catch (err) {
      console.error(err);
      alert('Error parsing Excel file.');
    }
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
    if (!start || !end) return alert('Fill both dates');
    updateState({ semester: { start, end } });
    alert('Saved semester dates!');
  };

  const addHoliday = () => {
    const date = holidayInputRef.current?.value;
    if (!date) return alert('Pick a date first.');
    if ((state.holidays || []).includes(date)) return alert('Already added.');
    updateState({ holidays: [...(state.holidays || []), date].sort() });
    holidayInputRef.current.value = '';
  };

  const removeHoliday = (date) => {
    updateState({ holidays: (state.holidays || []).filter(d => d !== date) });
  };

  const resetApp = async () => {
    if (confirm('Clear all app data and start fresh? This action cannot be undone.')) {
      await clearAllData();
      window.location.reload();
    }
  };

  const handleExportData = async () => {
    try {
      const payload = await exportAllData();
      const date = new Date().toISOString().slice(0, 10);
      downloadJsonBackup(payload, `orario-backup-${date}.json`);
    } catch (error) {
      console.error(error);
      alert('Failed to export data.');
    }
  };

  const handleImportData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importAllData(payload);
      alert('Backup imported successfully. Reloading app...');
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Failed to import backup. Please choose a valid Orario JSON file.');
    }
  };

  const subjects = state.selectedClass && state.subjectMappings?.[state.selectedClass]
    ? Object.entries(state.subjectMappings[state.selectedClass])
    : [];

  const handleSetCollegeLocation = async () => {
    try {
      const { getCurrentLocation } = await import('../utils/geofence');
      const loc = await getCurrentLocation();
      if (loc) {
        updateState({
          smartAttendance: { ...state.smartAttendance, collegeLocation: loc }
        });
        alert('Location saved successfully!');
      } else {
        alert('Could not get location. Ensure permissions are granted.');
      }
    } catch (e) {
      alert('Error fetching location.');
    }
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

        <div className="flex items-center justify-between py-2 border-b border-outline/10">
          <div className="flex flex-col">
            <span className="text-body-md text-on-surface font-bold">Daily Reminders</span>
            <span className="text-label-sm text-on-surface-variant">Get notified for classes</span>
          </div>
          <button
            className={`voxel-btn-secondary text-label-sm flex items-center gap-2 font-bold ${state.notificationsEnabled ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
            onClick={() => updateState({ notificationsEnabled: !state.notificationsEnabled })}
          >
            {state.notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            {state.notificationsEnabled ? 'Enabled' : 'Enable'}
          </button>
        </div>

        {/* ── Colour Theme Picker ── */}
        <div className="pt-2">
          <span className="text-body-md text-on-surface font-bold block mb-1">Colour Theme</span>
          <span className="text-label-sm text-on-surface-variant block mb-4">Select voxel dimension theme</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(THEMES).map(([key, t]) => {
              const isActive = colorTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => setColorTheme(key)}
                  className={`relative flex items-center gap-3 p-3 border-2 transition-all text-left ${isActive
                    ? 'border-primary bg-primary-container/20 shadow-[3px_3px_0px_var(--color-primary)]'
                    : 'border-outline bg-surface-container-lowest shadow-[3px_3px_0px_var(--color-outline)] hover:border-primary/50'
                    }`}
                >
                  {/* Swatch squares (Voxel styled) */}
                  <div className="flex shrink-0 border border-outline">
                    {t.preview.map((col, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 border-r last:border-r-0 border-outline shadow-sm"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-label-sm font-bold text-on-surface block truncate">{t.label}</span>
                    <span className="text-[10px] text-on-surface-variant truncate block">{t.description}</span>
                  </div>
                  {isActive && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-primary border-2 border-outline flex items-center justify-center shadow-[1px_1px_0px_var(--color-outline)]">
                      <Check size={12} className="text-on-primary" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Smart Attendance Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-6">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1 flex items-center gap-2">
            <MapPin size={24} className="text-primary" /> Smart Attendance
          </h2>
          <p className="text-body-md text-on-surface-variant">Automatically mark attendance using geofencing during scheduled lectures.</p>
        </header>

        <div className="flex items-center justify-between py-2 border-b border-outline/10">
          <div className="flex flex-col">
            <span className="text-body-md text-on-surface font-bold">Enable Smart Attendance</span>
            <span className="text-label-sm text-on-surface-variant">Requires location permissions</span>
          </div>
          <button
            className={`voxel-btn-secondary text-label-sm flex items-center gap-2 font-bold ${state.smartAttendance?.enabled ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
            onClick={() => updateState({ smartAttendance: { ...state.smartAttendance, enabled: !state.smartAttendance?.enabled } })}
          >
            {state.smartAttendance?.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {state.smartAttendance?.enabled && (
          <div className="flex flex-col gap-4 p-4 border-2 border-outline bg-surface-container-lowest shadow-[3px_3px_0px_var(--color-outline)]">
            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">College Location</label>
              <div className="flex flex-col gap-2">
                <button className="voxel-btn-secondary flex items-center justify-center gap-2" onClick={handleSetCollegeLocation}>
                  <Locate size={18} /> Use Current Location
                </button>
                {state.smartAttendance?.collegeLocation?.lat ? (
                  <span className="text-xs text-primary font-mono text-center">
                    Saved: {state.smartAttendance.collegeLocation.lat.toFixed(5)}, {state.smartAttendance.collegeLocation.lng.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-xs text-error font-mono text-center">Not set</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Radius (meters)</label>
              <input
                type="number"
                className="voxel-input w-full"
                value={state.smartAttendance?.radius || 100}
                onChange={(e) => updateState({ smartAttendance: { ...state.smartAttendance, radius: parseInt(e.target.value) || 100 } })}
              />
            </div>

            <div className="mt-2 p-3 bg-primary-container/20 border-l-4 border-primary text-xs text-on-surface-variant">
              <strong>Privacy Note:</strong> Orario only checks your location at the exact scheduled start and end times of your classes. Location is stored locally and never uploaded.
            </div>
          </div>
        )}
      </section>

      {/* Setup Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-6">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1">Setup</h2>
          <p className="text-body-md text-on-surface-variant">Configure your semester dates to initialize attendance tracking.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input type="date" id="sem-start" defaultValue={state.semester?.start} className="voxel-input w-full pl-10" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input type="date" id="sem-end" defaultValue={state.semester?.end} className="voxel-input w-full pl-10" />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="voxel-btn-primary flex items-center gap-2" onClick={saveSemesterDates}>
            <Save size={18} /> Save Settings
          </button>
        </div>
      </section>

      {/* Upload Timetable Section */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-5">
        <header>
          <h2 className="text-headline-lg-mobile text-on-surface font-header mb-1">Upload Timetable</h2>
          <p className="text-body-md text-on-surface-variant">
            {state.lastUploadedFile
              ? <span>Active: <span className="font-bold text-on-surface">{state.lastUploadedFile}</span></span>
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
          <div className="flex flex-col gap-2">
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
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4">
        <h3 className="text-headline-lg-mobile text-on-surface font-header">Holidays</h3>

        {/* Add holiday row */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Add Holiday</label>
            <input
              type="date"
              ref={holidayInputRef}
              className="voxel-input w-full"
            />
          </div>
          <button
            className="voxel-btn-primary flex items-center gap-1 font-bold shrink-0"
            onClick={addHoliday}
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Holiday list */}
        <div className="flex flex-col divide-y divide-outline/10 max-h-[200px] overflow-y-auto">
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
    </div>
  );
}
