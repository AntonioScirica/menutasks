/**
 * AppTimerTracker - Servizio per tracciare il tempo delle app associate alle task
 * Questo servizio permette di:
 * - Associare un'app a una task
 * - Avviare un timer da zero quando l'app viene associata
 * - Aggiornare il tempo nella UI
 * - Fermare il timer quando la task viene completata
 */

class AppTimerTracker {
    constructor() {
        // Mappa delle app tracciate: { taskId: { nome, startTime, elapsedTime, running } }
        this.trackedApps = {};

        // Interval ID per l'aggiornamento dei timer
        this.updateInterval = null;

        // Inizializza
        this.init();
    }

    /**
     * Inizializza il servizio
     */
    init() {
        console.log('AppTimerTracker: Inizializzazione');

        // Carica i dati salvati
        this.loadFromStorage();

        // Avvia l'intervallo di aggiornamento
        this.startUpdateInterval();

        // Aggiungi listener per salvare i dati prima di chiudere la pagina
        window.addEventListener('beforeunload', () => {
            this.saveToStorage();
        });
    }

    /**
     * Avvia l'intervallo di aggiornamento dei timer
     */
    startUpdateInterval() {
        // Aggiorna i timer ogni 2 secondi
        this.updateInterval = setInterval(() => {
            this.updateTimers();
        }, 2000);
    }

    /**
     * Ferma l'intervallo di aggiornamento
     */
    stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Aggiorna tutti i timer attivi
     */
    async updateTimers() {
        const now = Date.now();
        let updated = false;

        // Verifica se electronAPI è disponibile
        if (!window.electronAPI || typeof window.electronAPI.getForegroundApp !== 'function') {
            console.warn('API getForegroundApp non disponibile, il timer potrebbe non funzionare correttamente');
            return;
        }

        // Ottieni l'app in primo piano
        const foregroundApp = await window.electronAPI.getForegroundApp();

        // Log meno frequente dell'app in primo piano
        const shouldLog = !this.lastLogTime || (now - this.lastLogTime) > 60000; // Log max ogni minuto
        if (shouldLog && this.lastLoggedApp !== foregroundApp) {
            console.log(`App in primo piano cambiata: "${foregroundApp}"`);
            this.lastLoggedApp = foregroundApp;
            this.lastLogTime = now;
        }

        // Verifica se il sistema è in standby
        let isSystemActive = true;
        if (typeof window.electronAPI.isSystemActive === 'function') {
            isSystemActive = await window.electronAPI.isSystemActive();
        }

        // Ottieni l'elenco delle app in esecuzione
        let runningApps = [];
        if (typeof window.electronAPI.getActiveApps === 'function') {
            runningApps = await window.electronAPI.getActiveApps();

            // Riduzione log - solo in caso di debug o all'avvio
            if (!this.runningAppsLogged) {
                console.log(`App in esecuzione rilevate: ${runningApps.length}`);
                this.runningAppsLogged = true;
            }
        }

        // Aggiorna ogni app tracciata
        Object.keys(this.trackedApps).forEach(taskId => {
            const appData = this.trackedApps[taskId];
            const appName = appData.name;

            // Verifica se l'app è in esecuzione e attiva
            // Confronto case-insensitive per maggiore affidabilità
            const isRunning = runningApps.some(app => this.normalizeAppName(app) === this.normalizeAppName(appName));
            const isActive = isSystemActive && isRunning &&
                (foregroundApp && appName &&
                    this.normalizeAppName(foregroundApp) === this.normalizeAppName(appName));

            // Salva lo stato precedente
            const wasActive = appData.running;

            if (isActive) {
                // Se l'app è attiva e il timer è fermo, avvialo
                if (!appData.running) {
                    console.log(`Timer di ${appName} avviato: app attiva`);
                    appData.running = true;
                    appData.startTime = now;
                }
            } else {
                // Se l'app non è attiva ma il timer è in esecuzione, fermalo
                if (appData.running) {
                    console.log(`Timer di ${appName} fermato: app non attiva`);
                    appData.elapsedTime += (now - appData.startTime);
                    appData.running = false;
                }
            }

            if (appData.running) {
                // Calcola il tempo trascorso dall'inizio del tracciamento
                const elapsed = now - appData.startTime + appData.elapsedTime;

                // Aggiorna l'UI
                this.updateUI(taskId, this.formatTime(elapsed));
                updated = true;
            }
        });

        // Salva i dati in storage se ci sono aggiornamenti
        if (updated) {
            this.saveToStorage();
        }
    }

    /**
     * Imposta un'app per essere tracciata per una task
     * @param {string|number} taskId - ID della task
     * @param {string} appName - Nome dell'applicazione da tracciare
     */
    async setAppForTask(taskId, appName) {
        console.log(`AppTimerTracker: Associazione app "${appName}" alla task ${taskId}`);

        // Verifica se l'app è in primo piano prima di iniziare il timer
        let isActive = false;

        if (window.electronAPI && typeof window.electronAPI.getForegroundApp === 'function') {
            const foregroundApp = await window.electronAPI.getForegroundApp();
            isActive = this.normalizeAppName(foregroundApp) === this.normalizeAppName(appName);
            console.log(`Controllo iniziale: app "${appName}" ${isActive ? 'è' : 'non è'} in primo piano (foreground: "${foregroundApp}")`);
        }

        // Inizializza i dati del timer a 0
        this.trackedApps[taskId] = {
            name: appName,
            startTime: Date.now(),
            elapsedTime: 0,
            running: isActive, // Avvia il timer solo se l'app è già in primo piano
            pausedByForeground: !isActive,
            pausedBySystem: false,
            formattedTime: "0h 0m 0s"
        };

        // Aggiorna l'UI immediatamente
        this.updateUI(taskId, "0h 0m 0s");

        // Salva i dati
        this.saveToStorage();

        return this.trackedApps[taskId];
    }

