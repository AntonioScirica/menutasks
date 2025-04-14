const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { databaseService } = require('./DatabaseService');

class SessionManager {
    constructor() {
        // Usa Supabase dal DatabaseService centralizzato
        this.supabase = databaseService.supabase;

        this.sessionData = {
            sessions: [],
            lastSync: null,
            unsyncedChanges: false
        };

        this.syncIntervalMs = 5 * 60 * 1000;
        this.idleTimeoutMs = 60 * 1000;
        this.cachePath = path.join(app.getPath('userData'), 'session-cache.json');
        this.maxRetries = 3;
        this.retryDelayMs = 30000;

        this.syncInterval = null;
        this.syncRetryTimeout = null;
        this.syncAttempts = 0;
        this.lastActivityTime = Date.now();
        this.isIdle = false;
        this.currentSession = null;
        this.currentAppName = null;
        this.isOnline = true;

        this.init();
    }

    async init() {
        console.log('SessionManager: Inizializzazione...');
        this.setupConnectivityDetection();
        await this.loadCacheFromDisk();

        if (this.sessionData.unsyncedChanges) {
            await this.syncWithSupabase();
            if (!this.sessionData.unsyncedChanges) {
                this.clearCacheFile();
            }
        }

        this.startSyncInterval();
        this.setupSystemEventHandlers();
        this.setupIdleDetection();
        console.log('SessionManager: Inizializzazione completata');
    }

    setupSystemEventHandlers() {
        process.on('exit', () => this.flushToDisk());
        process.on('SIGINT', () => {
            this.flushToDisk();
            process.exit(0);
        });

        if (app) {
            app.on('before-quit', () => this.flushToDisk());
            app.on('render-process-gone', (event, webContents, details) => {
                console.error('Processo di rendering terminato:', details.reason);
                this.flushToDisk();
            });
        }
    }

