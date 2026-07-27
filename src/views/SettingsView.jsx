import React, { useContext, useRef, useState } from 'react';
import { AppContext } from '../App';
import LocationPicker from '../components/LocationPicker';
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
import { Moon, Sun, Bell, Calendar, Save, Upload, Trash2, Plus, X, Check, MapPin, Locate, Download, FileUp, Clock } from 'lucide-react';
import { DEFAULT_DAILY_REMINDER_TIME, DEFAULT_REVIEW_DELAY_MINUTES, REVIEW_REMINDER_DELAYS } from '../services/ReminderService';

const VESIT_LOCATION = { lat: 19.045701, lng: 72.889137 };
const DEFAULT_SMART_RADIUS = 200;

export default function SettingsView() {
  const { state, updateState, theme, setTheme, colorTheme, setColorTheme } = useContext(AppContext);
  const fileInputRef = useRef(null);
  const holidayInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderDraft, setReminderDraft] = useState(state.smartAttendance?.reviewReminderDelayMinutes ?? DEFAULT_REVIEW_DELAY_MINUTES);
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

    try {
      const result = await previewExcelFile(file, state.classes);
      setExcelPreview(result);
      setPendingFile(file);
    } catch (err) {
      console.error(err);
      showNotice('Upload Failed', 'Error parsing Excel file.');
    }
  };

  const confirmExcelImport = async () => {
    if (!excelPreview || !pendingFile) return;

    try {
      updateState({
        sheetNames: excelPreview.sheetNames,
        selectedSheet: excelPreview.selectedSheet,
        selectedAllocSheet: excelPreview.selectedAllocSheet,
        subjectMappings: excelPreview.subjectMappings,
        timetableSchedule: excelPreview.timetableSchedule,
        classes: excelPreview.classes,
        lastUploadedFile: excelPreview.fileName,
        rawTimetable: excelPreview.rawTimetable
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
      await importAllData(payload);
      showNotice('Backup Imported', 'Reloading Orario now...', () => window.location.reload());
    } catch (error) {
      console.error(error);
      showNotice('Import Failed', 'Please choose a valid Orario JSON file.');
    }
  };

  const subjects = state.selectedClass && state.subjectMappings?.[state.selectedClass]
    ? Object.entries(state.subjectMappings[state.selectedClass])
    : [];

  const closeLocationSetup = () => {
    setShowLocationSetup(false);
    setShowManualLocation(false);
  };

  const saveCollegeLocation = (location) => {
    updateState({
      smartAttendance: {
        ...state.smartAttendance,
        enabled: true,
        collegeLocation: location,
        radius: state.smartAttendance?.radius || DEFAULT_SMART_RADIUS,
        reviewReminderEnabled: state.smartAttendance?.reviewReminderEnabled ?? true,
        reviewReminderDelayMinutes: state.smartAttendance?.reviewReminderDelayMinutes ?? DEFAULT_REVIEW_DELAY_MINUTES,
      }
    });
    closeLocationSetup();
    showNotice('Location Saved', 'College location saved successfully.');
  };

  const handleSetVesitLocation = () => {
    saveCollegeLocation(VESIT_LOCATION);
  };

  const requestLocationAccess = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const showLocationPermissionHelp = () => {
    showNotice(
      'Location Permission Needed',
      'Allow location for Orario in your browser/app settings, then come back and tap Enable again. Android: site settings > location. iOS: Settings > Safari or browser > Location.'
    );
  };

  const showNotificationPermissionHelp = () => {
    showNotice(
      'Notification Permission Needed',
      'Allow notifications for Orario in your browser/app settings, then come back and tap Enable again.'
    );
  };

  const requestNotificationAccess = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const handleReviewReminderToggle = async () => {
    const currentValue = state.smartAttendance?.reviewReminderEnabled ?? true;
    if (currentValue) {
      updateState({
        smartAttendance: {
          ...state.smartAttendance,
          reviewReminderEnabled: false,
        }
      });
      return;
    }

    const hasAccess = await requestNotificationAccess();
    if (!hasAccess) {
      showNotificationPermissionHelp();
      return;
    }

    updateState({
      smartAttendance: {
        ...state.smartAttendance,
        reviewReminderEnabled: true,
        reviewReminderDelayMinutes: state.smartAttendance?.reviewReminderDelayMinutes ?? DEFAULT_REVIEW_DELAY_MINUTES,
      }
    });
    setShowReminderSettings(true);
  };

  const handleDailyReminderToggle = async () => {
    const currentValue = Boolean(state.dailyReminder?.enabled);
    if (currentValue) {
      updateState({
        dailyReminder: {
          ...state.dailyReminder,
          enabled: false,
          time: state.dailyReminder?.time || DEFAULT_DAILY_REMINDER_TIME,
        },
      });
      return;
    }

    const hasAccess = await requestNotificationAccess();
    if (!hasAccess) {
      showNotificationPermissionHelp();
      return;
    }

    updateState({
      dailyReminder: {
        ...state.dailyReminder,
        enabled: true,
        time: state.dailyReminder?.time || DEFAULT_DAILY_REMINDER_TIME,
      },
    });
  };

  const handleDailyReminderTimeChange = (event) => {
    updateState({
      dailyReminder: {
        ...state.dailyReminder,
        time: event.target.value || DEFAULT_DAILY_REMINDER_TIME,
      },
    });
  };

  const openReminderSettings = () => {
    setReminderDraft(state.smartAttendance?.reviewReminderDelayMinutes ?? DEFAULT_REVIEW_DELAY_MINUTES);
    setShowReminderSettings(true);
  };

  const saveReminderSettings = () => {
    const allowedDelays = REVIEW_REMINDER_DELAYS.map((option) => option.value);
    const minutes = allowedDelays.includes(Number(reminderDraft)) ? Number(reminderDraft) : DEFAULT_REVIEW_DELAY_MINUTES;
    updateState({
      smartAttendance: {
        ...state.smartAttendance,
        reviewReminderDelayMinutes: minutes,
      }
    });
    setReminderDraft(minutes);
    setShowReminderSettings(false);
  };

  const handleSmartAttendanceToggle = async () => {
    if (state.smartAttendance?.enabled) {
      updateState({ smartAttendance: { ...state.smartAttendance, enabled: false } });
      return;
    }

    const hasLocationAccess = await requestLocationAccess();
    if (!hasLocationAccess) {
      showLocationPermissionHelp();
      return;
    }

    setShowLocationSetup(true);
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
            <span className="text-body-md text-on-surface font-bold">Daily Reminder</span>
            <span className="text-label-sm text-on-surface-variant">
              {state.dailyReminder?.enabled
                ? `On at ${state.dailyReminder?.time || DEFAULT_DAILY_REMINDER_TIME}`
                : 'Off'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="voxel-input w-32 text-label-sm font-bold"
              value={state.dailyReminder?.time || DEFAULT_DAILY_REMINDER_TIME}
              onChange={handleDailyReminderTimeChange}
              aria-label="Daily reminder time"
            />
            <button
              className={`voxel-btn-secondary text-label-sm flex items-center gap-2 font-bold ${state.dailyReminder?.enabled ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
              onClick={handleDailyReminderToggle}
            >
              <Bell size={16} />
              {state.dailyReminder?.enabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </div>

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

      {/* Smart Attendance Section */}
      <section id="tour-gps-settings" className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-6 scroll-mt-6">
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
            onClick={handleSmartAttendanceToggle}
          >
            {state.smartAttendance?.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {state.smartAttendance?.enabled && (
          <div className="flex flex-col gap-4 p-4 border-2 border-outline bg-surface-container-lowest shadow-[3px_3px_0px_var(--color-outline)]">
            {/* GPS Status Indicator */}
            <div className="flex flex-col gap-2 p-3 border-2 border-outline bg-surface-container">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">GPS Status</label>
              {(() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const checks = state.smartAttendance?.lastChecks || {};
                const todayChecks = Object.values(checks).filter(c => c.key?.startsWith(todayStr));
                const mostRecentCheck = todayChecks[todayChecks.length - 1];
                
                if (!mostRecentCheck || (!mostRecentCheck.startChecked && !mostRecentCheck.endChecked)) {
                  return (
                    <span className="text-xs text-on-surface-variant">
                      Waiting for scheduled lecture...
                    </span>
                  );
                }
                
                const status = mostRecentCheck.entryStatus || mostRecentCheck.exitStatus;
                const confidence = mostRecentCheck.entryConfidence || mostRecentCheck.exitConfidence;
                
                const getStatusColor = (conf) => {
                  switch (conf) {
                    case 'HIGH': return 'text-secondary';
                    case 'MEDIUM': return 'text-primary';
                    case 'LOW': return 'text-orange-500';
                    case 'NONE': return 'text-error';
                    default: return 'text-on-surface-variant';
                  }
                };
                
                return (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface">{status}</span>
                    <span className={`text-[10px] font-bold uppercase ${getStatusColor(confidence)}`}>
                      Confidence: {confidence}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">College Location</label>
              {state.smartAttendance?.collegeLocation?.lat ? (
                <span className="text-xs text-primary font-mono">
                  Saved: {state.smartAttendance.collegeLocation.lat.toFixed(5)}, {state.smartAttendance.collegeLocation.lng.toFixed(5)}
                </span>
              ) : (
                <span className="text-xs text-error font-mono">Not set</span>
              )}
              <button
                className="voxel-btn-secondary flex items-center justify-center gap-2 text-label-sm mt-1"
                onClick={() => setShowLocationSetup(true)}
              >
                <MapPin size={16} /> Change College Location
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Radius (meters)</label>
              <input
                type="number"
                className="voxel-input w-full"
                value={state.smartAttendance?.radius || DEFAULT_SMART_RADIUS}
                onChange={(e) => updateState({ smartAttendance: { ...state.smartAttendance, radius: parseInt(e.target.value) || DEFAULT_SMART_RADIUS } })}
              />
            </div>

            <div className="border-t border-outline/10 pt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-body-md text-on-surface font-bold">Review Attendance Reminder</span>
                  <span className="text-label-sm text-on-surface-variant">
                    {state.smartAttendance?.reviewReminderEnabled === false
                      ? 'Off'
                      : `${state.smartAttendance?.reviewReminderDelayMinutes ?? DEFAULT_REVIEW_DELAY_MINUTES} min after final lecture`}
                  </span>
                </div>
                <button
                  className={`voxel-btn-secondary text-label-sm flex items-center gap-2 font-bold ${state.smartAttendance?.reviewReminderEnabled === false ? 'bg-surface-container text-on-surface' : 'bg-primary-container text-on-primary-container'}`}
                  onClick={handleReviewReminderToggle}
                >
                  <Bell size={16} />
                  {state.smartAttendance?.reviewReminderEnabled === false ? 'Enable' : 'Enabled'}
                </button>
              </div>

              {state.smartAttendance?.reviewReminderEnabled !== false && (
                <button
                  type="button"
                  className="voxel-btn-secondary text-label-sm flex items-center justify-center gap-2 font-bold"
                  onClick={openReminderSettings}
                >
                  <Clock size={16} />
                  Reminder Delay
                </button>
              )}
            </div>

            <div className="mt-2 p-3 bg-primary-container/20 border-l-4 border-primary text-xs text-on-surface-variant">
              <strong>Privacy Note:</strong> Orario only checks your location at scheduled lecture start and end times. The review reminder is scheduled locally from your timetable and does not track location.
            </div>
          </div>
        )}
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

      {showReminderSettings && (
        <div className="fixed inset-0 z-[85] bg-black/50 px-4 py-8 flex items-center justify-center">
          <div className="voxel-card w-full max-w-sm p-5 bg-surface flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0">
                  <Clock size={18} className="text-on-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-body-md text-on-surface font-header uppercase">Review Reminder</h3>
                  <p className="text-label-sm text-on-surface-variant mt-1 leading-5">
                    Choose how long after the final scheduled lecture Orario should ask you to review attendance.
                  </p>
                </div>
              </div>
              <button
                className="border-2 border-outline bg-surface-container w-9 h-9 flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0"
                onClick={() => setShowReminderSettings(false)}
                aria-label="Close review reminder settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {REVIEW_REMINDER_DELAYS.map((option) => {
                const minutes = option.value;
                const isActive = Number(reminderDraft) === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    className={`border-2 border-outline px-2 py-2 text-label-sm font-black shadow-[2px_2px_0px_var(--color-outline)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'}`}
                    onClick={() => setReminderDraft(minutes)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button className="voxel-btn-secondary text-label-sm" onClick={() => setShowReminderSettings(false)}>
                Cancel
              </button>
              <button className="voxel-btn-primary text-label-sm" onClick={saveReminderSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocationSetup && (
        <div className="fixed inset-0 z-[80] bg-black/50 px-4 py-8 flex items-center justify-center">
          <div className="voxel-card w-full max-w-md max-h-[88vh] overflow-y-auto p-5 flex flex-col gap-4 bg-surface">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-body-md text-on-surface font-header uppercase">Set College Location</h3>
                <p className="text-label-sm text-on-surface-variant mt-1">
                  Choose one option to enable Smart Attendance.
                </p>
              </div>
              <button
                className="border-2 border-outline bg-surface-container w-9 h-9 flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0"
                onClick={closeLocationSetup}
                aria-label="Close location setup"
              >
                <X size={16} />
              </button>
            </div>

            <button className="voxel-btn-secondary flex items-center justify-center gap-2" onClick={handleSetVesitLocation}>
              <MapPin size={18} /> Option 1: VESIT
            </button>
            <span className="text-[10px] text-on-surface-variant font-mono text-center">
              19.045701, 72.889137
            </span>

            <button
              className="voxel-btn-secondary flex items-center justify-center gap-2"
              onClick={() => setShowManualLocation((current) => !current)}
            >
              <Locate size={18} /> Option 2: Set Manually
            </button>

            {showManualLocation && (
              <LocationPicker
                value={state.smartAttendance?.collegeLocation}
                onSave={saveCollegeLocation}
              />
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
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input type="date" id="sem-start" defaultValue={state.semester?.start} className="voxel-input w-full pl-10 min-w-0" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input type="date" id="sem-end" defaultValue={state.semester?.end} className="voxel-input w-full pl-10 min-w-0" />
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
        <div className="flex gap-2 items-center">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
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