    /**
     * Aggiorna l'UI con il tempo tracciato
     * @param {string|number} taskId - ID della task
     * @param {string} formattedTime - Tempo formattato da visualizzare
     */
    updateUI(taskId, formattedTime) {
        // Aggiorna il tempo formattato nei dati
        if (this.trackedApps[taskId]) {
            this.trackedApps[taskId].formattedTime = formattedTime;
        }

        // Aggiorna l'elemento nella barra laterale
        const trackedAppItem = document.getElementById('trackedAppItem');
        if (trackedAppItem) {
            const infoValue = trackedAppItem.querySelector('.info-value');
            if (infoValue) {
                infoValue.textContent = formattedTime;
            }
        }
    }

    /**
     * Ferma il timer per una task
     * @param {string|number} taskId - ID della task
     */
    stopTimer(taskId) {
        if (!this.trackedApps[taskId]) {
            console.log(`AppTimerTracker: Nessuna app tracciata per la task ${taskId}`);
            return;
        }

        console.log(`AppTimerTracker: Arresto timer per la task ${taskId}`);

        const now = Date.now();
        const appData = this.trackedApps[taskId];

        // Calcola il tempo finale
        if (appData.running) {
            appData.elapsedTime += (now - appData.startTime);
            appData.running = false;

            // Aggiorna l'UI con il tempo finale
            this.updateUI(taskId, this.formatTime(appData.elapsedTime));

            // Salva i dati
            this.saveToStorage();
        }
    }

    /**
     * Mette in pausa il timer per una task
     * @param {string|number} taskId - ID della task
     */
    pauseTimer(taskId) {
        if (!this.trackedApps[taskId]) {
            console.log(`AppTimerTracker: Nessuna app tracciata per la task ${taskId}`);
            return;
        }

        console.log(`AppTimerTracker: Pausa timer per la task ${taskId}`);

        const appData = this.trackedApps[taskId];

        if (appData.running) {
            const now = Date.now();
            appData.elapsedTime += (now - appData.startTime);
            appData.running = false;

            // Aggiorna l'UI con il tempo corrente
            this.updateUI(taskId, this.formatTime(appData.elapsedTime));

            // Salva i dati
            this.saveToStorage();
        }
    }

    /**
     * Riprende il timer per una task
     * @param {string|number} taskId - ID della task
     */
    resumeTimer(taskId) {
        if (!this.trackedApps[taskId]) {
            console.log(`AppTimerTracker: Nessuna app tracciata per la task ${taskId}`);
            return;
        }

        console.log(`AppTimerTracker: Ripresa timer per la task ${taskId}`);

        const appData = this.trackedApps[taskId];

        if (!appData.running) {
            appData.startTime = Date.now();
            appData.running = true;

            // Salva i dati
            this.saveToStorage();
        }
    }

    /**
     * Rimuove il tracciamento di un'app per una task
     * @param {string|number} taskId - ID della task
     */
    removeAppTracking(taskId) {
        if (this.trackedApps[taskId]) {
            console.log(`AppTimerTracker: Rimozione tracciamento per la task ${taskId}`);
            delete this.trackedApps[taskId];
            this.saveToStorage();
        }
    }

    /**
     * Ottiene i dati di tracciamento per una task
     * @param {string|number} taskId - ID della task
     * @returns {Object|null} Dati di tracciamento o null se non presente
     */
    getAppTrackingData(taskId) {
        return this.trackedApps[taskId] || null;
    }

    /**
     * Formatta il tempo in millisecondi in una stringa leggibile
     * @param {number} milliseconds - Tempo in millisecondi
     * @returns {string} Tempo formattato (es. "2h 30m 15s")
     */
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }

    /**
     * Salva i dati in localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('appTrackerData', JSON.stringify(this.trackedApps));
        } catch (error) {
            console.error('AppTimerTracker: Errore durante il salvataggio dei dati', error);
        }
    }

    /**
     * Carica i dati da localStorage
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem('appTrackerData');
            if (data) {
                this.trackedApps = JSON.parse(data);
                console.log('AppTimerTracker: Dati caricati dal localStorage');
            }
        } catch (error) {
            console.error('AppTimerTracker: Errore durante il caricamento dei dati', error);
        }
    }

    /**
     * Normalizza il nome di un'app per confronti più affidabili
     * @param {string} appName - Nome dell'app da normalizzare
     * @returns {string} Nome dell'app normalizzato
     */
    normalizeAppName(appName) {
        if (!appName) return '';

        // Converti a lowercase
        let normalized = appName.toLowerCase();

        // Rimuovi eventuali suffissi comuni
        normalized = normalized.replace(/\.app$/, '');

        // Rimuovi caratteri speciali e spazi extra
        normalized = normalized.replace(/[^\w\s]/g, ' ').trim();
        normalized = normalized.replace(/\s+/g, ' ');

        console.log(`Normalizzazione: "${appName}" -> "${normalized}"`);
        return normalized;
    }
}

// Crea un'istanza globale
window.appTimerTracker = new AppTimerTracker(); 