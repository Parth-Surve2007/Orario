# Orario

Smart attendance tracking for college timetables.

Orario is a lightweight PWA that reads Excel timetable files, helps students mark daily attendance, and optionally uses location checks for smarter attendance prompts. It is built for quick mobile use, with an installable web-app experience on Android, iOS, and desktop browsers.

## Features

- Excel timetable upload and parsing
- Class and batch selection
- Daily attendance marking
- Subject-wise attendance statistics
- Smart Attendance with browser geolocation
- Local backup and restore
- Installable PWA with offline support
- Light/dark mode and color themes

## Browser Support

Orario is designed for modern mobile and desktop browsers. Install support depends on the browser:

- Android: best with Chrome or Samsung Internet
- iOS: best when opened and installed from Safari
- Desktop: Chrome, Edge, and other Chromium browsers provide the most complete PWA install flow

Location-based features require browser location permission and may behave differently depending on device power saving, browser privacy settings, and operating system restrictions.

## Install On Android

Chrome or Samsung Internet is recommended.

1. Open the deployed Orario site in your browser.
2. Wait for the install prompt, then tap **Install**.
3. If no prompt appears, open the browser menu and choose **Install app** or **Add to Home screen**.
4. Launch Orario from your home screen or app drawer.

For best results, allow location permission if you plan to use Smart Attendance.

## Install On iOS

Safari is recommended for the most reliable PWA install flow.

1. Open the deployed Orario site in Safari.
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Tap **Add**.
5. Launch Orario from the home screen icon.

iOS may cache app icons and PWA metadata. If the installed icon does not update immediately, remove the home screen app and add it again


## Tech Stack

- React
- Vite
- Tailwind CSS
- Vite PWA / Workbox
- Dexie / IndexedDB
- SheetJS `xlsx`
- Leaflet
- Framer Motion
- Lucide React

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production PWA:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  components/        Reusable UI and install/location components
  hooks/             Smart attendance behavior
  utils/             Excel parsing, local database, themes, geofence helpers
  views/             Dashboard, timetable, tasks, stats, settings

public/icons/        PWA icons and app icon assets
dist/                Generated production build
```

## PWA Notes

The production build generates:

- `dist/manifest.webmanifest`
- `dist/sw.js`
- cached app assets for offline use

The app icon is fixed to the Gumroad Yellow Orario icon. If an already-installed PWA shows an older icon, reinstalling or clearing the browser/app cache may be required because operating systems cache installed app icons aggressively.


## Design

The app uses a playful brutalist visual style with strong borders, bold color, and compact mobile-first navigation. Typography in the app is based on Fredoka for body text and Bungee for display headings.

## Privacy

Orario stores attendance, timetable data, backups, theme preferences, and Smart Attendance settings locally in the browser. Location checks run on-device and are used only for attendance timing logic.

## License

This project is licensed under the GNU General Public License v3.0. See the LICENSE file for details.
