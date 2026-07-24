import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Square, Trash2, Calendar, Plus } from 'lucide-react';

export default function Tasks() {
  const { state, updateState } = useContext(AppContext);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('Assignment');
  const [dueDate, setDueDate] = useState('');

  const subjects = state.selectedClass && state.subjectMappings?.[state.selectedClass]
    ? Object.keys(state.subjectMappings[state.selectedClass])
    : [];

  const handleAddTask = () => {
    if (!title || !dueDate) {
      alert('Title and Due Date are required.');
      return;
    }

    const newTask = {
      id: 'task_' + Date.now(),
      title,
      subject,
      type,
      dueDate,
      completed: false
    };

    updateState({ tasks: [...(state.tasks || []), newTask] });
    setTitle('');
    setSubject('');
    setDueDate('');
  };

  const handleToggleTask = (id) => {
    const updated = (state.tasks || []).map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    updateState({ tasks: updated });
  };

  const handleDeleteTask = (id) => {
    const updated = (state.tasks || []).filter(t => t.id !== id);
    updateState({ tasks: updated });
  };

  const sortedTasks = [...(state.tasks || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* Add Task Card */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4">
        <h3 className="text-headline-lg-mobile text-on-surface font-header">Add Task</h3>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="voxel-input w-full"
            placeholder="Task Title (e.g. Lab Report 1)"
          />
          <div className="flex gap-2">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="voxel-input flex-1 min-w-0"
            >
              <option value="">General / No Subject</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="voxel-input w-32"
            >
              <option value="Assignment">Assignment</option>
              <option value="Project">Project</option>
              <option value="Exam">Exam</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="voxel-input flex-1"
            />
            <button
              onClick={handleAddTask}
              className="voxel-btn-primary flex items-center gap-1 shrink-0"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </section>

      {/* Your Tasks Card */}
      <section className="voxel-card mx-auto w-9/10 p-6 flex flex-col gap-4">
        <h3 className="text-headline-lg-mobile text-on-surface font-header">Your Tasks</h3>

        {sortedTasks.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center opacity-80">
            <div className="w-14 h-14 bg-surface-container border-2 border-outline flex items-center justify-center mb-4">
              <CheckSquare className="text-on-surface-variant" size={24} />
            </div>
            <p className="text-body-md text-on-surface-variant">No tasks added yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {sortedTasks.map((t, i) => {
                const isOverdue = !t.completed && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className={`bg-surface-container-lowest border-2 px-4 py-3 flex items-center gap-4 transition-all duration-200
                      ${t.completed ? 'border-green-500/40 opacity-60 shadow-[2px_2px_0px_rgba(34,197,94,1)]' : (isOverdue ? 'border-red-500 shadow-[2px_2px_0px_rgba(239,68,68,1)]' : 'border-outline shadow-[2px_2px_0px_var(--color-outline)]')}
                    `}
                  >
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className={`w-8 h-8 border-2 border-outline flex items-center justify-center cursor-pointer transition-colors
                        ${t.completed ? 'bg-green-500 text-white' : 'bg-surface-container hover:bg-surface-container-highest'}
                      `}
                    >
                      {t.completed ? <CheckSquare size={16} /> : <Square size={16} className="text-on-surface-variant" />}
                    </button>

                    <div className={`flex-1 min-w-0 ${t.completed ? 'line-through' : ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${t.completed ? 'text-green-600' : (isOverdue ? 'text-red-500' : 'text-primary')}`}>
                          {t.subject || 'General'}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 border border-current ${t.completed ? 'text-green-600 border-green-600' : (isOverdue ? 'text-red-500 border-red-500' : 'text-primary border-primary')}`}>
                          {t.type}
                        </span>
                      </div>
                      <div className="text-body-md font-bold text-on-surface truncate">{t.title}</div>
                      <div className="text-label-sm text-on-surface-variant mt-0.5 flex items-center gap-1 font-bold">
                        <Calendar size={12} />
                        {t.dueDate}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="w-8 h-8 border-2 border-outline bg-red-500/10 text-red-500 flex items-center justify-center shadow-[2px_2px_0px_rgba(239,68,68,1)] hover:bg-red-500/20 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_rgba(239,68,68,1)] cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
