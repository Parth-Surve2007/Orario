# Smart Attendance (Archived)

**Status:** Archived - Not part of v1.0 release

**Reason for Archival:**
Modern browsers do not guarantee reliable background execution, background timers, continuous GPS, or reliable background notifications in pure PWAs. This feature was replaced with Attendance Reminder for v1.0 to ensure consistent behavior.

## What This Contains

This folder contains the complete Smart Attendance implementation that was developed for Orario. The code is preserved here for future development when native builds or enhanced PWA capabilities become available.

## Files

### Hooks
- `useSmartAttendance.js` - Main hook for GPS-based automatic attendance
- `useReviewAttendanceReminder.js` - Hook for scheduling attendance review reminders

### Utils
- `geofence.js` - GPS location utilities, campus boundary checking, confidence scoring

### Components
- `LocationPicker.jsx` - Interactive map component for setting college location

## How It Worked

1. User enables Smart Attendance in Settings
2. User sets college location via map picker or manual coordinates
3. App checks GPS every 60 seconds during scheduled lecture windows
4. Multiple GPS readings are taken for confidence scoring
5. Attendance is automatically marked if:
   - User is inside campus radius
   - GPS confidence is HIGH or MEDIUM
   - Manual attendance has not been marked

## Future Implementation Notes

To re-enable this feature in future versions:

1. Consider native Android/iOS builds for reliable background execution
2. Use native background location services
3. Implement proper background task scheduling
4. Add battery optimization handling
5. Consider timezone support for traveling users

## Dependencies

- React hooks (useEffect, useRef)
- Browser Geolocation API
- Haversine formula for distance calculation
- Confidence-based GPS filtering

## Archived Date

July 28, 2026
