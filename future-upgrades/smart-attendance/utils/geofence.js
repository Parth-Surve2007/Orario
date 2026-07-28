// GPS Confidence Configuration
const GPS_CONFIG = {
    MAX_ACCURACY_METERS: 50,        // Reject readings worse than 50m
    HIGH_ACCURACY_METERS: 20,       // High confidence threshold
    MAX_READINGS: 3,                // Take up to 3 readings
    READING_DELAY_MS: 2000,         // Delay between readings
    TOTAL_TIMEOUT_MS: 15000,        // Total time for all readings
    CONSISTENCY_THRESHOLD_METERS: 20, // Readings must be within 20m of each other (accounts for natural GPS jitter)
};

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
 * Gets a single GPS reading with accuracy information.
 * @returns {Promise<{lat: number, lng: number, accuracy: number} | null>}
 */
const getSingleReading = () => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy || 999999 // Fallback if accuracy unavailable
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
 * Gets GPS location with confidence scoring using multiple readings.
 * Implements early exit when HIGH confidence is achieved.
 * @returns {Promise<{location: {lat: number, lng: number} | null, confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE', status: string}>}
 */
export const getCurrentLocationWithConfidence = async () => {
    const readings = [];
    const startTime = Date.now();

    // Take multiple readings with early exit
    for (let i = 0; i < GPS_CONFIG.MAX_READINGS; i++) {
        // Check timeout
        if (Date.now() - startTime > GPS_CONFIG.TOTAL_TIMEOUT_MS) {
            break;
        }

        const reading = await getSingleReading();
        if (reading) {
            readings.push(reading);

            // Early exit: if we have 2+ readings with HIGH accuracy and consistency, stop
            if (readings.length >= 2) {
                const validReadings = readings.filter(r => r.accuracy <= GPS_CONFIG.MAX_ACCURACY_METERS);
                if (validReadings.length >= 2) {
                    const avgAccuracy = validReadings.reduce((sum, r) => sum + r.accuracy, 0) / validReadings.length;
                    if (avgAccuracy <= GPS_CONFIG.HIGH_ACCURACY_METERS) {
                        // Check consistency
                        const isConsistent = validReadings.every(r1 => 
                            validReadings.every(r2 => 
                                calculateDistance(r1.lat, r1.lng, r2.lat, r2.lng) <= GPS_CONFIG.CONSISTENCY_THRESHOLD_METERS
                            )
                        );
                        if (isConsistent) {
                            // Early exit with HIGH confidence
                            const avgLat = validReadings.reduce((sum, r) => sum + r.lat, 0) / validReadings.length;
                            const avgLng = validReadings.reduce((sum, r) => sum + r.lng, 0) / validReadings.length;
                            return { 
                                location: { lat: avgLat, lng: avgLng }, 
                                confidence: 'HIGH', 
                                status: 'Location verified' 
                            };
                        }
                    }
                }
            }
        }

        // Delay between readings (except after last one)
        if (i < GPS_CONFIG.MAX_READINGS - 1) {
            await new Promise(resolve => setTimeout(resolve, GPS_CONFIG.READING_DELAY_MS));
        }
    }

    // Filter by accuracy
    const validReadings = readings.filter(r => r.accuracy <= GPS_CONFIG.MAX_ACCURACY_METERS);

    if (validReadings.length === 0) {
        if (readings.length === 0) {
            return { location: null, confidence: 'NONE', status: 'GPS failed' };
        }
        return { location: null, confidence: 'NONE', status: 'GPS inaccurate' };
    }

    // Check consistency - all valid readings should be close to each other
    const isConsistent = validReadings.every(r1 => 
        validReadings.every(r2 => 
            calculateDistance(r1.lat, r1.lng, r2.lat, r2.lng) <= GPS_CONFIG.CONSISTENCY_THRESHOLD_METERS
        )
    );

    if (!isConsistent) {
        // Inconsistent readings - use the most accurate one but mark as low confidence
        const bestReading = validReadings.reduce((best, current) => 
            current.accuracy < best.accuracy ? current : best
        );
        return { 
            location: { lat: bestReading.lat, lng: bestReading.lng }, 
            confidence: 'LOW', 
            status: 'GPS inconsistent' 
        };
    }

    // Calculate average of consistent readings
    const avgLat = validReadings.reduce((sum, r) => sum + r.lat, 0) / validReadings.length;
    const avgLng = validReadings.reduce((sum, r) => sum + r.lng, 0) / validReadings.length;
    const avgAccuracy = validReadings.reduce((sum, r) => sum + r.accuracy, 0) / validReadings.length;

    // Determine confidence level
    if (validReadings.length >= 2 && avgAccuracy <= GPS_CONFIG.HIGH_ACCURACY_METERS) {
        return { 
            location: { lat: avgLat, lng: avgLng }, 
            confidence: 'HIGH', 
            status: 'Location verified' 
        };
    } else if (validReadings.length >= 2) {
        return { 
            location: { lat: avgLat, lng: avgLng }, 
            confidence: 'MEDIUM', 
            status: 'Location verified' 
        };
    } else {
        return { 
            location: { lat: avgLat, lng: avgLng }, 
            confidence: 'LOW', 
            status: 'GPS limited accuracy' 
        };
    }
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
