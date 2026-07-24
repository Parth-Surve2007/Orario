/**
 * Gets the current GPS location using HTML5 Geolocation API.
 * This works natively on Web, and Capacitor also maps this to native APIs on mobile.
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
    if (!current || !college || current.lat == null || college.lat == null) return false;
    const distance = calculateDistance(current.lat, current.lng, college.lat, college.lng);
    return distance <= radiusMeters;
};

/**
 * Parses "8:30 - 9:30" or "08:30-09:30" into Date objects for today.
 * @param {string} timeStr - The time range string.
 * @returns {{start: Date, end: Date} | null}
 */
export const parseLectureTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split('-');
    if (parts.length !== 2) return null;

    const parseTime = (t) => {
        const [h, m] = t.trim().split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    };

    try {
        return {
            start: parseTime(parts[0]),
            end: parseTime(parts[1])
        };
    } catch (e) {
        return null;
    }
};
