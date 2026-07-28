import React from 'react';
import { Bell, X, CheckSquare } from 'lucide-react';

export default function AttendanceReminderModal({ pendingLectures, onDismiss, onGoToDashboard }) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/50 px-4 py-8 flex items-center justify-center">
      <div className="voxel-card w-full max-w-sm p-5 bg-surface flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary border-2 border-outline flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0">
              <Bell size={18} className="text-on-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-body-md text-on-surface font-header uppercase">Attendance Reminder</h3>
              <p className="text-label-sm text-on-surface-variant mt-1 leading-5">
                You haven't marked attendance for:
              </p>
            </div>
          </div>
          <button
            className="border-2 border-outline bg-surface-container w-9 h-9 flex items-center justify-center shadow-[2px_2px_0px_var(--color-outline)] shrink-0"
            onClick={onDismiss}
            aria-label="Close reminder"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {pendingLectures.map((lecture, index) => (
            <div key={index} className="flex items-center justify-between text-body-md text-on-surface">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                <span className="font-medium">{lecture.name}</span>
              </div>
              <span className="text-label-sm text-on-surface-variant">{lecture.formattedTime}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="voxel-btn-secondary text-label-sm" onClick={onDismiss}>
            Later
          </button>
          <button className="voxel-btn-primary text-label-sm flex items-center justify-center gap-2" onClick={onGoToDashboard}>
            <CheckSquare size={16} /> Mark Attendance
          </button>
        </div>
      </div>
    </div>
  );
}
