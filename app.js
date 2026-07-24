const App = {
    state: {
        currentView: 'dashboard',
        timetable: null,
        attendance: {}, // { date: { lectureId: status } }
        extraLectures: [],
        holidays: [],
        semester: { start: '', end: '' },
        selectedClass: '',
        classes: [],
        sheetNames: [],
        selectedSheet: '', // Timetable sheet
        selectedAllocSheet: '', // Allocation sheet
        selectedBatch: '', // B1, B2, etc or empty for all
        lastUploadedFile: '',
        rawTimetable: null,
        subjectMappings: {}, // { className: { subjectCode: { teacher, count, present } } }
        holidays: [], // [ 'YYYY-MM-DD' ]
        viewDate: null,
        currentTimetableDay: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
        theme: 'light',
        tasks: [],
        notificationsEnabled: false
    },
    // Non-persisted large data
    temp: {
        allSheetsJSON: {}
    },

    init() {
        try {
            this.loadState();
            this.applyTheme();
            this.bindEvents();
            this.updateNavState();
            this.render();
            this.registerSW();
            this.checkAndSendDailyReminder();
        } catch (e) {
            console.error('Init failed', e);
        }
    },

    registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed', err));
        }
    },

    loadState() {
        const saved = localStorage.getItem('attendease_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Deep merge or at least ensure critical arrays exist
                this.state = Object.assign({}, this.state, parsed);
                this.state.classes = Array.isArray(this.state.classes) ? this.state.classes : [];
                this.state.sheetNames = Array.isArray(this.state.sheetNames) ? this.state.sheetNames : [];
                this.state.extraLectures = Array.isArray(this.state.extraLectures) ? this.state.extraLectures : [];
                this.state.attendance = this.state.attendance || {};

                // Data Migration: Clean up IDs with accidental spaces from previous bug
                Object.keys(this.state.attendance).forEach(date => {
                    const dayData = this.state.attendance[date];
                    Object.keys(dayData).forEach(id => {
                        if (id.includes(' ')) {
                            const newId = id.replace(/\s+/g, '');
                            if (!dayData[newId]) dayData[newId] = dayData[id];
                            delete dayData[id];
                        }
                    });
                });
                
                // Set default theme if not set
                if (!this.state.theme) {
                    this.state.theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (!this.state.tasks) this.state.tasks = [];
            } catch (e) {
                console.error('Failed to parse state', e);
            }
        }
    },

    saveState() {
        try {
            // We don't save allSheetsJSON to localStorage to avoid quota limits
            localStorage.setItem('attendease_state', JSON.stringify(this.state));
        } catch (e) {
            console.error('Save failed', e);
            if (e.name === 'QuotaExceededError') {
                // Clear some history or large objects
                this.state.rawTimetable = null;
                localStorage.setItem('attendease_state', JSON.stringify(this.state));
            }
        }
    },

    // ==================== NAVIGATION & THEME ====================

    applyTheme() {
        if (this.state.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.saveState();
        this.render();
    },

    bindEvents() {
        // Bottom nav buttons
        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            btn.onclick = () => this.switchView(btn.dataset.view);
        });
    },

    switchView(view) {
        this.state.currentView = view;
        this.updateNavState();
        this.render();
    },

    updateNavState() {
        const view = this.state.currentView;

        // Update bottom nav
        document.querySelectorAll('.bottom-nav-item').forEach(btn => {
            const isActive = btn.dataset.view === view;
            if (isActive) {
                btn.className = 'bottom-nav-item glass-nav-item-active flex flex-col items-center justify-center text-white rounded-[24px] px-4 py-2 transition-all duration-200 relative';
                btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
                // Add active dot
                if (!btn.querySelector('.nav-dot')) {
                    const dot = document.createElement('div');
                    dot.className = 'nav-dot absolute -bottom-1 w-1 h-1 bg-pink-400 rounded-full';
                    btn.appendChild(dot);
                }
            } else {
                btn.className = 'bottom-nav-item flex flex-col items-center justify-center text-white/70 px-4 py-2 hover:text-white transition-all duration-200 rounded-full';
                btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
                const dot = btn.querySelector('.nav-dot');
                if (dot) dot.remove();
            }
        });
    },

    // ==================== RENDER ENGINE ====================

    render() {
        try {
            const container = document.getElementById('content-area');
            if (!container) return;
            container.innerHTML = '';

            switch (this.state.currentView) {
                case 'dashboard': this.renderDashboard(container); break;
                case 'timetable': this.renderTimetable(container); break;
                case 'statistics': this.renderStatistics(container); break;
                case 'settings': this.renderSettings(container); break;
                case 'tasks': this.renderTasks(container); break;
                default: this.renderDashboard(container);
            }
        } catch (e) {
            console.error('Render failed', e);
            const container = document.getElementById('content-area');
            if (container) container.innerHTML = `
                <div class="glass-modal rounded-xl p-8 text-center">
                    <span class="material-symbols-outlined text-4xl text-error mb-4">error</span>
                    <h3 class="text-headline-lg-mobile text-on-surface mb-2">Something went wrong</h3>
                    <p class="text-body-md text-on-surface-variant mb-6">${e.message}</p>
                    <button class="glass-button-danger rounded-full px-6 py-2.5 text-label-sm" onclick="App.resetApp()">Reset App Data</button>
                </div>
            `;
        }
    },

    // ==================== DASHBOARD ====================

    renderDashboard(container) {
        if (!this.state.selectedClass) {
            // Empty state — Welcome card (from Stitch dashboard design)
            container.innerHTML = `
                <section class="mt-4 mb-8 flex justify-center w-full animate-in">
                    <div class="glass-modal rounded-xl p-8 md:p-12 w-full max-w-2xl text-center flex flex-col items-center gap-6 relative overflow-hidden">
                        <div class="absolute -top-10 -right-10 w-32 h-32 bg-secondary-container/40 rounded-full blur-2xl"></div>
                        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-primary-container/40 rounded-full blur-2xl"></div>
                        <div class="z-10 bg-white/30 p-6 rounded-full shadow-[0_4px_16px_rgba(186,230,253,0.2)] mb-2 border border-white/40">
                            <span class="material-symbols-outlined text-[48px] text-secondary" style="font-variation-settings: 'FILL' 1;">waving_hand</span>
                        </div>
                        <div class="z-10 flex flex-col gap-2">
                            <h2 class="text-headline-lg-mobile md:text-headline-lg text-on-surface font-medium">Welcome to AttendEase</h2>
                            <p class="text-body-md text-on-surface-variant max-w-md mx-auto">Please upload your timetable and select your class to get started.</p>
                        </div>
                        <button class="z-10 glass-button-accent text-label-sm uppercase tracking-wider px-8 py-4 rounded-full mt-4 flex items-center gap-2" onclick="App.switchView('settings')">
                            <span class="material-symbols-outlined text-[18px]">upload_file</span>
                            Setup Now
                        </button>
                    </div>
                </section>
            `;
            return;
        }

        const dateInput = this.state.viewDate || new Date().toISOString().split('T')[0];
        const dayName = new Date(dateInput).toLocaleDateString('en-US', { weekday: 'long' });

        // Calculate Average
        let total = 0, present = 0;
        Object.values(this.state.attendance).forEach(day => {
            Object.values(day).forEach(status => {
                total++;
                if (status === 'present') present++;
            });
        });
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        const pctColor = pct >= 75 ? '#22c55e' : (pct >= 50 ? '#eab308' : '#ef4444');

        const lecturesHtml = this.renderDailyLectures(dateInput, dayName);
        const count = this.state.currentDailyCount || 0;
        const isHoliday = (this.state.holidays || []).includes(dateInput);

        container.innerHTML = `
            <!-- Stat Cards Bento Grid -->
            <section class="grid grid-cols-2 gap-gutter animate-in">
                <!-- Overall Attendance Card -->
                <article class="glass-panel rounded-xl p-glass-padding flex flex-col justify-between aspect-square relative overflow-hidden glass-edge">
                    <div class="flex items-start">
                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary">donut_large</span>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <div class="text-display-lg text-on-surface mb-1" style="color: ${pctColor}">${pct}%</div>
                        <div class="text-label-sm text-on-surface-variant uppercase tracking-wider">Overall Attendance</div>
                    </div>
                </article>
                <!-- Lectures Today Card -->
                <article class="glass-panel rounded-xl p-glass-padding flex flex-col justify-between aspect-square relative overflow-hidden glass-edge">
                    <div class="flex items-start">
                        <div class="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center">
                            <span class="material-symbols-outlined text-on-secondary-container">school</span>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <div class="text-display-lg text-on-surface mb-1">${count}</div>
                        <div class="text-label-sm text-on-surface-variant uppercase tracking-wider">Lectures Today</div>
                    </div>
                </article>
            </section>

            ${isHoliday ? `
                <div class="glass-panel rounded-xl px-glass-padding py-4 flex items-center gap-3 holiday-chip animate-in stagger-1">
                    <span class="material-symbols-outlined text-amber-600" style="font-variation-settings: 'FILL' 1;">wb_sunny</span>
                    <p class="text-body-md font-medium text-amber-800">Today is a Holiday!</p>
                </div>
            ` : ''}

            <!-- Schedule Card -->
            <section class="glass-panel rounded-xl p-glass-padding animate-in stagger-2">
                <div class="flex justify-between items-start mb-6 flex-wrap gap-4">
                    <div>
                        <h3 class="text-headline-lg-mobile text-on-surface mb-1">Schedule</h3>
                        <p class="text-label-sm text-on-surface-variant uppercase tracking-wider">${dayName}, ${new Date(dateInput).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div class="flex gap-2 flex-wrap items-center">
                        <input type="date" value="${dateInput}" onchange="App.changeViewDate(this.value)" class="glass-input rounded-lg px-3 py-2 text-label-sm w-[140px]">
                        <button class="${isHoliday ? 'glass-button-danger' : 'glass-button-ghost'} rounded-full px-4 py-2 text-label-sm flex items-center gap-1" onclick="App.toggleHoliday('${dateInput}')">
                            <span class="material-symbols-outlined text-[16px]">${isHoliday ? 'event_busy' : 'beach_access'}</span>
                            ${isHoliday ? 'Unmark' : 'Holiday'}
                        </button>
                    </div>
                </div>
                ${!isHoliday && count > 0 ? `
                    <div class="flex gap-2 mb-4">
                        <button class="glass-button-primary rounded-full px-4 py-2 text-label-sm flex items-center gap-1" onclick="App.markBatchAttendance('${dateInput}', 'present')" style="background: linear-gradient(135deg, rgba(34,197,94,0.85), rgba(22,163,74,1));">
                            <span class="material-symbols-outlined text-[16px]">done_all</span>
                            All Present
                        </button>
                        <button class="glass-button-ghost rounded-full px-4 py-2 text-label-sm flex items-center gap-1" onclick="App.markBatchAttendance('${dateInput}', 'absent')">
                            <span class="material-symbols-outlined text-[16px]">close</span>
                            All Absent
                        </button>
                    </div>
                ` : ''}
                <div class="flex flex-col gap-3">
                    ${lecturesHtml}
                </div>
            </section>
        `;
    },

    changeViewDate(date) {
        this.state.viewDate = date;
        this.saveState();
        this.render();
    },

    renderDailyLectures(date, dayName) {
        const dayKey = dayName.toUpperCase();
        const timetable = this.state.timetableSchedule || {};
        const lectures = timetable[dayKey] || [];

        let html = '';
        let classCount = 0;

        lectures.forEach((l, originalIndex) => {
            if (!this.lectureMatches(l)) return;
            classCount++;
            const teacher = this.getTeacherForLecture(l.name);

            const id = `${date}-${dayKey}-${originalIndex}`;
            const status = (this.state.attendance[date] && this.state.attendance[date][id]) || null;
            html += `
                <div class="glass-base rounded-xl px-4 py-3 flex items-center justify-between gap-4 border border-white/20 animate-in stagger-${Math.min(classCount, 8)}">
                    <div class="flex-1 min-w-0">
                        <div class="text-label-sm text-secondary uppercase tracking-wider mb-1">${l.time}</div>
                        <h4 class="text-body-md font-medium text-on-surface truncate">${l.name}</h4>
                        ${teacher ? `<p class="text-label-sm text-on-surface-variant mt-0.5">${teacher}</p>` : ''}
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button class="att-btn present ${status === 'present' ? 'active' : ''}" onclick="App.markAttendance('${date}', '${id}', 'present')">
                            <span class="material-symbols-outlined text-[20px]">check</span>
                        </button>
                        <button class="att-btn absent ${status === 'absent' ? 'active' : ''}" onclick="App.markAttendance('${date}', '${id}', 'absent')">
                            <span class="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </div>
            `;
        });

        const extras = this.state.extraLectures.filter(l => l.date === date);
        extras.forEach(l => {
            classCount++;
            const status = (this.state.attendance[date] && this.state.attendance[date][l.id]) || null;
            html += `
                <div class="glass-base rounded-xl px-4 py-3 flex items-center justify-between gap-4 border border-secondary-container/40 animate-in stagger-${Math.min(classCount, 8)}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="text-body-md font-medium text-on-surface truncate">${l.name}</h4>
                            <span class="text-[10px] uppercase tracking-wider bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full font-medium">Extra</span>
                        </div>
                        <p class="text-label-sm text-on-surface-variant">${l.time}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button class="att-btn present ${status === 'present' ? 'active' : ''}" onclick="App.markAttendance('${date}', '${l.id}', 'present')">
                            <span class="material-symbols-outlined text-[20px]">check</span>
                        </button>
                    </div>
                </div>
            `;
        });

        this.state.currentDailyCount = classCount + extras.length;
        if (html) return html;

        const suggestions = this.state.classes.length > 0
            ? `<p class="text-label-sm text-on-surface-variant mt-2">Classes found: <span class="font-medium text-secondary">${this.state.classes.join(', ')}</span></p>`
            : '';

        return `
            <div class="text-center py-8 flex flex-col items-center">
                <div class="w-16 h-16 rounded-full bg-white/30 border border-white/40 flex items-center justify-center mb-4 shadow-inner">
                    <span class="material-symbols-outlined text-3xl text-outline-variant">event_available</span>
                </div>
                <p class="text-body-md text-on-surface-variant">No lectures for ${dayName}.</p>
                <p class="text-label-sm text-outline mt-1">Class: ${this.state.selectedClass || 'None'}</p>
                ${suggestions}
            </div>
        `;
    },

    // ==================== TIMETABLE ====================

    renderTimetable(container) {
        if (!this.state.timetableSchedule) {
            container.innerHTML = `
                <div class="flex-grow flex items-center justify-center min-h-[60vh] animate-in">
                    <div class="glass-modal rounded-xl p-8 max-w-md w-full flex flex-col items-center text-center">
                        <div class="w-24 h-24 mb-6 rounded-full bg-white/30 flex items-center justify-center border border-white/40 shadow-inner">
                            <span class="material-symbols-outlined text-4xl text-primary" style="font-variation-settings: 'FILL' 0;">event_busy</span>
                        </div>
                        <h2 class="text-headline-lg-mobile text-on-surface mb-4">No Timetable Uploaded</h2>
                        <p class="text-body-md text-on-surface-variant mb-8 px-4">
                            Your schedule is currently empty. Upload your timetable data to start tracking your attendance seamlessly.
                        </p>
                        <button class="w-full py-3 px-6 rounded-full glass-button-accent text-label-sm flex items-center justify-center gap-2" onclick="App.switchView('settings')">
                            <span class="material-symbols-outlined text-lg">upload_file</span>
                            Upload Data
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const currentDay = this.state.currentTimetableDay || 'MONDAY';

        container.innerHTML = `
            <!-- Day Tab Chips -->
            <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-2 animate-in">
                ${days.map(d => `
                    <button class="day-chip ${d === currentDay ? 'active' : ''}" onclick="App.switchTimetableDay('${d}')">
                        ${d.charAt(0) + d.slice(1, 3).toLowerCase()}
                    </button>
                `).join('')}
            </div>

            <!-- Day Content -->
            <section class="glass-panel rounded-xl p-glass-padding animate-in stagger-1">
                <h3 class="text-headline-lg-mobile text-on-surface mb-1">${currentDay.charAt(0) + currentDay.slice(1).toLowerCase()}</h3>
                <p class="text-label-sm text-on-surface-variant uppercase tracking-wider mb-6">Class: ${this.state.selectedClass || 'N/A'}${this.state.selectedBatch ? ' · ' + this.state.selectedBatch : ''}</p>
                <div class="flex flex-col gap-3">
                    ${this.getTimetableDayHtml(currentDay)}
                </div>
            </section>
        `;
    },

    switchTimetableDay(day) {
        this.state.currentTimetableDay = day;
        this.render();
    },

    getTimetableDayHtml(day) {
        const lectures = this.state.timetableSchedule[day] || [];
        const filtered = lectures.filter(l => this.lectureMatches(l));

        if (filtered.length === 0) {
            return `
                <div class="text-center py-8 flex flex-col items-center">
                    <div class="w-16 h-16 rounded-full bg-white/30 border border-white/40 flex items-center justify-center mb-4 shadow-inner">
                        <span class="material-symbols-outlined text-3xl text-outline-variant">weekend</span>
                    </div>
                    <p class="text-body-md text-on-surface-variant">No lectures scheduled for this day.</p>
                </div>
            `;
        }

        return filtered.map((l, i) => {
            const teacher = this.getTeacherForLecture(l.name);
            return `
                <div class="glass-base rounded-xl px-4 py-3 border border-white/20 flex items-center gap-4 animate-in stagger-${Math.min(i + 1, 8)}">
                    <div class="w-1 h-10 rounded-full bg-secondary shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <div class="text-label-sm text-secondary uppercase tracking-wider mb-0.5">${l.time}</div>
                        <div class="text-body-md font-medium text-on-surface truncate">${l.name}</div>
                        ${teacher ? `<div class="text-label-sm text-on-surface-variant mt-0.5">${teacher}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    // ==================== TASKS ====================

    renderTasks(container) {
        const subjects = this.state.selectedClass && this.state.subjectMappings[this.state.selectedClass] 
            ? Object.keys(this.state.subjectMappings[this.state.selectedClass]) 
            : [];

        const tasksHtml = this.state.tasks.length === 0 ? `
            <div class="text-center py-8 flex flex-col items-center">
                <div class="w-16 h-16 rounded-full bg-white/30 border border-white/40 flex items-center justify-center mb-4 shadow-inner">
                    <span class="material-symbols-outlined text-3xl text-outline-variant">task</span>
                </div>
                <p class="text-body-md text-on-surface-variant">No tasks added yet.</p>
            </div>
        ` : this.state.tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((t, i) => {
            const isOverdue = !t.completed && new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0));
            const colorClass = t.completed ? 'text-green-500' : (isOverdue ? 'text-red-500' : 'text-primary');
            return `
                <div class="glass-base rounded-xl px-4 py-3 border ${t.completed ? 'border-green-500/30' : (isOverdue ? 'border-red-500/30' : 'border-white/20')} flex items-center gap-4 animate-in stagger-${Math.min(i + 1, 8)}">
                    <button class="att-btn ${t.completed ? 'present active' : 'absent'}" onclick="App.toggleTask('${t.id}')">
                        <span class="material-symbols-outlined text-[20px]">${t.completed ? 'check' : 'radio_button_unchecked'}</span>
                    </button>
                    <div class="flex-1 min-w-0 ${t.completed ? 'opacity-60 line-through' : ''}">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-label-sm uppercase tracking-wider ${colorClass}">${t.subject || 'General'}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full border border-current ${colorClass}">${t.type}</span>
                        </div>
                        <div class="text-body-md font-medium text-on-surface truncate">${t.title}</div>
                        <div class="text-label-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                            ${t.dueDate}
                        </div>
                    </div>
                    <button class="att-btn absent shrink-0" onclick="App.deleteTask('${t.id}')">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <section class="glass-panel rounded-xl p-glass-padding animate-in mb-6">
                <h3 class="text-headline-lg-mobile text-on-surface mb-4">Add Task</h3>
                <div class="flex flex-col gap-3">
                    <input type="text" id="task-title" class="glass-input rounded-lg px-3 py-2 text-body-md" placeholder="Task Title (e.g. Lab Report 1)">
                    <div class="flex gap-2">
                        <select id="task-subject" class="glass-input rounded-lg px-3 py-2 text-label-sm flex-1">
                            <option value="">General / No Subject</option>
                            ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                        <select id="task-type" class="glass-input rounded-lg px-3 py-2 text-label-sm w-32">
                            <option value="Assignment">Assignment</option>
                            <option value="Project">Project</option>
                            <option value="Exam">Exam</option>
                        </select>
                    </div>
                    <div class="flex gap-2 items-center">
                        <input type="date" id="task-date" class="glass-input rounded-lg px-3 py-2 text-label-sm flex-1">
                        <button class="glass-button-primary rounded-lg px-4 py-2 text-label-sm flex items-center gap-1 shrink-0" onclick="App.addTask()">
                            <span class="material-symbols-outlined text-[16px]">add</span>
                            Add
                        </button>
                    </div>
                </div>
            </section>

            <section class="glass-panel rounded-xl p-glass-padding animate-in stagger-1">
                <h3 class="text-headline-lg-mobile text-on-surface mb-4">Your Tasks</h3>
                <div class="flex flex-col gap-3">
                    ${tasksHtml}
                </div>
            </section>
        `;
    },

    addTask() {
        const title = document.getElementById('task-title').value;
        const subject = document.getElementById('task-subject').value;
        const type = document.getElementById('task-type').value;
        const dueDate = document.getElementById('task-date').value;

        if (!title || !dueDate) return alert('Title and Due Date are required.');

        this.state.tasks.push({
            id: 'task_' + Date.now(),
            title, subject, type, dueDate, completed: false
        });
        this.saveState();
        this.render();
    },

    toggleTask(id) {
        const task = this.state.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveState();
            this.render();
        }
    },

    deleteTask(id) {
        this.state.tasks = this.state.tasks.filter(t => t.id !== id);
        this.saveState();
        this.render();
    },

    // ==================== STATISTICS ====================

    renderStatistics(container) {
        const stats = this.getStatistics();
        const subjects = Object.entries(stats.subjects);

        const pctColor = stats.overallPct >= 75 ? '#22c55e' : (stats.overallPct >= 50 ? '#eab308' : '#ef4444');

        container.innerHTML = `
            <h2 class="text-headline-lg-mobile text-on-surface mb-4 animate-in">Statistics Overview</h2>

            <!-- Bento Grid: Top Stats -->
            <section class="grid grid-cols-2 gap-gutter mb-6 animate-in stagger-1">
                <!-- Total Days Attended Card -->
                <article class="glass-panel rounded-xl p-glass-padding flex flex-col justify-between aspect-square relative overflow-hidden glass-edge">
                    <div class="flex items-start">
                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                            <span class="material-symbols-outlined text-primary">calendar_month</span>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <div class="text-display-lg text-on-surface mb-1">${stats.totalDaysAttended}</div>
                        <div class="text-label-sm text-on-surface-variant uppercase tracking-wider">Total Days Attended</div>
                    </div>
                </article>
                <!-- Overall % Card -->
                <article class="glass-panel rounded-xl p-glass-padding flex flex-col justify-between aspect-square relative overflow-hidden glass-edge">
                    <div class="flex items-start">
                        <div class="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center">
                            <span class="material-symbols-outlined text-on-secondary-container">donut_large</span>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <div class="text-display-lg mb-1" style="color: ${pctColor}">${stats.overallPct}%</div>
                        <div class="text-label-sm text-on-surface-variant uppercase tracking-wider">Overall %</div>
                    </div>
                </article>
            </section>

            <!-- Subject-wise Attendance Section -->
            <section class="animate-in stagger-2">
                <h3 class="text-body-md font-medium text-on-surface mb-4 pl-1">Subject-wise Attendance</h3>
                ${subjects.length === 0 ? `
                    <div class="glass-panel rounded-xl p-8 text-center flex flex-col items-center relative overflow-hidden min-h-[280px] justify-center">
                        <div class="w-20 h-20 rounded-full bg-surface/50 backdrop-blur-md border border-white/30 shadow-inner flex items-center justify-center mb-6">
                            <span class="material-symbols-outlined text-4xl text-outline-variant">plagiarism</span>
                        </div>
                        <p class="text-body-md text-on-surface-variant mb-8 leading-relaxed">
                            Upload <span class="font-medium text-on-surface">"Divisionallocation"</span> sheet to see subjects.
                        </p>
                        <button class="glass-button-accent rounded-full px-6 py-3 text-label-sm flex items-center gap-2" onclick="App.switchView('settings')">
                            <span class="material-symbols-outlined text-[18px]">upload_file</span>
                            Upload Sheet
                        </button>
                    </div>
                ` : `
                    <div class="glass-panel rounded-xl p-glass-padding flex flex-col gap-5">
                        ${subjects.map(([name, data], i) => {
                            const subPct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
                            const color = subPct >= 75 ? '#22c55e' : (subPct >= 50 ? '#eab308' : '#ef4444');
                            return `
                                <div class="animate-in stagger-${Math.min(i + 1, 8)}">
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex-1 min-w-0">
                                            <span class="text-body-md font-medium text-on-surface">${name}</span>
                                            ${data.teacher ? `<br><span class="text-label-sm text-on-surface-variant">${data.teacher}</span>` : ''}
                                        </div>
                                        <span class="text-body-md font-bold shrink-0 ml-3" style="color: ${color}">${subPct}%</span>
                                    </div>
                                    <div class="progress-track">
                                        <div class="progress-fill" style="width: ${subPct}%; background: ${color};"></div>
                                    </div>
                                    <div class="flex justify-between mt-1">
                                        <span class="text-label-sm text-on-surface-variant">${data.present} / ${data.total} Lectures</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </section>
        `;
    },

    // ==================== SETTINGS ====================

    renderSettings(container) {
        container.innerHTML = `
            <!-- Preferences Section -->
            <section class="glass-panel rounded-xl p-glass-padding flex flex-col gap-4 animate-in mb-6">
                <h2 class="text-headline-lg-mobile text-on-surface mb-2">Preferences</h2>
                
                <div class="flex items-center justify-between py-2 border-b border-white/10">
                    <div class="flex flex-col">
                        <span class="text-body-md text-on-surface">Dark Mode</span>
                        <span class="text-label-sm text-on-surface-variant">Midnight Glass theme</span>
                    </div>
                    <button class="${this.state.theme === 'dark' ? 'glass-button-primary' : 'glass-button-ghost'} rounded-full p-2 flex items-center justify-center transition-all" onclick="App.toggleTheme()">
                        <span class="material-symbols-outlined">${this.state.theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
                    </button>
                </div>

                <div class="flex items-center justify-between py-2">
                    <div class="flex flex-col">
                        <span class="text-body-md text-on-surface">Daily Reminders</span>
                        <span class="text-label-sm text-on-surface-variant">Get notified for classes</span>
                    </div>
                    <button class="${this.state.notificationsEnabled ? 'glass-button-primary bg-green-500/80 border-green-500' : 'glass-button-ghost'} rounded-full px-4 py-2 text-label-sm flex items-center gap-1 transition-all" onclick="App.toggleNotifications()">
                        <span class="material-symbols-outlined text-[16px]">${this.state.notificationsEnabled ? 'notifications_active' : 'notifications_off'}</span>
                        ${this.state.notificationsEnabled ? 'Enabled' : 'Enable'}
                    </button>
                </div>
            </section>

            <!-- Setup Section -->
            <section class="glass-panel rounded-xl p-glass-padding flex flex-col gap-6 animate-in">
                <header>
                    <h2 class="text-headline-lg-mobile text-on-surface mb-2">Setup</h2>
                    <p class="text-body-md text-on-surface-variant">Configure your semester dates to initialize your attendance tracking.</p>
                </header>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Start Date</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">event</span>
                            <input type="date" id="sem-start" class="glass-input w-full rounded-lg py-2.5 pl-10 pr-3 text-body-md text-on-surface" value="${this.state.semester.start}">
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">End Date</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">event</span>
                            <input type="date" id="sem-end" class="glass-input w-full rounded-lg py-2.5 pl-10 pr-3 text-body-md text-on-surface" value="${this.state.semester.end}">
                        </div>
                    </div>
                </div>
                <div class="flex justify-end mt-2">
                    <button class="glass-button-primary rounded-full px-6 py-2.5 text-label-sm flex items-center gap-2" onclick="App.saveSemesterDates()">
                        <span class="material-symbols-outlined text-[18px]">save</span>
                        Save Settings
                    </button>
                </div>
            </section>

            <!-- Upload Timetable Section -->
            <section class="glass-panel rounded-xl p-glass-padding flex flex-col gap-6 animate-in stagger-1">
                <header>
                    <h2 class="text-headline-lg-mobile text-on-surface mb-2">Upload Timetable</h2>
                    <p class="text-body-md text-on-surface-variant">${this.state.lastUploadedFile ? 'Active: <span class="font-medium text-on-surface">' + this.state.lastUploadedFile + '</span>' : 'Import your class schedule to begin tracking attendance.'}</p>
                </header>
                <div class="flex flex-col gap-4">
                    ${(this.state.sheetNames || []).length > 1 ? `
                        <div class="flex flex-col gap-2">
                            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Timetable Sheet</label>
                            <select class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface" onchange="App.changeSheet(this.value, 'timetable')">
                                ${this.state.sheetNames.map(s => `<option value="${s}" ${s === this.state.selectedSheet ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Allocation Sheet</label>
                            <select class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface" onchange="App.changeSheet(this.value, 'allocation')">
                                <option value="">-- Auto-detect --</option>
                                ${this.state.sheetNames.map(s => `<option value="${s}" ${s === this.state.selectedAllocSheet ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <div class="flex flex-col gap-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Class Name (e.g. DIEC)</label>
                        <input type="text" id="manual-class" class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface" value="${this.state.selectedClass || ''}" oninput="this.value=this.value.toUpperCase()" onchange="App.selectClass(this.value)" placeholder="Enter class name">
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Select Batch</label>
                        <select class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface" onchange="App.selectBatch(this.value)">
                            <option value="">-- All Batches --</option>
                            <option value="B1" ${this.state.selectedBatch === 'B1' ? 'selected' : ''}>Batch 1 (B1)</option>
                            <option value="B2" ${this.state.selectedBatch === 'B2' ? 'selected' : ''}>Batch 2 (B2)</option>
                            <option value="B3" ${this.state.selectedBatch === 'B3' ? 'selected' : ''}>Batch 3 (B3)</option>
                        </select>
                    </div>

                    ${(this.state.classes || []).length > 0 ? `
                        <div class="flex flex-col gap-2">
                            <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Or select detected class</label>
                            <select class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface" onchange="App.selectClass(this.value)">
                                <option value="">-- Select --</option>
                                ${this.state.classes.map(c => `<option value="${c}" ${c === this.state.selectedClass ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <!-- File Upload Zone -->
                    <div class="flex flex-col gap-2 mt-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Timetable File</label>
                        <div class="upload-zone rounded-xl p-8 flex flex-col items-center justify-center" id="upload-drop-zone">
                            <span class="material-symbols-outlined text-4xl text-outline mb-2" style="font-variation-settings: 'FILL' 0;">upload_file</span>
                            <p class="text-body-md text-on-surface text-center">Drag and drop your Excel file here</p>
                            <p class="text-label-sm text-on-surface-variant text-center mt-1">or click to browse (.xlsx, .xls)</p>
                            <input type="file" id="excel-upload" accept=".xlsx, .xls" class="hidden">
                        </div>
                    </div>
                </div>

                ${this.state.selectedClass && this.state.subjectMappings[this.state.selectedClass] ? `
                    <div class="mt-2">
                        <label class="text-label-sm text-secondary uppercase tracking-wider mb-3 block">Detected Subjects (${this.state.selectedClass})</label>
                        <div class="glass-base rounded-xl p-4 border border-white/20">
                            ${Object.entries(this.state.subjectMappings[this.state.selectedClass]).map(([sub, teacher]) => `
                                <div class="flex justify-between items-center py-2 border-b border-white/10 last:border-b-0">
                                    <span class="text-body-md font-medium text-on-surface">${sub}</span>
                                    <span class="text-label-sm text-on-surface-variant">${teacher}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </section>

            <!-- Holidays Section -->
            <section class="glass-panel rounded-xl p-glass-padding flex flex-col gap-4 animate-in stagger-2">
                <h3 class="text-headline-lg-mobile text-on-surface">Holidays</h3>
                <div class="flex gap-3 items-end">
                    <div class="flex-1 flex flex-col gap-2">
                        <label class="text-label-sm text-on-surface-variant uppercase tracking-wider">Add Holiday</label>
                        <input type="date" id="holiday-picker" class="glass-input w-full rounded-lg px-4 py-2.5 text-body-md text-on-surface">
                    </div>
                    <button class="glass-button-primary rounded-full px-5 py-2.5 text-label-sm flex items-center gap-1 shrink-0" onclick="App.addHoliday(document.getElementById('holiday-picker').value)">
                        <span class="material-symbols-outlined text-[16px]">add</span>
                        Add
                    </button>
                </div>
                <div class="max-h-[200px] overflow-y-auto hide-scrollbar">
                    ${(this.state.holidays || []).length === 0 ? '<p class="text-label-sm text-on-surface-variant py-2">No holidays added.</p>' : ''}
                    ${this.state.holidays.map(d => `
                        <div class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-b-0">
                            <span class="text-body-md text-on-surface">${d}</span>
                            <button class="att-btn absent" style="width: 32px; height: 32px;" onclick="App.removeHoliday('${d}')">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- Reset Section -->
            <section class="glass-panel rounded-xl p-glass-padding animate-in stagger-3" style="border-color: rgba(186,26,26,0.15);">
                <h3 class="text-headline-lg-mobile text-error mb-4">Reset</h3>
                <p class="text-body-md text-on-surface-variant mb-4">Clear all app data and start fresh. This action cannot be undone.</p>
                <button class="glass-button-danger rounded-full px-6 py-2.5 text-label-sm flex items-center gap-2" onclick="App.resetApp()">
                    <span class="material-symbols-outlined text-[18px]">delete_forever</span>
                    Reset All Data
                </button>
            </section>
        `;

        // Bind upload events
        const uploadEl = document.getElementById('excel-upload');
        const dropZone = document.getElementById('upload-drop-zone');

        if (uploadEl) {
            uploadEl.onchange = (e) => this.handleExcelUpload(e);
        }

        if (dropZone) {
            dropZone.onclick = () => uploadEl && uploadEl.click();
            dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
            dropZone.ondragleave = () => dropZone.classList.remove('dragover');
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    this.processFile(file);
                }
            };
        }
    },

    // ==================== BACKEND LOGIC (PRESERVED) ====================

    toggleNotifications() {
        if (this.state.notificationsEnabled) {
            this.state.notificationsEnabled = false;
            this.saveState();
            this.render();
            return;
        }

        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
            return;
        }

        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                this.state.notificationsEnabled = true;
                this.saveState();
                this.render();
                new Notification("AttendEase Reminders Enabled!", {
                    body: "You'll now receive daily reminders for your classes.",
                    icon: "icons/icon-192.png"
                });
            } else {
                alert("Permission denied. We can't send you reminders.");
            }
        });
    },

    checkAndSendDailyReminder() {
        if (!this.state.notificationsEnabled || Notification.permission !== "granted") return;

        const todayDate = new Date().toISOString().split('T')[0];
        const lastReminded = localStorage.getItem('attendease_last_reminder');
        
        if (lastReminded === todayDate) return; // Already reminded today

        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const timetable = this.state.timetableSchedule || {};
        const lectures = timetable[dayName] || [];
        
        let count = 0;
        lectures.forEach(l => { if (this.lectureMatches(l)) count++; });
        
        // Also add extras
        const extras = this.state.extraLectures.filter(l => l.date === todayDate);
        count += extras.length;

        const isHoliday = (this.state.holidays || []).includes(todayDate);

        if (count > 0 && !isHoliday) {
            // Check if they already marked attendance for all of them
            let markedCount = 0;
            if (this.state.attendance[todayDate]) {
                markedCount = Object.keys(this.state.attendance[todayDate]).length;
            }

            if (markedCount < count) {
                new Notification("Classes Today!", {
                    body: `You have ${count} classes scheduled today. Don't forget to track your attendance!`,
                    icon: "icons/icon-192.png"
                });
                localStorage.setItem('attendease_last_reminder', todayDate);
            }
        }
    },

    saveSemesterDates() {
        const start = document.getElementById('sem-start').value;
        const end = document.getElementById('sem-end').value;
        if (!start || !end) return alert('Fill both');
        this.state.semester = { start, end };
        this.saveState();
        alert('Saved!');
    },

    processFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = new Uint8Array(ev.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            this.state.sheetNames = wb.SheetNames;
            this.state.lastUploadedFile = file.name;

            // Temporary store for current session
            this.temp.allSheetsJSON = {};
            wb.SheetNames.forEach(n => {
                this.temp.allSheetsJSON[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
            });

            // 1. Find and parse Allocation sheet
            const allocSheetName = wb.SheetNames.find(n => n.toUpperCase().includes('ALLOCATION') || n.toUpperCase().includes('DIV'));
            this.state.selectedAllocSheet = allocSheetName || '';
            console.log('Detected Allocation Sheet:', this.state.selectedAllocSheet);
            if (this.state.selectedAllocSheet) {
                this.parseAllocationSheet(this.temp.allSheetsJSON[this.state.selectedAllocSheet]);
            }

            // 2. Auto-select Timetable sheet or default to first
            const timetableSheetName = wb.SheetNames.find(n => n.toUpperCase().includes('TIMETABLE') || n.toUpperCase().includes('SCHEDULE')) || wb.SheetNames[0];
            this.state.selectedSheet = timetableSheetName;

            const activeData = this.temp.allSheetsJSON[this.state.selectedSheet];
            this.state.rawTimetable = activeData;
            this.parseTimetable(activeData);

            this.saveState();
            this.render();
            alert(`File uploaded! Detected ${this.state.classes.length} classes.`);
        };
        reader.readAsArrayBuffer(file);
    },

    handleExcelUpload(e) {
        const file = e.target.files[0];
        this.processFile(file);
    },

    parseAllocationSheet(data) {
        if (!data || data.length === 0) { console.warn('No data in allocation sheet'); return; }

        let mappings = {}; // { className: { subject: teacher } }
        let classColumns = []; // [ { name, colIndex } ]

        console.log('Parsing Allocation Data, rows:', data.length);

        data.forEach((row, rowIndex) => {
            // Header Detection: Look for a row that has class codes (D2A, DIEC, etc.)
            const detectedClassesInRow = row.map((cell, i) => {
                const val = String(cell || '').trim().toUpperCase();
                if (!val) return null;
                // Looser regex: D followed by numbers/letters, or common 3-4 char codes
                const isClass = /^[A-DA-Z]\d+[A-Z]*$/.test(val) || val.length === 3 || val.length === 4;
                // Exclude common noise
                const isNoise = ['VES', 'TIME', 'ROOM', 'DAY', 'SUBJ', 'TEACH'].some(n => val.includes(n));
                return (isClass && !isNoise) ? { name: val, index: i } : null;
            }).filter(x => x);

            if (detectedClassesInRow.length > 2) {
                console.log(`Found class header row at index ${rowIndex}:`, detectedClassesInRow.map(c => c.name));
                classColumns = detectedClassesInRow;
                classColumns.forEach(c => { if (!mappings[c.name]) mappings[c.name] = {}; });
            } else if (classColumns.length > 0) {
                // Subject Data Row: Col 0 is subject, Col [index] is teacher
                const subjectName = String(row[0] || '').trim().replace(/\n/g, ' ').toUpperCase();
                if (subjectName && subjectName.length >= 2 && subjectName.length < 25 && !subjectName.includes('VES')) {
                    classColumns.forEach(cls => {
                        let teacherName = String(row[cls.index] || '').trim().replace(/\n/g, ' ');
                        if (!teacherName || teacherName.toLowerCase() === 'null') teacherName = 'Assigned';
                        mappings[cls.name][subjectName] = teacherName;
                    });
                }
            }
        });

        this.state.subjectMappings = mappings;
        console.log('Final Subject Mappings:', Object.keys(mappings));
    },

    changeSheet(name, type) {
        if (type === 'timetable') {
            this.state.selectedSheet = name;
            if (this.temp.allSheetsJSON && this.temp.allSheetsJSON[name]) {
                const data = this.temp.allSheetsJSON[name];
                this.state.rawTimetable = data;
                this.parseTimetable(data);
            }
        } else if (type === 'allocation') {
            this.state.selectedAllocSheet = name;
            if (this.temp.allSheetsJSON && this.temp.allSheetsJSON[name]) {
                this.parseAllocationSheet(this.temp.allSheetsJSON[name]);
            }
        }
        this.saveState();
        this.render();
    },

    parseTimetable(data) {
        if (!data || data.length === 0) return;
        this.state.classes = [];
        let mappings = {}, schedule = {}, currentDay = '';
        const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const abbr = { 'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY', 'THU': 'THURSDAY', 'FRI': 'FRIDAY', 'SAT': 'SATURDAY' };
        const noise = ['BREAK', 'LUNCH', 'RECESS', 'TIME', 'ROOM', 'LAB', 'LEC', 'SEC', 'SEM', 'YEAR', 'DURATION', 'SUBJECT', 'TEACHER', 'FACULTY', 'CLASS'];

        data.forEach((row, rowIndex) => {
            // Check for Day names
            row.forEach(cell => {
                const val = String(cell || '').toUpperCase().trim();
                const d = days.find(d => val === d || val.startsWith(d + ' '));
                if (d) { currentDay = d; if (!schedule[d]) schedule[d] = []; }
                else {
                    const a = Object.keys(abbr).find(a => val === a || val.startsWith(a + ' '));
                    if (a) { currentDay = abbr[a]; if (!schedule[currentDay]) schedule[currentDay] = []; }
                }
            });

            // Header/Class Detection
            const isPotentialHeader = row.some(c => {
                if (typeof c !== 'string') return false;
                const clean = c.trim().toUpperCase();
                return clean.length >= 3 && clean.length <= 8 && !noise.includes(clean) && !days.includes(clean) && !abbr[clean];
            });

            if (isPotentialHeader) {
                row.forEach((cell, i) => {
                    if (cell && i > 0) {
                        const cellStr = String(cell).toUpperCase().trim();
                        const parts = cellStr.split(/[\s\/(,)]+/);
                        parts.forEach(p => {
                            if (p.length >= 3 && !noise.includes(p) && !days.includes(p) && !abbr[p] && !/^\d+$/.test(p)) {
                                if (!this.state.classes.includes(p)) this.state.classes.push(p);
                                if (!mappings[i]) mappings[i] = [];
                                if (!mappings[i].includes(p)) mappings[i].push(p);
                            }
                        });
                    }
                });
            }

            // Process Lectures (Time row)
            const first = String(row[0] || '').toUpperCase().trim();
            const isTime = /(\d{1,2})[\.:](\d{2})/.test(first) || first.includes('AM') || first.includes('PM');

            if (currentDay && isTime) {
                Object.keys(mappings).forEach(i => {
                    const content = row[i];
                    if (content && String(content).trim().length > 1) {
                        const cleanContent = String(content).trim();
                        if (!noise.includes(cleanContent.toUpperCase())) {
                            mappings[i].forEach(cls => {
                                schedule[currentDay].push({ time: first, name: cleanContent, className: cls });
                            });
                        }
                    }
                });
            }
        });

        this.state.timetableSchedule = schedule;
        this.saveState();
    },

    selectClass(cls) { this.state.selectedClass = cls.toUpperCase(); this.saveState(); this.render(); },

    selectBatch(batch) { this.state.selectedBatch = batch; this.saveState(); this.render(); },

    lectureMatches(l) {
        if (!l) return false;
        const myClass = (this.state.selectedClass || '').toUpperCase();
        const normalize = (s) => (s || '').replace(/I/g, '1').toUpperCase();
        const myClassNorm = normalize(myClass);

        const lClass = (l.className || '').toUpperCase();
        if (lClass !== myClass && normalize(lClass) !== myClassNorm) return false;

        // Batch filtering
        if (this.state.selectedBatch) {
            const name = (l.name || '').toUpperCase();
            if (name.includes('(B') && !name.includes(`(${this.state.selectedBatch})`)) return false;
        }
        return true;
    },

    getTeacherForLecture(lectureName) {
        const mappings = this.state.subjectMappings[this.state.selectedClass] || {};
        const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/II/g, '2');
        const search = clean(lectureName.split('(')[0].split('-')[0].trim());

        const matchedKey = Object.keys(mappings).find(s => {
            const target = clean(s);
            return search.startsWith(target) || target.startsWith(search);
        });
        return mappings[matchedKey] || '';
    },

    markAttendance(date, id, status) {
        if (!this.state.attendance[date]) this.state.attendance[date] = {};
        if (this.state.attendance[date][id] === status) delete this.state.attendance[date][id];
        else this.state.attendance[date][id] = status;
        this.saveState(); this.render();
    },

    markBatchAttendance(date, status) {
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
        const dayKey = dayName.toUpperCase();
        const timetable = this.state.timetableSchedule || {};
        const lectures = timetable[dayKey] || [];

        if (!this.state.attendance[date]) this.state.attendance[date] = {};

        lectures.forEach((l, originalIndex) => {
            if (this.lectureMatches(l)) {
                const id = `${date}-${dayKey}-${originalIndex}`;
                this.state.attendance[date][id] = status;
            }
        });

        // Also extras for that day
        this.state.extraLectures.filter(l => l.date === date).forEach(l => {
            this.state.attendance[date][l.id] = status;
        });

        this.saveState();
        this.render();
    },

    toggleHoliday(date) {
        if (!date) return;
        if (this.state.holidays.includes(date)) {
            this.state.holidays = this.state.holidays.filter(d => d !== date);
        } else {
            this.state.holidays.push(date);
        }
        this.saveState();
        this.render();
    },

    addHoliday(date) {
        if (!date) return;
        if (!this.state.holidays.includes(date)) {
            this.state.holidays.push(date);
            this.saveState();
            this.render();
        }
    },

    removeHoliday(date) {
        this.state.holidays = this.state.holidays.filter(d => d !== date);
        this.saveState();
        this.render();
    },

    resetApp() { if (confirm('Reset all?')) { localStorage.removeItem('attendease_state'); window.location.reload(); } },

    getStatistics() {
        const attendance = this.state.attendance || {};
        const timetable = this.state.timetableSchedule || {};
        const mappings = this.state.subjectMappings[this.state.selectedClass] || {};
        const holidays = this.state.holidays || [];

        let stats = {
            overallPct: 0,
            totalDaysAttended: 0,
            subjects: {} // { name: { present, total, teacher } }
        };

        let totalLectures = 0;
        let presentLectures = 0;
        let daysWithMajority = 0;

        // Initialize helper to clean subject names
        const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/II/g, '2');

        // Initialize total counts from attendance data
        Object.entries(attendance).forEach(([date, lectures]) => {
            if (holidays.includes(date)) return;

            let dayTotal = 0;
            let dayPresent = 0;

            Object.entries(lectures).forEach(([id, status]) => {
                const parts = id.split('-');
                if (parts.length < 3) return;

                const index = parseInt(parts[parts.length - 1]);
                const dayKey = parts[parts.length - 2];
                const dayLectures = timetable[dayKey] || [];
                const lecture = dayLectures[index];

                if (lecture && this.lectureMatches(lecture)) {
                    dayTotal++;
                    const fullName = lecture.name.toUpperCase();
                    const isLab = fullName.includes('LAB') || fullName.includes('PRACTICAL') || fullName.includes('PRAC');

                    // Base name search (before parentheses or dashes)
                    const baseInput = fullName.split('(')[0].split('-')[0].trim();
                    const search = clean(baseInput);

                    let matchedBaseSub = Object.keys(mappings).find(s => {
                        const target = clean(s);
                        return search.startsWith(target) || target.startsWith(search);
                    });

                    // Construct display name
                    const subLabel = matchedBaseSub || baseInput;
                    const finalKey = `${subLabel} (${isLab ? 'Lab' : 'Theory'})`;

                    if (!stats.subjects[finalKey]) {
                        stats.subjects[finalKey] = {
                            present: 0,
                            total: 0,
                            teacher: mappings[matchedBaseSub] || ''
                        };
                    }

                    stats.subjects[finalKey].total++;
                    if (status === 'present') {
                        dayPresent++;
                        stats.subjects[finalKey].present++;
                        presentLectures++;
                    }
                    totalLectures++;
                }
            });

            if (dayTotal > 0 && (dayPresent / dayTotal) >= 0.5) {
                daysWithMajority++;
            }
        });

        stats.overallPct = totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : 0;
        stats.totalDaysAttended = daysWithMajority;

        return stats;
    }
};

App.init();
