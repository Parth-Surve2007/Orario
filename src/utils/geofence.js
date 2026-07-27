/**
 * Gets the current GPS location using HTML5 Geolocation API.
 * This works in the browser/PWA using the HTML5 Geolocation API.
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export const getCurrentLocation = () => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                console.error("Error getting location:", error);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
};

/**
 * Calculates distance between two coordinates in meters using Haversine formula.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const toRad = (val) => (val * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Checks if current location is within radius of college.
 */
export const isInsideCampus = (current, college, radiusMeters) => {
    if (!current || !college || current.lat == null || current.lng == null || college.lat == null || college.lng == null) return false;
    const distance = calculateDistance(current.lat, current.lng, college.lat, college.lng);
    return distance <= radiusMeters;
};

export const getLocalDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Parses "8:30 - 9:30", "08:30-09:30", or "8.30 AM-9.30AM" into Date objects for today.
 * @param {string} timeStr - The time range string.
 * @returns {{start: Date, end: Date} | null}
 */
export const parseLectureTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = String(timeStr).split(/\s*[-–]\s*/);
    if (parts.length !== 2) return null;

    const inferCollegeHour = (hour, explicitPeriod) => {
        if (explicitPeriod) return hour;
        if (hour >= 1 && hour <= 7) return hour + 12;
        return hour;
    };

    const parseTime = (timePart, fallbackPeriod = '') => {
        const normalized = String(timePart || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ');
        const match = normalized.match(/(\d{1,2})[\.:](\d{2})\s*(AM|PM)?/);
        if (!match) return null;

        let h = Number(match[1]);
        const m = Number(match[2]);
        const period = match[3] || fallbackPeriod;
        if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) return null;

        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        h = inferCollegeHour(h, period);
        if (h > 23) return null;

        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    };

    try {
        const endPeriod = String(parts[1]).toUpperCase().match(/(AM|PM)/)?.[1] || '';
        const startPeriod = String(parts[0]).toUpperCase().match(/(AM|PM)/)?.[1] || endPeriod;
        const start = parseTime(parts[0], startPeriod);
        const end = parseTime(parts[1], endPeriod);
        if (!start || !end) return null;
        if (end.getTime() <= start.getTime()) {
            end.setHours(end.getHours() + 12);
        }

        return {
            start,
            end
        };
    } catch (e) {
        return null;
    }
};
