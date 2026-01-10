/**
 * Main App Module - Orchestrates all components
 */

class App {
    constructor() {
        this.settings = null;
        this.currentLog = {
            productivity: null,
            category: null,
            note: ''
        };
        this.currentSlot = null;
        this.selectedDate = new Date();
        this.editingSlot = null;
        this.editingLog = null;
    }

    async init() {
        try {
            // Initialize storage
            await storage.init();
            console.log('Storage initialized');

            // Initialize notifications
            await notifications.init();
            console.log('Notifications initialized');

            // Initialize scheduler
            await scheduler.init();
            console.log('Scheduler initialized');

            // Load settings
            this.settings = await storage.getAllSettings();
            console.log('Settings loaded:', this.settings);

            // Bind event listeners
            this.bindEvents();

            // Check onboarding status
            if (this.settings.onboardingComplete) {
                this.showDashboard();
                this.startTracking();
            } else {
                this.showOnboarding();
            }

            // Register service worker
            this.registerServiceWorker();

        } catch (error) {
            console.error('App initialization failed:', error);
        }
    }

    bindEvents() {
        // Onboarding interval buttons
        document.querySelectorAll('#onboarding .interval-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#onboarding .interval-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Onboarding custom interval
        document.getElementById('apply-custom-interval')?.addEventListener('click', () => {
            const input = document.getElementById('custom-interval');
            const minutes = parseInt(input.value);
            if (minutes && minutes > 0) {
                document.querySelectorAll('#onboarding .interval-btn').forEach(b => b.classList.remove('active'));
                input.dataset.activeInterval = minutes / 60;
            }
        });

        document.getElementById('start-btn').addEventListener('click', () => this.completeOnboarding());

        // Dashboard
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
        document.getElementById('log-now-btn').addEventListener('click', () => this.showQuickLog());

        // Date navigation
        document.getElementById('prev-date')?.addEventListener('click', () => this.navigateDate(-1));
        document.getElementById('next-date')?.addEventListener('click', () => this.navigateDate(1));
        document.getElementById('date-picker-btn')?.addEventListener('click', () => {
            const dateInput = document.getElementById('date-input');
            dateInput.showPicker();
        });
        document.getElementById('date-input')?.addEventListener('change', (e) => {
            this.selectedDate = new Date(e.target.value + 'T12:00:00');
            this.refreshDashboard();
        });

        // Quick Log
        document.getElementById('close-log').addEventListener('click', () => this.hideQuickLog());
        document.getElementById('save-log-btn')?.addEventListener('click', () => this.saveLog());

        // Slot navigation in quick log
        document.getElementById('prev-slot')?.addEventListener('click', () => this.navigateSlot(-1));
        document.getElementById('next-slot')?.addEventListener('click', () => this.navigateSlot(1));

        document.querySelectorAll('.prod-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectProductivity(e.currentTarget));
        });

        // Settings
        document.getElementById('back-btn').addEventListener('click', () => this.hideSettings());

        document.querySelectorAll('#settings .interval-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.updateInterval(e.target));
        });

        // Settings custom interval
        document.getElementById('settings-apply-interval')?.addEventListener('click', () => {
            const input = document.getElementById('settings-custom-interval');
            const minutes = parseInt(input.value);
            if (minutes && minutes > 0) {
                this.updateSetting('reminderInterval', minutes / 60);
                document.querySelectorAll('#settings .interval-btn').forEach(b => b.classList.remove('active'));
                input.value = '';
            }
        });

        document.getElementById('settings-quiet-start').addEventListener('change', (e) => {
            this.updateSetting('quietHoursStart', e.target.value);
        });

        document.getElementById('settings-quiet-end').addEventListener('change', (e) => {
            this.updateSetting('quietHoursEnd', e.target.value);
        });

