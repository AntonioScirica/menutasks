/**
 * SessionManager.js
 * Gestisce il caching delle sessioni, la persistenza locale e la sincronizzazione con Supabase
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionManager {
    constructor(supabaseClient) {
        // Riferimento al client Supabase
        this.supabase = supabaseClient;

        // Cache in memoria
        this.sessionData = {
            sessions: [],           // Array di sessioni (una sessione per app)
            lastSync: null,         // Timestamp dell'ultima sincronizzazione
            unsyncedChanges: false  // Indica se ci sono modifiche non sincronizzate
        };

        // Configurazione
        this.syncIntervalMs = 5 * 60 * 1000;  // 5 minuti
        this.idleTimeoutMs = 60 * 1000;       // 60 secondi
        this.cachePath = path.join(app.getPath('userData'), 'session-cache.json');
        this.maxRetries = 3;                  // Numero massimo di tentativi di sincronizzazione
        this.retryDelayMs = 30000;            // 30 secondi tra i tentativi

        // Stato interno
        this.syncInterval = null;
        this.syncRetryTimeout = null;
        this.syncAttempts = 0;
        this.lastActivityTime = Date.now();
        this.isIdle = false;
        this.currentSession = null;   // Sessione attuale
        this.currentAppName = null;   // Nome dell'app attualmente tracciata
        this.isOnline = true;         // Stato di connessione

        // Inizializzazione
        this.init();
    }

    /**
     * Inizializza il gestore delle sessioni
     */
    async init() {
        console.log('SessionManager: Inizializzazione...');

        // Configura il rilevamento dello stato di connessione
        this.setupConnectivityDetection();

        // Carica dati da file locale se esistono
        await this.loadCacheFromDisk();

        // Sincronizza dati non sincronizzati
        if (this.sessionData.unsyncedChanges) {
            await this.syncWithSupabase();
            // Pulisci il file solo se la sincronizzazione è avvenuta con successo
            if (!this.sessionData.unsyncedChanges) {
                this.clearCacheFile();
            }
        }

        // Avvia intervalli di sincronizzazione
        this.startSyncInterval();

        // Aggiungi handler per eventi di sistema
        this.setupSystemEventHandlers();

        // Configura rilevamento inattività
        this.setupIdleDetection();

        console.log('SessionManager: Inizializzazione completata');
    }

    /**
     * Configura gli handler per gli eventi di sistema
     */
    setupSystemEventHandlers() {
        // Gestisci chiusura dell'app
        process.on('exit', () => this.flushToDisk());
        process.on('SIGINT', () => {
            this.flushToDisk();
            process.exit(0);
        });

        // In Electron, gestisci evento before-quit
        if (app) {
            app.on('before-quit', () => this.flushToDisk());

            // Gestisci evento crash
            app.on('render-process-gone', (event, webContents, details) => {
                console.error('Processo di rendering terminato:', details.reason);
                this.flushToDisk();
            });
        }
    }

    /**
     * Configura il rilevamento dell'inattività dell'utente
     */
    setupIdleDetection() {
        // In un contesto browser/renderer
        if (typeof window !== 'undefined') {
            const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

            // Aggiorna il timestamp dell'ultima attività
            const updateActivity = () => {
                const wasIdle = this.isIdle;
                this.lastActivityTime = Date.now();
                this.isIdle = false;

                // Se era inattivo, riattiva il tracciamento
                if (wasIdle) {
                    console.log('Attività utente rilevata, ripresa tracciamento');
                    this.resumeTracking();
                }
            };

            // Aggiungi listener per gli eventi di attività
            activityEvents.forEach(eventType => {
                window.addEventListener(eventType, updateActivity, { passive: true });
            });

            // Controllo periodico dello stato di inattività
            setInterval(() => {
                if (!this.isIdle && (Date.now() - this.lastActivityTime) > this.idleTimeoutMs) {
                    this.isIdle = true;
                    console.log('Utente inattivo, pausa tracciamento');
                    this.pauseTracking();
                }
            }, 10000); // Controlla ogni 10 secondi

            // Rileva anche quando l'app/scheda non è visibile
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

    /**
     * Configura il rilevamento dello stato di connessione
     */
    setupConnectivityDetection() {
        if (typeof window !== 'undefined') {
            // Monitora lo stato online/offline
            window.addEventListener('online', () => {
                console.log('SessionManager: Connessione di rete ripristinata');
                this.isOnline = true;

                // Prova a sincronizzare quando torna online
                if (this.sessionData.unsyncedChanges) {
                    console.log('SessionManager: Tentativo di sincronizzazione dopo ripristino della connessione');
                    this.syncWithSupabase();
                }
            });

            window.addEventListener('offline', () => {
                console.log('SessionManager: Connessione di rete persa');
                this.isOnline = false;
            });

            // Imposta lo stato iniziale
            this.isOnline = navigator.onLine;
        }
    }

    /**
     * Mette in pausa il tracciamento
     */
    pauseTracking() {
        if (this.currentSession) {
            this.currentSession.isActive = false;
            this.currentSession.pausedAt = Date.now();
            this.sessionData.unsyncedChanges = true;
        }

        // Notifica evento
        this.emit('tracking-paused');
    }

    /**
     * Riprende il tracciamento
     */
    resumeTracking() {
        if (this.currentSession) {
            // Se la sessione era in pausa, calcola il tempo di pausa
            if (this.currentSession.pausedAt) {
                const pauseDuration = Date.now() - this.currentSession.pausedAt;
                this.currentSession.totalPausedTime += pauseDuration;
                this.currentSession.pausedAt = null;
            }

            this.currentSession.isActive = true;
            this.sessionData.unsyncedChanges = true;
        }

        // Notifica evento
        this.emit('tracking-resumed');
    }

    /**
     * Avvia l'intervallo di sincronizzazione
     */
    startSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            this.saveToDisk()
                .then(() => this.syncWithSupabase())
                .catch(err => console.error('Errore nella sincronizzazione periodica:', err));
        }, this.syncIntervalMs);

        console.log(`SessionManager: Intervallo di sincronizzazione avviato (${this.syncIntervalMs / 60000} minuti)`);
    }

    /**
     * Avvia o continua una sessione per un'applicazione
     * @param {string} appName - Nome dell'applicazione
     * @param {string} taskId - ID della task associata
     * @returns {Object} La sessione attiva
     */
    startSession(appName, taskId) {
        if (!appName) {
            console.error('SessionManager: Impossibile avviare sessione senza nome app');
            return null;
        }

        // Se stiamo già tracciando questa app, continua la sessione corrente
        if (this.currentSession && this.currentAppName === appName) {
            this.currentSession.isActive = true;
            return this.currentSession;
        }

        // Se stava tracciando un'app diversa, chiudi la sessione precedente
        if (this.currentSession) {
            this.endSession();
        }

        // Crea una nuova sessione
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

        // Aggiungi alla lista di sessioni
        this.sessionData.sessions.push(this.currentSession);
        this.sessionData.unsyncedChanges = true;

        console.log(`SessionManager: Avviata nuova sessione per ${appName} (ID: ${this.currentSession.id})`);

        return this.currentSession;
    }

    /**
     * Termina la sessione corrente
     * @returns {Object|null} La sessione terminata o null
     */
    endSession() {
        if (!this.currentSession) {
            return null;
        }

        // Calcola la durata effettiva (senza il tempo in pausa)
        const now = Date.now();
        let totalDuration = now - this.currentSession.startTime;

        // Se era in pausa, aggiungi il tempo di pausa
        if (this.currentSession.pausedAt) {
            const pauseDuration = now - this.currentSession.pausedAt;
            this.currentSession.totalPausedTime += pauseDuration;
            this.currentSession.pausedAt = null;
        }

        // Sottrai il tempo in pausa
        totalDuration -= this.currentSession.totalPausedTime;

        // Aggiorna la sessione
        this.currentSession.endTime = now;
        this.currentSession.isActive = false;
        this.currentSession.durationMs = totalDuration;

        // Marca come non sincronizzata
        this.sessionData.unsyncedChanges = true;

        console.log(`SessionManager: Terminata sessione per ${this.currentAppName} (durata: ${totalDuration}ms)`);

        const session = { ...this.currentSession };
        this.currentSession = null;
        this.currentAppName = null;

        return session;
    }

    /**
     * Genera un ID univoco per la sessione
     * @returns {string} ID univoco
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    }

    /**
     * Ottiene tutte le sessioni dalla cache
     * @returns {Array} Array di tutte le sessioni
     */
    getAllSessions() {
        return [...this.sessionData.sessions];
    }

    /**
     * Ottiene le sessioni non sincronizzate
     * @returns {Array} Array di sessioni non sincronizzate
     */
    getUnsyncedSessions() {
        return this.sessionData.sessions.filter(session =>
            session.endTime !== null && !session.synced);
    }

    /**
     * Carica i dati della cache dal disco
     * @returns {Promise<void>}
     */
    async loadCacheFromDisk() {
        return new Promise((resolve) => {
            try {
                if (fs.existsSync(this.cachePath)) {
                    const data = fs.readFileSync(this.cachePath, 'utf8');
                    const parsedData = JSON.parse(data);

                    console.log('SessionManager: Dati di cache caricati dal disco');

                    // Aggiorna i dati in memoria
                    this.sessionData = {
                        ...parsedData,
                        // Assicurati che questi campi esistano
                        sessions: parsedData.sessions || [],
                        lastSync: parsedData.lastSync || null,
                        unsyncedChanges: parsedData.unsyncedChanges || false
                    };
                } else {
                    console.log('SessionManager: Nessun file di cache trovato');
                }

                resolve();
            } catch (error) {
                console.error('Errore durante il caricamento della cache:', error);
                // In caso di errore, inizializza con valori predefiniti
                this.sessionData = {
                    sessions: [],
                    lastSync: null,
                    unsyncedChanges: false
                };
                resolve();
            }
        });
    }

    /**
     * Salva i dati della cache su disco
     * @returns {Promise<void>}
     */
    async saveToDisk() {
        return new Promise((resolve, reject) => {
            try {
                // Non salvare se non ci sono modifiche
                if (!this.sessionData.unsyncedChanges) {
                    console.log('SessionManager: Nessuna modifica da salvare');
                    return resolve();
                }

                // Crea una copia dei dati da salvare
                const dataToSave = JSON.stringify(this.sessionData, null, 2);

                // Salva prima in un file temporaneo
                const tempPath = `${this.cachePath}.tmp`;
                fs.writeFileSync(tempPath, dataToSave, 'utf8');

                // Rinomina atomicamente per evitare corruzione
                fs.renameSync(tempPath, this.cachePath);

                console.log('SessionManager: Dati salvati su disco');
                resolve();
            } catch (error) {
                console.error('Errore durante il salvataggio su disco:', error);
                reject(error);
            }
        });
    }

    /**
     * Pulisce il file di cache locale dopo una sincronizzazione di successo
     */
    clearCacheFile() {
        try {
            if (fs.existsSync(this.cachePath)) {
                // Crea un nuovo file vuoto ma mantieni le sessioni attive
                const activeSession = this.currentSession ? [this.currentSession] : [];
                const newData = {
                    sessions: activeSession,
                    lastSync: Date.now(),
                    unsyncedChanges: !!this.currentSession
                };

                fs.writeFileSync(this.cachePath, JSON.stringify(newData, null, 2), 'utf8');
                console.log('SessionManager: File di cache pulito dopo sincronizzazione');
            }
        } catch (error) {
            console.error('Errore durante la pulizia del file di cache:', error);
        }
    }

    /**
     * Sincronizza i dati con Supabase
     * @param {boolean} isRetry - Indica se è un tentativo di retry
     * @returns {Promise<void>}
     */
    async syncWithSupabase(isRetry = false) {
        // Non sincronizzare se non ci sono modifiche o se offline
        if (!this.sessionData.unsyncedChanges) {
            console.log('SessionManager: Nessuna modifica da sincronizzare');
            return;
        }

        if (!this.isOnline) {
            console.log('SessionManager: Sincronizzazione impossibile - offline');
            return;
        }

        // Resetta il contatore di tentativi se non è un retry
        if (!isRetry) {
            this.syncAttempts = 0;

            // Annulla eventuali tentativi programmati
            if (this.syncRetryTimeout) {
                clearTimeout(this.syncRetryTimeout);
                this.syncRetryTimeout = null;
            }
        }

        console.log(`SessionManager: Tentativo di sincronizzazione #${this.syncAttempts + 1}`);

        try {
            // Ottieni tutte le sessioni completate e non sincronizzate
            const completedSessions = this.sessionData.sessions.filter(session =>
                session.endTime !== null && !session.synced);

            if (completedSessions.length === 0) {
                console.log('SessionManager: Nessuna sessione completata da sincronizzare');
                return;
            }

            // Prepara i dati per Supabase
            const sessionsToSync = completedSessions.map(session => ({
                session_id: session.id,
                app_name: session.appName,
                task_id: session.taskId ? Number(session.taskId) : null, // Converti in numero per compatibilità
                start_time: new Date(session.startTime).toISOString(),
                end_time: new Date(session.endTime).toISOString(),
                duration_ms: session.durationMs,
                total_paused_time_ms: session.totalPausedTime,
                created_at: new Date().toISOString()
            }));

            console.log(`SessionManager: Sincronizzazione di ${sessionsToSync.length} sessioni...`);

            // Batch insert delle sessioni
            const { data, error } = await this.supabase
                .from('app_sessions')  // Assume che esista una tabella 'app_sessions'
                .insert(sessionsToSync);

            if (error) {
                throw error;
            }

            console.log(`SessionManager: ${sessionsToSync.length} sessioni sincronizzate con successo`);

            // Marca le sessioni come sincronizzate
            completedSessions.forEach(session => {
                session.synced = true;
            });

            // Aggiorna lo stato di sincronizzazione
            this.sessionData.lastSync = Date.now();

            // Verifica se tutte le sessioni sono sincronizzate
            const hasUnsyncedSessions = this.sessionData.sessions.some(session =>
                !session.synced && session.endTime !== null);

            this.sessionData.unsyncedChanges = hasUnsyncedSessions || !!this.currentSession;

            // Salva lo stato aggiornato su disco
            await this.saveToDisk();

            // Resetta i tentativi dopo un successo
            this.syncAttempts = 0;

        } catch (error) {
            console.error('Errore durante la sincronizzazione con Supabase:', error);

            // Incrementa il contatore di tentativi
            this.syncAttempts++;

            // Se non abbiamo superato il numero massimo di tentativi, ritenta
            if (this.syncAttempts < this.maxRetries) {
                const retryDelay = this.retryDelayMs * Math.pow(2, this.syncAttempts - 1); // Backoff esponenziale
                console.log(`SessionManager: Nuovo tentativo tra ${retryDelay / 1000} secondi...`);

                // Programma un nuovo tentativo
                this.syncRetryTimeout = setTimeout(() => {
                    this.syncWithSupabase(true);
                }, retryDelay);
            } else {
                console.error(`SessionManager: Sincronizzazione fallita dopo ${this.maxRetries} tentativi`);
                // Resetta il contatore di tentativi
                this.syncAttempts = 0;
            }
        }
    }

    /**
     * Forza il salvataggio immediato su disco
     * @returns {Promise<void>}
     */
    async flushToDisk() {
        console.log('SessionManager: Flushing dei dati su disco...');

        // Se c'è una sessione attiva, chiudila prima di salvare
        if (this.currentSession) {
            this.endSession();
        }

        try {
            await this.saveToDisk();
            console.log('SessionManager: Flush completato con successo');
        } catch (error) {
            console.error('Errore durante il flush dei dati:', error);
        }
    }

    /**
     * Ottiene la sessione attiva corrente
     * @returns {Object|null} Sessione attiva o null
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Verifica se c'è una sessione attiva per un'app
     * @param {string} appName - Nome dell'applicazione
     * @returns {boolean} True se c'è una sessione attiva
     */
    hasActiveSession(appName) {
        return this.currentSession !== null &&
            this.currentAppName === appName &&
            this.currentSession.isActive;
    }

    /**
     * Emette un evento (implementazione base)
     * @param {string} eventName - Nome dell'evento
     * @param {Object} data - Dati dell'evento
     */
    emit(eventName, data = {}) {
        console.log(`SessionManager: Evento "${eventName}" emesso`, data);
        // Implementazione base, potrebbe essere estesa con EventEmitter
    }

    /**
     * Pulisce e libera risorse
     */
    destroy() {
        console.log('SessionManager: Pulizia risorse...');

        // Chiudi la sessione attiva
        if (this.currentSession) {
            this.endSession();
        }

        // Ferma intervallo di sincronizzazione
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Salva i dati prima di terminare
        this.flushToDisk();
    }
}

module.exports = SessionManager; 