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
import { applyTheme, DEFAULT_THEME } from './utils/themes';
import { useSmartAttendance } from './hooks/useSmartAttendance';
import { loadAppState, saveAppState } from './utils/db';

export const AppContext = React.createContext({});

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [colorTheme, setColorTheme] = useState(DEFAULT_THEME);
  const [isHydrated, setIsHydrated] = useState(false);

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
    notificationsEnabled: false,
    smartAttendance: {
      enabled: false,
      collegeLocation: { lat: null, lng: null },
      radius: 200,
      lastChecks: {}
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
    if (!isHydrated) return;

    saveAppState({ ...state, theme, colorTheme }).catch((error) => {
      console.error('Failed to save state', error);
    });
  }, [state, theme, colorTheme, isHydrated]);

  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useSmartAttendance(state, updateState);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'timetable', icon: CalendarDays, label: 'Timetable' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'statistics', icon: BarChart2, label: 'Stats' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <AppContext.Provider value={{ state, updateState, theme, setTheme, colorTheme, setColorTheme }}>
      {/* Base colour layer */}
      <div className="fixed inset-0 z-0 bg-background transition-colors duration-500" />

      {/* Interactive particle canvas */}
      <ParticleBackground />

      {/* Header */}
      <header className="safe-top-header relative z-20 flex items-center justify-center px-glass-padding pointer-events-none">
        <h1 className="text-3xl sm:text-4xl text-on-surface dark:text-white font-header tracking-wider uppercase select-none">Orario</h1>
      </header>

      {/* Main Content Area */}
      <main className="screen-bottom-space relative z-10 flex-grow pt-4 px-gutter md:px-container-padding max-w-7xl mx-auto w-full overflow-hidden">
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
