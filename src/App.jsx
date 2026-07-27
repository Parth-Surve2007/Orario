import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, CalendarDays, CheckSquare, BarChart2, Settings } from 'lucide-react';
import Dashboard from './views/Dashboard';
import Timetable from './views/Timetable';
import Tasks from './views/Tasks';
import Stats from './views/Stats';
import SettingsView from './views/SettingsView';
import ParticleBackground from './components/ParticleBackground';
import InstallPrompt from './components/InstallPrompt';
import { applyTheme, DEFAULT_THEME, getStoredThemeSnapshot } from './utils/themes';
import { useSmartAttendance } from './hooks/useSmartAttendance';
import { useReviewAttendanceReminder } from './hooks/useReviewAttendanceReminder';
import { useDailyReminder } from './hooks/useDailyReminder';
import { loadAppState, saveAppState } from './utils/db';
import { getLocalDateKey } from './utils/geofence';
import { DEFAULT_DAILY_REMINDER_TIME } from './services/ReminderService';

export const AppContext = React.createContext({});

const TOUR_STORAGE_KEY = 'orario_installed_tour_completed';

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

const TOUR_STEPS = [
  {
    title: 'Welcome to Orario',
    body: 'This quick tour will help you set up dates, upload your timetable, choose your class, enable GPS, and mark attendance.',
    view: 'dashboard',
  },
  {
    title: 'Step 1: Setup Dates',
    body: 'Go to Setup. Start date can be any valid semester day. Set the end date approximately 3 months after the start date, then save.',
    view: 'settings',
    targetId: 'tour-setup-dates',
  },
  {
    title: 'Step 2: Upload File',
    body: 'Upload your attendance/timetable Excel file here. Orario reads the timetable and allocation sheets from this file.',
    view: 'settings',
    targetId: 'tour-upload-file',
  },
  {
    title: 'Step 3: Choose Class',
    body: 'Enter your class manually, or select it from the detected classes after upload. Pick your batch if your timetable has batch labs.',
    view: 'settings',
    targetId: 'tour-class-select',
  },
  {
    title: 'Step 4: GPS Settings',
    body: 'Enable Smart Attendance here. Allow location permission, then choose VESIT or set your college location manually on the map.',
    view: 'settings',
    targetId: 'tour-gps-settings',
  },
  {
    title: 'Step 5: Mark Attendance',
    body: 'Back on Dashboard, use the tick or cross buttons for each lecture. You can also mark all present, all absent, or set a holiday.',
    view: 'dashboard',
    targetId: 'tour-mark-attendance',
  },
];

