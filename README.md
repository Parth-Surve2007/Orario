# Orario

Smart attendance tracking for college timetables.

Orario is a lightweight PWA that reads Excel timetable files, helps students mark daily attendance, and provides intelligent reminders for forgotten attendance. It is built for quick mobile use, with an installable web-app experience on Android, iOS, and desktop browsers.

## Features

- Excel timetable upload and parsing
- Class and batch selection
- Daily attendance marking
- Subject-wise attendance statistics
- Attendance Reminder - reminds you when you haven't marked attendance
- Local backup and restore
- Installable PWA with offline support
- Light/dark mode and color themes

## Attendance Reminder

Orario helps you remember to mark attendance whenever you open the app. When you launch Orario or switch back to it, the app automatically checks if any lectures have ended without attendance being marked and shows a friendly reminder. This feature works completely offline and requires no background services or location permissions.

## Browser Support

Orario is designed for modern mobile and desktop browsers. Install support depends on the browser:

- Android: best with Chrome or Samsung Internet
- iOS: best when opened and installed from Safari
- Desktop: Chrome, Edge, and other Chromium browsers provide the most complete PWA install flow

## Install On Android

Chrome or Samsung Internet is recommended.

1. Open the deployed Orario site in your browser.
2. Wait for the install prompt, then tap **Install**.
3. If no prompt appears, open the browser menu and choose **Install app** or **Add to Home screen**.
4. Launch Orario from your home screen or app drawer.

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
  components/        Reusable UI components
  hooks/             Custom React hooks
  utils/             Excel parsing, local database, themes
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

Orario stores attendance, timetable data, backups, and theme preferences locally in the browser. All data remains on your device - no cloud sync, no analytics, no telemetry.

## Planned Features

The following features are planned for future releases but are not part of v1.0:

- Smart Attendance (GPS-assisted automatic attendance)
- Native Android enhancements
- Local notification reminders
- Background automation (native builds only)

These features require native app capabilities or enhanced PWA APIs that are not yet reliably available across all platforms.

## Contributing

Contributions are welcome! If you find a bug, have a feature suggestion, or would like to improve the project, feel free to open an issue or submit a pull request.
Please keep changes focused, well-documented, and consistent with the existing code style.

## License

This project is licensed under the GNU General Public License v3.0. See the LICENSE file for details.
