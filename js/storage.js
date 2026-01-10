/**
 * Storage Module - IndexedDB wrapper for productivity logs
 */

const DB_NAME = 'productivity-pulse';
const DB_VERSION = 1;
const STORE_LOGS = 'logs';
const STORE_SETTINGS = 'settings';

class Storage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create logs store
        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          const logsStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
          logsStore.createIndex('timestamp', 'timestamp', { unique: false });
          logsStore.createIndex('date', 'date', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  // Generate unique ID
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== LOGS =====

  async addLog(logEntry) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      ...logEntry
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.add(entry);

      request.onsuccess = () => resolve(entry);
      request.onerror = () => reject(request.error);
    });
  }

  async updateLog(id, updates) {
    return new Promise(async (resolve, reject) => {
      const existing = await this.getLog(id);
      if (!existing) {
        reject(new Error('Log not found'));
        return;
      }

      const updated = { ...existing, ...updates };
      const transaction = this.db.transaction([STORE_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async getLog(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readonly');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getLogsByDate(date) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readonly');
      const store = transaction.objectStore(STORE_LOGS);
      const index = store.index('date');
      const request = index.getAll(date);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTodayLogs() {
    const today = new Date().toISOString().split('T')[0];
    return this.getLogsByDate(today);
  }

  async getAllLogs() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readonly');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLog(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllLogs() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LOGS], 'readwrite');
      const store = transaction.objectStore(STORE_LOGS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== SETTINGS =====

  getDefaultSettings() {
    return {
      reminderInterval: 2,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      trackingEnabled: true,
      onboardingComplete: false,
      missedReminderMinutes: 15,
      categories: [
        { id: 'deep-work', name: 'Deep Work', emoji: '🧠', isDefault: true },
        { id: 'light-work', name: 'Light Work', emoji: '💼', isDefault: true },
        { id: 'eating', name: 'Eating/Breaks', emoji: '🍽️', isDefault: true },
        { id: 'rest', name: 'Rest/Sleep', emoji: '😴', isDefault: true },
        { id: 'leisure', name: 'Leisure', emoji: '🎮', isDefault: true },
        { id: 'other', name: 'Other', emoji: '🚶', isDefault: true }
      ]
    };
  }

  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SETTINGS], 'readonly');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          // Return default value
          const defaults = this.getDefaultSettings();
          resolve(defaults[key]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSettings() {
    const defaults = this.getDefaultSettings();
    const settings = { ...defaults };

    for (const key of Object.keys(defaults)) {
      const value = await this.getSetting(key);
      if (value !== undefined) {
        settings[key] = value;
      }
    }

    return settings;
  }

  async saveAllSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      await this.setSetting(key, value);
    }
  }

  // ===== EXPORT =====

  async exportData() {
    const logs = await this.getAllLogs();
    const settings = await this.getAllSettings();

    return {
      exportDate: new Date().toISOString(),
      logs,
      settings
    };
  }
}

// Global storage instance
const storage = new Storage();