export default function App() {
  const initialThemeSnapshot = getStoredThemeSnapshot();
  const [currentView, setCurrentView] = useState('dashboard');
  const [theme, setTheme] = useState(initialThemeSnapshot?.theme || 'light');
  const [colorTheme, setColorTheme] = useState(initialThemeSnapshot?.colorTheme || DEFAULT_THEME);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOpening, setShowOpening] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // State from old app
  const [state, setState] = useState({
    timetable: null,
    attendance: {},
    extraLectures: [],
    holidays: [],
    semester: { start: '', end: '' },
    selectedClass: '',
    classes: [],
    tasks: [],
    dailyReminder: {
      enabled: false,
      time: DEFAULT_DAILY_REMINDER_TIME
    },
    smartAttendance: {
      enabled: false,
      collegeLocation: { lat: null, lng: null },
      radius: 200,
      lastChecks: {},
      reviewReminderEnabled: true,
      reviewReminderDelayMinutes: 30
    }
  });

  useEffect(() => {
    let cancelled = false;

    loadAppState()
      .then((saved) => {
        if (cancelled) return;

        if (saved) {
          const { theme: savedTheme, colorTheme: savedColorTheme, ...appState } = saved;
          setState((prev) => ({ ...prev, ...appState }));
          const isDark = savedTheme === 'dark';
          if (savedTheme) setTheme(savedTheme);
          if (savedColorTheme) {
            setColorTheme(savedColorTheme);
            applyTheme(savedColorTheme, isDark);
          } else {
            applyTheme(DEFAULT_THEME, isDark);
          }
        } else {
          applyTheme(DEFAULT_THEME, false);
        }
      })
      .catch((error) => {
        console.error('Failed to load state', error);
        applyTheme(DEFAULT_THEME, false);
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Apply dark/light class and re-apply theme variables
  useEffect(() => {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    applyTheme(colorTheme, isDark);
  }, [theme, colorTheme]);

  useEffect(() => {
    if (!isHydrated) return undefined;

    const timeout = window.setTimeout(() => setShowOpening(false), 700);
    return () => window.clearTimeout(timeout);
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || showOpening || !isStandaloneApp()) return;

    if (localStorage.getItem(TOUR_STORAGE_KEY) !== '1') {
      setTourStep(0);
      setShowTour(true);
    }
  }, [isHydrated, showOpening]);

  useEffect(() => {
    if (!showTour) return undefined;

    const step = TOUR_STEPS[tourStep];
    if (step.view && currentView !== step.view) {
      setCurrentView(step.view);
    }

    const timeout = window.setTimeout(() => {
      if (step.targetId) {
        document.getElementById(step.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, step.view && currentView !== step.view ? 350 : 100);

    return () => window.clearTimeout(timeout);
  }, [showTour, tourStep, currentView]);

  useEffect(() => {
    if (!isHydrated) return;

    saveAppState({ ...state, theme, colorTheme }).catch((error) => {
      console.error('Failed to save state', error);
    });
  }, [state, theme, colorTheme, isHydrated]);

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const openAttendanceReview = () => {
    setCurrentView('dashboard');
    setState((prev) => ({
      ...prev,
      attendanceReviewFocusDate: getLocalDateKey(),
    }));
  };

  useEffect(() => {
    const openFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'timetable') {
        setCurrentView('timetable');
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      if (params.get('view') === 'dashboard' && params.get('focus') === 'attendanceReview') {
        openAttendanceReview();
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    openFromUrl();
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'OPEN_ATTENDANCE_REVIEW') openAttendanceReview();
      if (event.data?.type === 'OPEN_TIMETABLE') setCurrentView('timetable');
    };
    const openTimetable = () => setCurrentView('timetable');

    window.addEventListener('orario-review-attendance-open', openAttendanceReview);
    window.addEventListener('orario-open-timetable', openTimetable);
    navigator.serviceWorker?.addEventListener?.('message', handleServiceWorkerMessage);

    return () => {
      window.removeEventListener('orario-review-attendance-open', openAttendanceReview);
      window.removeEventListener('orario-open-timetable', openTimetable);
      navigator.serviceWorker?.removeEventListener?.('message', handleServiceWorkerMessage);
    };
  }, []);

  const finishTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
    setShowTour(false);
  };

  const nextTourStep = () => {
    if (tourStep >= TOUR_STEPS.length - 1) {
      finishTour();
      return;
    }

    setTourStep((step) => step + 1);
  };

  useSmartAttendance(state, updateState);
  useReviewAttendanceReminder(state);
  useDailyReminder(state);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'timetable', icon: CalendarDays, label: 'Timetable' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'statistics', icon: BarChart2, label: 'Stats' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  const activeTourStep = TOUR_STEPS[tourStep];

  return (
    <AppContext.Provider value={{ state, updateState, theme, setTheme, colorTheme, setColorTheme }}>
      {/* Base colour layer */}
      <div className="fixed inset-0 z-0 bg-background transition-colors duration-500" />

      {/* Interactive particle canvas */}
      <ParticleBackground />

      <AnimatePresence>
        {showOpening && (
          <motion.div
            key="app-splash"
            className="fixed inset-0 z-[100] bg-background flex items-center justify-center px-8"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <motion.div
              className="voxel-card bg-surface p-6 min-w-[220px] flex flex-col items-center gap-4"
              initial={{ y: 14, scale: 0.94 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <motion.h1
                className="text-3xl text-on-surface font-header tracking-wider uppercase"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.22 }}
              >
                Orario
              </motion.h1>
              <div className="flex gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <motion.span
                    key={index}
                    className="w-3 h-3 bg-primary border-2 border-outline"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.55, repeat: Infinity, delay: index * 0.08 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="safe-top-header relative z-20 flex items-center justify-center px-glass-padding pointer-events-none">
        <h1 className="text-3xl sm:text-4xl text-on-surface dark:text-white font-header tracking-wider uppercase select-none">Orario</h1>
      </header>

      {/* Main Content Area */}
      <main className="screen-bottom-space relative z-10 flex-grow pt-4 px-gutter md:px-container-padding max-w-7xl mx-auto w-full overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full flex flex-col gap-gutter"
          >
            {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} />}
            {currentView === 'timetable' && <Timetable onNavigate={setCurrentView} />}
            {currentView === 'tasks' && <Tasks onNavigate={setCurrentView} />}
            {currentView === 'statistics' && <Stats onNavigate={setCurrentView} />}
            {currentView === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {showTour && activeTourStep && (
        <div className="fixed inset-x-0 bottom-[92px] z-[70] px-4 pointer-events-none md:bottom-8">
          <motion.div
            className="voxel-card bg-surface p-4 mx-auto max-w-md flex flex-col gap-3 pointer-events-auto"
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Tour {tourStep + 1} / {TOUR_STEPS.length}
              </span>
              <button
                className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant underline underline-offset-2"
                onClick={finishTour}
              >
                Skip Tour
              </button>
            </div>

            <div>
              <h2 className="text-body-md font-header text-on-surface uppercase">{activeTourStep.title}</h2>
              <p className="text-label-sm text-on-surface-variant mt-2 leading-5">{activeTourStep.body}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                {TOUR_STEPS.map((_, index) => (
                  <span
                    key={index}
                    className={`w-2.5 h-2.5 border-2 border-outline ${index <= tourStep ? 'bg-primary' : 'bg-surface-container-lowest'}`}
                  />
                ))}
              </div>
              <button className="voxel-btn-primary text-label-sm" onClick={nextTourStep}>
                {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <InstallPrompt />

      {/* Bottom Nav */}
      <nav className="edge-bottom-nav glass-nav fixed bottom-0 left-0 w-full md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-[90%] md:max-w-md z-50">
        <div className="flex justify-around items-center w-full px-2 relative h-full">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="relative flex flex-col items-center justify-center w-16 h-full z-10 outline-none"
              >
                {isActive ? (
                  <>
                    {/* Box pops up — icon is INSIDE so it moves with it, zero drift */}
                    <motion.div
                      layoutId="navIndicator"
                      initial={false}
                      className="absolute top-[-20px] w-[52px] h-[52px] bg-surface border-2 border-outline shadow-[3px_3px_0px_var(--color-outline)] z-10 flex items-center justify-center"
                      transition={{ type: 'spring', stiffness: 240, damping: 26, mass: 1 }}
                    >
                      <Icon size={22} strokeWidth={2.5} className="text-on-surface" />
                    </motion.div>
                    {/* Label below */}
                    <span className="absolute bottom-2 text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                      {item.label}
                    </span>
                  </>
                ) : (
                  /* Inactive icon sits flat in the nav */
                  <div className="text-on-surface-variant">
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </AppContext.Provider>
  );
}
