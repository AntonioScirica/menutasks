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
        // Aggiorna i timer ogni secondo
        this.updateInterval = setInterval(() => {
            this.updateTimers();
        }, 1000);
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
    updateTimers() {
        const now = Date.now();
        let updated = false;

        // Aggiorna ogni app tracciata
        Object.keys(this.trackedApps).forEach(taskId => {
            const appData = this.trackedApps[taskId];

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
    setAppForTask(taskId, appName) {
        console.log(`AppTimerTracker: Associazione app "${appName}" alla task ${taskId}`);

        // Inizializza i dati del timer a 0
        this.trackedApps[taskId] = {
            name: appName,
            startTime: Date.now(),
            elapsedTime: 0,
            running: true,
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
}

// Crea un'istanza globale
window.appTimerTracker = new AppTimerTracker(); 