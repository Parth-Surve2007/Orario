# AttendEase — React Architecture & Design Specification

This document details the architecture, design choices, and custom interactive features implemented during the migration of the AttendEase application from vanilla JavaScript to React + Vite.

---

## 1. Project Architecture

AttendEase is built as a single-page application (SPA) optimized for deployment as an Android/iOS wrapper using Capacitor.
vercel deployment

```
public/
├── src/
│   ├── components/
│   │   └── ParticleBackground.jsx  # Interactive canvas-based ambient background
│   ├── utils/
│   │   ├── excelParser.js         # Excel loader & parser (Allocation + Timetable sheets)
│   │   └── themes.js              # Theme configurations (light & dark custom properties)
│   ├── views/
│   │   ├── Dashboard.jsx          # Home view (daily schedule & attendance summaries)
│   │   ├── Timetable.jsx          # Full weekly schedule planner
│   │   ├── Tasks.jsx              # To-do lists & deadlines
│   │   ├── Stats.jsx              # Attendance statistics & targets
│   │   └── SettingsView.jsx       # App configuration (file upload, theme picker, holidays)
│   ├── App.jsx                    # Root application component & global navigation
│   ├── index.css                  # Tailwinds directives & default token styles
│   └── main.jsx                   # React entrypoint
├── tailwind.config.js             # Tailwind CSS custom variable configuration
└── package.json                   # Dependency definitions
```

---

## 2. Dynamic State Management

State is centralized inside `App.jsx` using React's **Context API** (`AppContext`) to prevent page-reload resets.
* **Persistence:** App state is serialized and stored in `localStorage` on any state update.
* **Bootstrap:** On launch, the state is read, the active theme is applied, and the interface boots instantly.

---

## 3. Hand-Crafted Theming System

A dynamic, variable-driven color engine is declared on `:root` and bound to Tailwind configuration classes:

* **Variable Swapping:** Rather than recompiling tailwind styles, the application changes values of CSS custom properties (like `--color-primary`) on the document element dynamically via Javascript.
* **Light / Dark Variants:** Each of the 6 color themes contains independent `light` and `dark` color tables:
  1. **Crimson Amber:** Warm rose-red with golden amber accents.
  2. **Ocean Breeze:** Sky blue paired with cool cyan.
  3. **Forest Dark:** Leaf green over rich emerald green.
  4. **Violet Dreams:** Royal violet and electric purple accents.
  5. **Sunset Peach:** Soft orange coral and bright yellow.
  6. **Midnight Cyan:** High-contrast neon cyan.
* **Transitions:** Applied global styles enforce a smooth `300ms` transition on all background, text, and border color property updates.

---

## 4. Modern UX Animations & Micro-Interactions

### A. Magic Floating Navigation Bar
A curved bottom navigation bar with a physical pop-up animation:
* **Concentric Popout:** The active route slides a circular glass badge above the bar containing the active icon.
* **Spring Movement:** Moving between routes triggers a Framer Motion spring transition (`layoutId="navIndicator"`) that visually slides the active badge across the screen.
* **Fading Labels:** Unselected labels are hidden, and the active label fades in exactly below the popped icon.

### B. Interactive Canvas Particle Background (`ParticleBackground.jsx`)
A custom script replacing static images, optimized for mobile battery life:
* **Drift & Connections:** 60 ambient particles float randomly; adjacent particles draw faint neural connections between each other.
* **Tap Explosion:** Tapping or dragging on screen spawns a burst of 18 glowing particles flying outward with inertia, fading away over a few seconds.
* **Color Injection:** On every frame, the background reads the exact primary hex value of your color theme, converting it to RGBA on-the-fly.

---

## 5. View Routing Matrix

* **Dashboard:** Reads the timetable for the current weekday, matching the user's selected Class and Batch.
* **Timetable:** Displays full Mon-Sat schedules with tab chips that slide in dynamically.
* **Settings:** Houses Excel importing (`xlsx` processing), holidays manager, semester configuration, and the dynamic theme picker interface.
