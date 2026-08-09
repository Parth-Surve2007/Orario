import React, { useState } from 'react';
import { FileText, Calendar, Users, BookOpen, AlertTriangle, X, Check } from 'lucide-react';

export default function ExcelPreviewModal({ previewData, onConfirm, onCancel }) {
  if (!previewData) return null;

  const today = new Date().toISOString().split('T')[0];
  const [effectiveFrom, setEffectiveFrom] = useState(today);

  const { preview } = previewData;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="voxel-card bg-surface p-6 w-full max-w-lg flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-headline-lg-mobile text-on-surface font-header flex items-center gap-2">
            <FileText size={24} className="text-primary" /> Import Preview
          </h2>
          <button onClick={onCancel} className="text-on-surface-variant hover:text-on-surface">
            <X size={24} />
          </button>
        </div>

        {/* File Name */}
        <div className="border-2 border-outline bg-surface-container-lowest p-3">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">File</span>
          <p className="text-body-md text-on-surface font-bold mt-1">{preview.fileName}</p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 border-outline bg-surface-container-lowest p-3 flex flex-col gap-1">
            <Users size={18} className="text-primary" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Classes</span>
            <span className="text-headline-sm-mobile text-on-surface font-bold">{previewData.classes.length}</span>
          </div>
          <div className="border-2 border-outline bg-surface-container-lowest p-3 flex flex-col gap-1">
            <Calendar size={18} className="text-primary" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Days</span>
            <span className="text-headline-sm-mobile text-on-surface font-bold">{preview.daysDetected.length}</span>
          </div>
          <div className="border-2 border-outline bg-surface-container-lowest p-3 flex flex-col gap-1">
            <BookOpen size={18} className="text-primary" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Lectures</span>
            <span className="text-headline-sm-mobile text-on-surface font-bold">{preview.totalLectures}</span>
          </div>
          <div className="border-2 border-outline bg-surface-container-lowest p-3 flex flex-col gap-1">
            <FileText size={18} className="text-primary" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Subjects</span>
            <span className="text-headline-sm-mobile text-on-surface font-bold">{preview.subjects.length}</span>
          </div>
        </div>

        {/* Days Detected */}
        <div className="border-2 border-outline bg-surface-container-lowest p-3">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Schedule Days</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {preview.daysDetected.map(day => (
              <span key={day} className="text-xs font-bold text-on-surface bg-surface-container border-2 border-outline px-2 py-1">
                {day.slice(0, 3)}
              </span>
            ))}
          </div>
        </div>

        {/* Classes List */}
        <div className="border-2 border-outline bg-surface-container-lowest p-3">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Detected Classes</span>
          <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto">
            {previewData.classes.slice(0, 10).map(cls => (
              <span key={cls} className="text-xs font-mono text-on-surface bg-surface-container border-2 border-outline px-2 py-1">
                {cls}
              </span>
            ))}
            {previewData.classes.length > 10 && (
              <span className="text-xs text-on-surface-variant italic">
                +{previewData.classes.length - 10} more
              </span>
            )}
          </div>
        </div>

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div className="border-2 border-error bg-error/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-error" />
              <span className="text-label-sm text-error uppercase tracking-wider font-bold">Warnings</span>
            </div>
            <ul className="flex flex-col gap-1">
              {preview.warnings.map((warning, idx) => (
                <li key={idx} className="text-xs text-error flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Effective From Date */}
        <div className="border-2 border-outline bg-surface-container-lowest p-3 flex flex-col gap-2">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Timetable Effective From</span>
          <p className="text-xs text-on-surface-variant">Lectures shown on the Dashboard will use this timetable for dates on or after this date.</p>
          <input
            type="date"
            className="voxel-input w-full"
            value={effectiveFrom}
            onChange={e => setEffectiveFrom(e.target.value)}
            max={today}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onCancel}
            className="voxel-btn-secondary flex-1 flex items-center justify-center gap-2 text-label-sm"
          >
            <X size={16} /> Cancel
          </button>
          <button
            onClick={() => onConfirm(effectiveFrom)}
            className="voxel-btn-primary flex-1 flex items-center justify-center gap-2 text-label-sm"
          >
            <Check size={16} /> Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
}