        document.getElementById('tracking-toggle').addEventListener('change', (e) => {
            this.updateSetting('trackingEnabled', e.target.checked);
            if (e.target.checked) {
                this.startTracking();
            } else {
                scheduler.stop();
            }
        });

        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearData());

        // Add category modal
        document.getElementById('add-category-btn').addEventListener('click', () => this.showAddCategoryModal());
        document.getElementById('cancel-category')?.addEventListener('click', () => this.hideAddCategoryModal());
        document.getElementById('save-category')?.addEventListener('click', () => this.saveNewCategory());
        document.querySelector('#category-modal .modal-backdrop')?.addEventListener('click', () => this.hideAddCategoryModal());

        // Edit slot modal
        document.getElementById('cancel-edit-slot')?.addEventListener('click', () => this.hideEditSlotModal());
        document.getElementById('save-edit-slot')?.addEventListener('click', () => this.saveEditedSlot());
        document.getElementById('delete-slot')?.addEventListener('click', () => this.deleteSlot());
        document.querySelector('#edit-slot-modal .modal-backdrop')?.addEventListener('click', () => this.hideEditSlotModal());

        // Mini productivity buttons in edit modal
        document.querySelectorAll('.mini-prod-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mini-prod-btn').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                this.editingLog.productivity = parseInt(e.currentTarget.dataset.level);
            });
        });

        // Toast notification buttons
        document.getElementById('toast-log-btn')?.addEventListener('click', () => {
            this.hideToast();
            this.showQuickLog();
        });
        document.getElementById('toast-dismiss')?.addEventListener('click', () => {
            this.hideToast();
        });
    }

    // Date navigation
    navigateDate(delta) {
        this.selectedDate.setDate(this.selectedDate.getDate() + delta);
        this.refreshDashboard();
    }

    formatDateDisplay(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    // Screen navigation
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }

    showOnboarding() {
        this.showScreen('onboarding');
    }

    showDashboard() {
        this.showScreen('dashboard');
        this.refreshDashboard();
    }

    showQuickLog(slotHour = null, isEdit = false) {
        // Calculate current slot
        const now = new Date();
        const interval = this.settings.reminderInterval;

        if (slotHour === null) {
            // Default to the most recent completed slot
            const currentHour = now.getHours() + now.getMinutes() / 60;
            slotHour = Math.floor(currentHour / interval) * interval;
            // If we're at the start of a slot, go to previous
            if (currentHour - slotHour < 0.1) {
                slotHour = Math.max(0, slotHour - interval);
            }
        }

        this.currentSlot = {
            hour: slotHour,
            interval,
            date: new Date(this.selectedDate)
        };

        // Update title
        document.getElementById('log-title').textContent = isEdit ? 'Edit Entry' : 'Log Your Time';

        // Update slot display
        this.updateSlotDisplay();

        // Reset selections
        this.currentLog = { productivity: null, category: null, note: '' };
        document.querySelectorAll('.prod-btn').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('selected'));
        document.getElementById('log-note').value = '';

        // Render category pills
        this.renderCategoryPills();

        this.showScreen('quick-log');
    }

    // Navigate between slots in quick log
    navigateSlot(delta) {
        const interval = this.settings.reminderInterval;
        let newHour = this.currentSlot.hour + (delta * interval);

        // Handle day boundaries
        if (newHour < 0) {
            // Go to previous day
            this.currentSlot.date.setDate(this.currentSlot.date.getDate() - 1);
            newHour = 24 + newHour;
        } else if (newHour >= 24) {
            // Go to next day
            this.currentSlot.date.setDate(this.currentSlot.date.getDate() + 1);
            newHour = newHour - 24;
        }

        this.currentSlot.hour = newHour;
        this.updateSlotDisplay();
    }

    // Update the slot time display
    updateSlotDisplay() {
        const timeRange = scheduler.getSlotTimeRange(this.currentSlot.hour, this.currentSlot.interval);
        const isToday = this.currentSlot.date.toDateString() === new Date().toDateString();
        const dateLabel = isToday ? '' : ` (${this.currentSlot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
        document.getElementById('log-time-label').textContent = timeRange.display + dateLabel;
    }

    hideQuickLog() {
        this.showScreen('dashboard');
        this.refreshDashboard();
    }

    showSettings() {
        // Update UI with current settings
        document.querySelectorAll('#settings .interval-btn').forEach(btn => {
            const interval = parseFloat(btn.dataset.interval);
            btn.classList.toggle('active', Math.abs(interval - this.settings.reminderInterval) < 0.001);
        });

        document.getElementById('settings-quiet-start').value = this.settings.quietHoursStart;
        document.getElementById('settings-quiet-end').value = this.settings.quietHoursEnd;
        document.getElementById('tracking-toggle').checked = this.settings.trackingEnabled;

        this.renderCategoryList();
        this.showScreen('settings');
    }

    hideSettings() {
        this.showScreen('dashboard');
        this.refreshDashboard();
    }

    // Add Category Modal
    showAddCategoryModal() {
        document.getElementById('new-category-emoji').value = '';
        document.getElementById('new-category-name').value = '';
        document.getElementById('category-modal').classList.remove('hidden');
    }

    hideAddCategoryModal() {
        document.getElementById('category-modal').classList.add('hidden');
    }

    async saveNewCategory() {
        const emoji = document.getElementById('new-category-emoji').value.trim() || '📦';
        const name = document.getElementById('new-category-name').value.trim();

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        const id = name.toLowerCase().replace(/\s+/g, '-');
        const newCategory = { id, name, emoji, isDefault: false };

        this.settings.categories.push(newCategory);
        await storage.setSetting('categories', this.settings.categories);

        this.hideAddCategoryModal();
        this.renderCategoryList();
    }

    // Edit Slot Modal
    showEditSlotModal(slotHour, existingLog = null) {
        this.editingSlot = {
            hour: slotHour,
            interval: this.settings.reminderInterval,
            date: this.selectedDate
        };

        this.editingLog = existingLog ? { ...existingLog } : {
            productivity: null,
            category: null
        };

        // Update time label
        const timeRange = scheduler.getSlotTimeRange(slotHour, this.settings.reminderInterval);
        document.getElementById('edit-slot-time').textContent = timeRange.display;

        // Reset and set productivity button selection
        document.querySelectorAll('.mini-prod-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (this.editingLog.productivity !== null && parseInt(btn.dataset.level) === this.editingLog.productivity) {
                btn.classList.add('selected');
            }
        });

        // Render category pills for edit modal
        this.renderEditCategoryPills();

        // Show/hide delete button based on whether this is an existing log
        document.getElementById('delete-slot').style.display = existingLog?.id ? 'block' : 'none';

        document.getElementById('edit-slot-modal').classList.remove('hidden');
    }

    hideEditSlotModal() {
        document.getElementById('edit-slot-modal').classList.add('hidden');
        this.editingSlot = null;
        this.editingLog = null;
    }

    renderEditCategoryPills() {
        const container = document.getElementById('edit-category-pills');
        container.innerHTML = '';

        this.settings.categories.forEach(cat => {
            const pill = document.createElement('button');
            pill.className = 'category-pill';
            if (this.editingLog?.category === cat.id) {
                pill.classList.add('selected');
            }
            pill.innerHTML = `<span class="emoji">${cat.emoji}</span><span>${cat.name}</span>`;
            pill.addEventListener('click', () => {
                container.querySelectorAll('.category-pill').forEach(p => p.classList.remove('selected'));
                pill.classList.add('selected');
                this.editingLog.category = cat.id;
            });
            container.appendChild(pill);
        });
    }

    async saveEditedSlot() {
        if (this.editingLog.productivity === null) {
            alert('Please select a productivity level');
            return;
        }

        const slotStart = new Date(this.editingSlot.date);
        slotStart.setHours(this.editingSlot.hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setHours(slotStart.getHours() + this.editingSlot.interval);

        if (this.editingLog.id) {
            // Update existing log
            await storage.updateLog(this.editingLog.id, {
                productivity: this.editingLog.productivity,
                category: this.editingLog.category
            });
        } else {
            // Create new log
            const entry = {
                slotStart: slotStart.toISOString(),
                slotEnd: slotEnd.toISOString(),
                slotHour: this.editingSlot.hour,
                productivity: this.editingLog.productivity,
                category: this.editingLog.category,
                note: '',
                source: 'manual'
            };
            await storage.addLog(entry);
        }

        this.hideEditSlotModal();
        this.refreshDashboard();
    }

    async deleteSlot() {
        if (this.editingLog?.id) {
            if (confirm('Delete this entry?')) {
                await storage.deleteLog(this.editingLog.id);
                this.hideEditSlotModal();
                this.refreshDashboard();
            }
        } else {
            this.hideEditSlotModal();
        }
    }

    // Onboarding complete
    async completeOnboarding() {
        // Get selected interval
        const activeBtn = document.querySelector('#onboarding .interval-btn.active');
        const customInput = document.getElementById('custom-interval');

        let interval = 2;
        if (activeBtn) {
            interval = parseFloat(activeBtn.dataset.interval) || 2;
        } else if (customInput?.dataset.activeInterval) {
            interval = parseFloat(customInput.dataset.activeInterval);
        }

        // Get quiet hours
        const quietStart = document.getElementById('quiet-start').value;
        const quietEnd = document.getElementById('quiet-end').value;

        // Save settings
        await storage.setSetting('reminderInterval', interval);
        await storage.setSetting('quietHoursStart', quietStart);
        await storage.setSetting('quietHoursEnd', quietEnd);
        await storage.setSetting('onboardingComplete', true);

        // Request notification permission
        const granted = await notifications.requestPermission();
        if (!granted) {
            console.warn('Notification permission not granted');
        }

        // Reload settings
        this.settings = await storage.getAllSettings();

        // Show dashboard and start tracking
        this.showDashboard();
        this.startTracking();
    }

    // Start tracking
    startTracking() {
        scheduler.start(this.settings, async (isMissed) => {
            console.log('🔔 Notification triggered!', isMissed ? '(missed)' : '(new slot)');

            // Show in-app toast notification
            this.showToast(isMissed);

            // Also try browser notification
            await notifications.showProductivityReminder();

            // Play a sound if available
            this.playNotificationSound();
        });
    }

    // Show in-app toast notification
    showToast(isMissed = false) {
        const toast = document.getElementById('notification-toast');
        const message = document.getElementById('toast-message');

        if (isMissed) {
            message.textContent = "You have a pending log to complete!";
        } else {
            const interval = this.settings.reminderInterval;
            const now = new Date();
            const slotHour = Math.floor((now.getHours() + now.getMinutes() / 60) / interval) * interval;
            const timeRange = scheduler.getSlotTimeRange(slotHour - interval, interval);
            message.textContent = `How was ${timeRange.display}?`;
        }

        toast.classList.remove('hidden');

        // Auto-hide after 30 seconds if not interacted
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => this.hideToast(), 30000);
    }

    // Hide toast notification
    hideToast() {
        const toast = document.getElementById('notification-toast');
        toast.classList.add('hidden');
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
            this.toastTimeout = null;
        }
    }

    // Play notification sound
    playNotificationSound() {
        try {
            // Create a simple beep using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Could not play notification sound:', e);
        }
    }

    // Select productivity level
    selectProductivity(button) {
        const level = parseInt(button.dataset.level);

        // Update UI
        document.querySelectorAll('.prod-btn').forEach(b => b.classList.remove('selected'));
        button.classList.add('selected');

        this.currentLog.productivity = level;
    }

    // Select category
    selectCategory(pill, categoryId) {
        document.querySelectorAll('#category-pills .category-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        this.currentLog.category = categoryId;
    }

    // Render category pills
    renderCategoryPills() {
        const container = document.getElementById('category-pills');
        container.innerHTML = '';

        this.settings.categories.forEach(cat => {
            const pill = document.createElement('button');
            pill.className = 'category-pill';
            pill.innerHTML = `<span class="emoji">${cat.emoji}</span><span>${cat.name}</span>`;
            pill.addEventListener('click', () => this.selectCategory(pill, cat.id));
            container.appendChild(pill);
        });
    }

    // Render category list in settings
    renderCategoryList() {
        const container = document.getElementById('manage-categories');
        container.innerHTML = '';

        this.settings.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
        <span class="emoji">${cat.emoji}</span>
        <span class="name">${cat.name}</span>
        ${!cat.isDefault ? `
          <button class="delete-btn" data-id="${cat.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        ` : ''}
      `;

            // Add delete handler for custom categories
            const deleteBtn = item.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteCategory(cat.id));
            }

            container.appendChild(item);
        });
    }

    async deleteCategory(categoryId) {
        if (confirm('Delete this category?')) {
            this.settings.categories = this.settings.categories.filter(c => c.id !== categoryId);
            await storage.setSetting('categories', this.settings.categories);
            this.renderCategoryList();
        }
    }

    // Save log entry
    async saveLog() {
        if (this.currentLog.productivity === null) {
            alert('Please select a productivity level');
            return;
        }

        const slotStart = new Date(this.currentSlot.date || new Date());
        slotStart.setHours(this.currentSlot.hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setHours(slotStart.getHours() + this.currentSlot.interval);

        const entry = {
            slotStart: slotStart.toISOString(),
            slotEnd: slotEnd.toISOString(),
            slotHour: this.currentSlot.hour,
            productivity: this.currentLog.productivity,
            category: this.currentLog.category,
            note: document.getElementById('log-note').value || '',
            source: 'manual'
        };

        await storage.addLog(entry);
        scheduler.logComplete();

        console.log('Log saved:', entry);

        // Return to dashboard
        this.hideQuickLog();
    }

    // Refresh dashboard data
    async refreshDashboard() {
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        const logs = await storage.getLogsByDate(dateStr);
        const stats = analytics.calculateStats(logs, this.settings.reminderInterval);

        // Update date display
        document.getElementById('current-date').textContent = this.formatDateDisplay(this.selectedDate);
        document.getElementById('date-input').value = dateStr;

        // Update stats
        document.getElementById('productive-hours').textContent = analytics.formatHours(stats.productiveHours);
        document.getElementById('wasted-hours').textContent = analytics.formatHours(stats.wastedHours);

        // Update timeline
        this.renderTimeline(logs);

        // Update chart
        const canvas = document.getElementById('category-chart');
        const legendContainer = document.getElementById('chart-legend');
        const legendData = analytics.renderPieChart(canvas, stats.categoryBreakdown, this.settings.categories);
        analytics.updateLegend(legendContainer, legendData);
    }

    // Render timeline
    renderTimeline(logs) {
        const container = document.getElementById('timeline');
        container.innerHTML = '';

        const slots = scheduler.getTodaySlots(this.settings.reminderInterval);
        const isToday = this.selectedDate.toDateString() === new Date().toDateString();

        // Create a map of logs by hour
        const logsByHour = {};
        logs.forEach(log => {
            logsByHour[log.slotHour] = log;
        });

        slots.forEach(slot => {
            const log = logsByHour[slot.hour];
            const level = log ? log.productivity : 0;
            const category = log && log.category
                ? this.settings.categories.find(c => c.id === log.category)
                : null;

            // Adjust status for non-today dates
            let status = slot.status;
            if (!isToday) {
                status = 'past';
            }

            const slotEl = document.createElement('div');
            slotEl.className = `timeline-slot ${status}`;
            slotEl.innerHTML = `
        <span class="timeline-time">${slot.timeRange.start.replace(':00 ', '')}</span>
        <div class="timeline-bar">
          <div class="timeline-bar-fill level-${level}"></div>
        </div>
        <span class="timeline-category">${category?.emoji || (status === 'future' ? '⏳' : '❓')}</span>
      `;

            // Add click handler for editing
            slotEl.addEventListener('click', () => {
                this.showEditSlotModal(slot.hour, log || null);
            });

            container.appendChild(slotEl);
        });
    }

    // Update a setting
    async updateSetting(key, value) {
        await storage.setSetting(key, value);
        this.settings[key] = value;

        // Restart scheduler if interval changed
        if (key === 'reminderInterval' || key === 'quietHoursStart' || key === 'quietHoursEnd') {
            this.startTracking();
        }
    }

    // Update interval from settings
    async updateInterval(button) {
        const interval = parseFloat(button.dataset.interval);
        document.querySelectorAll('#settings .interval-btn').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        await this.updateSetting('reminderInterval', interval);
    }

    // Export data
    async exportData() {
        const data = await storage.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-pulse-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Clear all data
    async clearData() {
        if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
            await storage.clearAllLogs();
            this.refreshDashboard();
        }
    }

    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