    setupIdleDetection() {
        if (typeof window !== 'undefined') {
            const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
            const updateActivity = () => {
                const wasIdle = this.isIdle;
                this.lastActivityTime = Date.now();
                this.isIdle = false;
                if (wasIdle) {
                    console.log('Attività utente rilevata, ripresa tracciamento');
                    this.resumeTracking();
                }
            };

            activityEvents.forEach(eventType => {
                window.addEventListener(eventType, updateActivity, { passive: true });
            });

            setInterval(() => {
                if (!this.isIdle && (Date.now() - this.lastActivityTime) > this.idleTimeoutMs) {
                    this.isIdle = true;
                    console.log('Utente inattivo, pausa tracciamento');
                    this.pauseTracking();
                }
            }, 10000);

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.isIdle = true;
                    console.log('Documento nascosto, pausa tracciamento');
                    this.pauseTracking();
                } else {
                    updateActivity();
                }
            });
        }
    }

    setupConnectivityDetection() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('SessionManager: Connessione di rete ripristinata');
                this.isOnline = true;
                if (this.sessionData.unsyncedChanges) {
                    console.log('Tentativo di sincronizzazione dopo connessione');
                    this.syncWithSupabase();
                }
            });

            window.addEventListener('offline', () => {
                console.log('SessionManager: Connessione di rete persa');
                this.isOnline = false;
            });

            this.isOnline = navigator.onLine;
        }
    }

    pauseTracking() {
        if (this.currentSession) {
            this.currentSession.isActive = false;
            this.currentSession.pausedAt = Date.now();
            this.sessionData.unsyncedChanges = true;
        }
        this.emit('tracking-paused');
    }

    resumeTracking() {
        if (this.currentSession) {
            if (this.currentSession.pausedAt) {
                const pauseDuration = Date.now() - this.currentSession.pausedAt;
                this.currentSession.totalPausedTime += pauseDuration;
                this.currentSession.pausedAt = null;
            }
            this.currentSession.isActive = true;
            this.sessionData.unsyncedChanges = true;
        }
        this.emit('tracking-resumed');
    }

    startSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            this.saveToDisk()
                .then(() => this.syncWithSupabase())
                .catch(err => console.error('Errore nella sincronizzazione periodica:', err));
        }, this.syncIntervalMs);

        console.log(`Intervallo di sincronizzazione avviato (${this.syncIntervalMs / 60000} minuti)`);
    }

    startSession(appName, taskId) {
        if (!appName) {
            console.error('Impossibile avviare sessione senza nome app');
            return null;
        }

        if (this.currentSession && this.currentAppName === appName) {
            this.currentSession.isActive = true;
            return this.currentSession;
        }

        if (this.currentSession) {
            this.endSession();
        }

        this.currentAppName = appName;
        this.currentSession = {
            id: this.generateSessionId(),
            appName,
            taskId,
            startTime: Date.now(),
            endTime: null,
            isActive: true,
            totalPausedTime: 0,
            pausedAt: null,
            durationMs: 0
        };

        this.sessionData.sessions.push(this.currentSession);
        this.sessionData.unsyncedChanges = true;

        console.log(`Avviata nuova sessione per ${appName} (ID: ${this.currentSession.id})`);
        return this.currentSession;
    }

    endSession() {
        if (!this.currentSession) return null;

        const now = Date.now();
        let totalDuration = now - this.currentSession.startTime;

        if (this.currentSession.pausedAt) {
            const pauseDuration = now - this.currentSession.pausedAt;
            this.currentSession.totalPausedTime += pauseDuration;
            this.currentSession.pausedAt = null;
        }

        totalDuration -= this.currentSession.totalPausedTime;
        this.currentSession.endTime = now;
        this.currentSession.isActive = false;
        this.currentSession.durationMs = totalDuration;
        this.sessionData.unsyncedChanges = true;

        console.log(`Terminata sessione per ${this.currentAppName} (${totalDuration}ms)`);

        const session = { ...this.currentSession };
        this.currentSession = null;
        this.currentAppName = null;
        return session;
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    }

    getAllSessions() {
        return [...this.sessionData.sessions];
    }

    getCurrentSession() {
        return this.currentSession;
    }

    hasActiveSession(appName) {
        return this.currentSession !== null &&
            this.currentAppName === appName &&
            this.currentSession.isActive;
    }

    getUnsyncedSessions() {
        return this.sessionData.sessions.filter(s => s.endTime !== null && !s.synced);
    }

    async loadCacheFromDisk() {
        return new Promise((resolve) => {
            try {
                if (fs.existsSync(this.cachePath)) {
                    const data = fs.readFileSync(this.cachePath, 'utf8');
                    const parsedData = JSON.parse(data);

                    console.log('Dati di cache caricati dal disco');

                    this.sessionData = {
                        ...parsedData,
                        sessions: parsedData.sessions || [],
                        lastSync: parsedData.lastSync || null,
                        unsyncedChanges: parsedData.unsyncedChanges || false
                    };
                } else {
                    console.log('Nessun file di cache trovato');
                }
                resolve();
            } catch (error) {
                console.error('Errore caricamento cache:', error);
                this.sessionData = {
                    sessions: [],
                    lastSync: null,
                    unsyncedChanges: false
                };
                resolve();
            }
        });
    }

    async saveToDisk() {
        return new Promise((resolve, reject) => {
            try {
                if (!this.sessionData.unsyncedChanges) {
                    console.log('SessionManager: Nessuna modifica da salvare');
                    return resolve();
                }

                // ✅ ASSICURA CHE LA CARTELLA ESISTA
                const dir = path.dirname(this.cachePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const dataToSave = JSON.stringify(this.sessionData, null, 2);
                const tempPath = `${this.cachePath}.tmp`;

                fs.writeFileSync(tempPath, dataToSave, 'utf8');
                fs.renameSync(tempPath, this.cachePath);

                console.log('SessionManager: Dati salvati su disco');
                resolve();
            } catch (error) {
                console.error('Errore durante il salvataggio su disco:', error);
                reject(error);
            }
        });
    }


    clearCacheFile() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const activeSession = this.currentSession ? [this.currentSession] : [];
                const newData = {
                    sessions: activeSession,
                    lastSync: Date.now(),
                    unsyncedChanges: !!this.currentSession
                };
                fs.writeFileSync(this.cachePath, JSON.stringify(newData, null, 2), 'utf8');
                console.log('Cache pulita dopo sincronizzazione');
            }
        } catch (error) {
            console.error('Errore durante la pulizia cache:', error);
        }
    }

    async syncWithSupabase(isRetry = false) {
        if (!this.sessionData.unsyncedChanges || !this.isOnline) return;

        if (!isRetry) {
            this.syncAttempts = 0;
            if (this.syncRetryTimeout) {
                clearTimeout(this.syncRetryTimeout);
                this.syncRetryTimeout = null;
            }
        }

        console.log(`Tentativo di sincronizzazione #${this.syncAttempts + 1}`);

        try {
            const completed = this.getUnsyncedSessions();
            if (completed.length === 0) {
                console.log('Nessuna sessione da sincronizzare');
                return;
            }

            const sessionsToSync = completed.map(session => ({
                session_id: session.id,
                app_name: session.appName,
                task_id: session.taskId ? Number(session.taskId) : null,
                start_time: new Date(session.startTime).toISOString(),
                end_time: new Date(session.endTime).toISOString(),
                duration_ms: session.durationMs,
                total_paused_time_ms: session.totalPausedTime,
                created_at: new Date().toISOString()
            }));

            const { data, error } = await this.supabase
                .from('app_sessions')
                .insert(sessionsToSync);

            if (error) throw error;

            console.log(`Sincronizzate ${sessionsToSync.length} sessioni`);

            completed.forEach(s => { s.synced = true; });
            this.sessionData.lastSync = Date.now();
            this.sessionData.unsyncedChanges = this.getUnsyncedSessions().length > 0;
            await this.saveToDisk();
            this.syncAttempts = 0;
        } catch (error) {
            console.error('Errore sincronizzazione:', error);
            this.syncAttempts++;
            if (this.syncAttempts < this.maxRetries) {
                const retryDelay = this.retryDelayMs * Math.pow(2, this.syncAttempts - 1);
                console.log(`Nuovo tentativo tra ${retryDelay / 1000} secondi`);
                this.syncRetryTimeout = setTimeout(() => {
                    this.syncWithSupabase(true);
                }, retryDelay);
            } else {
                console.error('Sincronizzazione fallita dopo tentativi multipli');
                this.syncAttempts = 0;
            }
        }
    }

    async flushToDisk() {
        console.log('Flush dei dati su disco...');
        if (this.currentSession) this.endSession();
        try {
            await this.saveToDisk();
            console.log('Flush completato con successo');
        } catch (error) {
            console.error('Errore nel flush:', error);
        }
    }

    emit(eventName, data = {}) {
        console.log(`Evento "${eventName}" emesso`, data);
    }

    destroy() {
        console.log('Pulizia risorse...');
        if (this.currentSession) this.endSession();
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.flushToDisk();
    }
}

module.exports = SessionManager;
