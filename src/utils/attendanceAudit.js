/**
 * Attendance Audit Trail Helper
 * Tracks how attendance records were last modified
 */

const AUDIT_SOURCES = {
  MANUAL: 'manual',
  SMART_ATTENDANCE: 'smart_attendance',
  IMPORT: 'import',
  EDITED: 'edited'
};

/**
 * Creates an audit entry for an attendance record
 */
export function createAuditEntry(source, note = null) {
  return {
    source,
    timestamp: Date.now(),
    note: note || ''
  };
}

/**
 * Updates audit trail for a specific lecture key
 * Respects the rule: manual attendance is never overwritten
 */
export function updateAuditTrail(currentAudit, lectureKey, newSource, note = null) {
  const existingAudit = currentAudit?.[lectureKey];
  
  // Manual attendance is never overwritten
  if (existingAudit?.source === AUDIT_SOURCES.MANUAL) {
    return currentAudit;
  }
  
  // If this is a manual update and record exists, mark as edited
  let finalSource = newSource;
  if (newSource === AUDIT_SOURCES.MANUAL && existingAudit) {
    finalSource = AUDIT_SOURCES.EDITED;
  }
  
  return {
    ...(currentAudit || {}),
    [lectureKey]: createAuditEntry(finalSource, note)
  };
}

/**
 * Bulk update audit trail for multiple lecture keys
 */
export function bulkUpdateAuditTrail(currentAudit, lectureKeys, source, note = null) {
  const updatedAudit = { ...(currentAudit || {}) };
  
  lectureKeys.forEach(key => {
    const existingAudit = updatedAudit[key];
    
    // Manual attendance is never overwritten
    if (existingAudit?.source === AUDIT_SOURCES.MANUAL) {
      return;
    }
    
    // If this is a manual update and record exists, mark as edited
    let finalSource = source;
    if (source === AUDIT_SOURCES.MANUAL && existingAudit) {
      finalSource = AUDIT_SOURCES.EDITED;
    }
    
    updatedAudit[key] = createAuditEntry(finalSource, note);
  });
  
  return updatedAudit;
}

/**
 * Gets a human-readable label for an audit source
 */
export function getSourceLabel(source) {
  const labels = {
    [AUDIT_SOURCES.MANUAL]: 'Manual',
    [AUDIT_SOURCES.SMART_ATTENDANCE]: 'Smart Attendance',
    [AUDIT_SOURCES.IMPORT]: 'Import',
    [AUDIT_SOURCES.EDITED]: 'Edited',
    'unknown': 'Unknown'
  };
  return labels[source] || 'Unknown';
}

/**
 * Formats a timestamp for display
 */
export function formatAuditTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${day} ${month}, ${displayHours}:${minutes} ${ampm}`;
}

/**
 * Gets audit info for display with backward compatibility
 */
export function getAuditDisplayInfo(auditEntry) {
  if (!auditEntry) {
    return {
      sourceLabel: 'Unknown',
      timestamp: '',
      hasAudit: false
    };
  }
  
  return {
    sourceLabel: getSourceLabel(auditEntry.source),
    timestamp: formatAuditTimestamp(auditEntry.timestamp),
    hasAudit: true
  };
}
