/**
 * TimerService - Gestisce tutti i timer attivi nell'applicazione
 * Fornisce un meccanismo centralizzato per aggiornare e sincronizzare i timer
 */
class TimerService {
    constructor() {
        this.timers = {}; // Mappa di tutti i timer attivi: {taskId: timerData}
        this.intervalId = null; // ID dell'intervallo principale
        this.isInitialized = false;
        this.lastSaveTime = 0;
        this.saveBatchInterval = 60000; // Salvataggio batch ogni 60 secondi
        this.saveCallbacks = []; // Callback da chiamare quando si salvano i timer
        this.updateCallbacks = {}; // Callback da chiamare quando si aggiornano i timer
    }

    /**
     * Inizializza il servizio timer
     * @param {Object} databaseService - Servizio database per la persistenza
     * @returns {Promise<void>}
     */
    async initialize(databaseService) {
        if (this.isInitialized) {
            console.log('TimerService: Già inizializzato');
            return;
        }

        console.log('TimerService: Inizializzazione...');

        // Salva il riferimento al database service
        this.db = databaseService;

        try {
            // Carica i timer dal database
            await this.loadTimers();

            // Avvia il loop principale
            this.startTimerLoop();

            this.isInitialized = true;
            console.log('TimerService: Inizializzazione completata');
        } catch (error) {
            console.error('TimerService: Errore durante l\'inizializzazione', error);
            throw error;
        }
    }

    /**
     * Avvia il loop principale dei timer
     */
    startTimerLoop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
        }

        // Aggiorna i timer ogni secondo
        this.intervalId = setInterval(() => {
            this.updateTimers();

            // Verifica se è il momento di salvare i timer
            const now = Date.now();
            if (now - this.lastSaveTime >= this.saveBatchInterval) {
                this.saveTimers();
                this.lastSaveTime = now;
            }
        }, 1000);

        console.log('TimerService: Loop timer avviato');
    }

    /**
     * Ferma il loop principale dei timer
     */
    stopTimerLoop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('TimerService: Loop timer fermato');
        }
    }

    /**
     * Carica i timer dal database
     * @returns {Promise<void>}
     */
    async loadTimers() {
        try {
            // Carica lo stato dei timer dal database
            const timerState = await this.db.getAppState('activeTimers');

            if (timerState && timerState.value) {
                this.timers = timerState.value;
                console.log('TimerService: Timer caricati', Object.keys(this.timers).length);
            } else {
                this.timers = {};
                console.log('TimerService: Nessun timer da caricare');
            }

            // Inizializza il tempo dell'ultimo salvataggio
            this.lastSaveTime = Date.now();
        } catch (error) {
            console.error('TimerService: Errore durante il caricamento dei timer', error);
            this.timers = {};
        }
    }

    /**
     * Salva i timer nel database
     * @returns {Promise<void>}
     */
    async saveTimers() {
        if (!this.db || Object.keys(this.timers).length === 0) {
            return;
        }

        try {
            // Salva lo stato dei timer nel database
            await this.db.saveAppState('activeTimers', this.timers);
            console.log('TimerService: Timer salvati', Object.keys(this.timers).length);

            // Chiama i callback di salvataggio
            this.saveCallbacks.forEach(callback => {
                try {
                    callback(this.timers);
                } catch (error) {
                    console.error('TimerService: Errore nel callback di salvataggio', error);
                }
            });
        } catch (error) {
            console.error('TimerService: Errore durante il salvataggio dei timer', error);
        }
    }

    /**
     * Aggiorna tutti i timer attivi
     */
    updateTimers() {
        const now = Date.now();
        let timerUpdated = false;

        // Aggiorna ogni timer attivo
        for (const taskId in this.timers) {
            const timer = this.timers[taskId];

            // Verifica se il timer è in pausa
            if (!timer.running) {
                continue;
            }

            // Calcola il tempo trascorso dall'ultimo aggiornamento
            const elapsed = now - timer.lastUpdateTime;
            timer.elapsedTime += elapsed;
            timer.lastUpdateTime = now;

            // Aggiorna lo stato del timer
            const timeLeft = Math.max(0, timer.duration - timer.elapsedTime);

            // Verifica se il timer è completato
            if (timeLeft === 0 && timer.running) {
                timer.running = false;
                timer.completed = true;

                // Notifica che il timer è completato
                this.notifyTimerCompleted(taskId, timer);
            }

            // Invia aggiornamenti per questo timer
            this.notifyTimerUpdated(taskId, {
                ...timer,
                timeLeft
            });

            timerUpdated = true;
        }

        // Se almeno un timer è stato aggiornato, forza un salvataggio
        if (timerUpdated && (now - this.lastSaveTime >= 10000)) { // Salva comunque ogni 10 secondi se c'è attività
            this.saveTimers();
            this.lastSaveTime = now;
        }
    }

    /**
     * Avvia un timer per un task
     * @param {string|number} taskId - ID del task
     * @param {number} duration - Durata del timer in millisecondi
     * @param {Object} timerData - Dati aggiuntivi del timer
     * @returns {Object} - Dati del timer creato
     */
    startTimer(taskId, duration, timerData = {}) {
        const now = Date.now();

        // Crea o aggiorna il timer
        this.timers[taskId] = {
            taskId,
            duration, // Durata totale in millisecondi
            elapsedTime: 0, // Tempo trascorso in millisecondi
            startTime: now, // Orario di avvio
            lastUpdateTime: now, // Ultimo aggiornamento
            running: true, // Stato di esecuzione
            completed: false, // Stato di completamento
            ...timerData // Eventuali dati aggiuntivi
        };

        console.log(`TimerService: Avviato timer per task ${taskId}, durata ${duration}ms`);

        // Notifica l'avvio del timer
        this.notifyTimerUpdated(taskId, this.timers[taskId]);

        // Forza un salvataggio immediato
        this.saveTimers();

        return this.timers[taskId];
    }

    /**
     * Mette in pausa un timer
     * @param {string|number} taskId - ID del task
     * @returns {Object|null} - Dati del timer aggiornato o null se non trovato
     */
    pauseTimer(taskId) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        if (!timer.running) {
            console.log(`TimerService: Timer già in pausa per task ${taskId}`);
            return timer;
        }

        // Aggiorna lo stato del timer
        const now = Date.now();
        const elapsed = now - timer.lastUpdateTime;

        timer.elapsedTime += elapsed;
        timer.lastUpdateTime = now;
        timer.running = false;

        console.log(`TimerService: Timer in pausa per task ${taskId}, tempo trascorso ${timer.elapsedTime}ms`);

        // Notifica la pausa del timer
        this.notifyTimerUpdated(taskId, timer);

        // Forza un salvataggio immediato
        this.saveTimers();

        return timer;
    }

    /**
     * Riprende un timer in pausa
     * @param {string|number} taskId - ID del task
     * @returns {Object|null} - Dati del timer aggiornato o null se non trovato
     */
    resumeTimer(taskId) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        if (timer.running) {
            console.log(`TimerService: Timer già in esecuzione per task ${taskId}`);
            return timer;
        }

        if (timer.completed) {
            console.log(`TimerService: Impossibile riprendere un timer completato per task ${taskId}`);
            return timer;
        }

        // Aggiorna lo stato del timer
        const now = Date.now();

        timer.lastUpdateTime = now;
        timer.running = true;

        console.log(`TimerService: Timer ripreso per task ${taskId}`);

        // Notifica la ripresa del timer
        this.notifyTimerUpdated(taskId, timer);

        // Forza un salvataggio immediato
        this.saveTimers();

        return timer;
    }

    /**
     * Ferma un timer
     * @param {string|number} taskId - ID del task
     * @returns {Object|null} - Dati del timer aggiornato o null se non trovato
     */
    stopTimer(taskId) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        // Aggiorna lo stato del timer
        if (timer.running) {
            const now = Date.now();
            const elapsed = now - timer.lastUpdateTime;
            timer.elapsedTime += elapsed;
        }

        timer.running = false;
        timer.completed = true;

        console.log(`TimerService: Timer fermato per task ${taskId}, tempo finale ${timer.elapsedTime}ms`);

        // Notifica lo stop del timer
        this.notifyTimerUpdated(taskId, timer);

        // Forza un salvataggio immediato
        this.saveTimers();

        return timer;
    }

    /**
     * Resetta un timer
     * @param {string|number} taskId - ID del task
     * @param {boolean} restart - Se riavviare il timer dopo il reset
     * @returns {Object|null} - Dati del timer aggiornato o null se non trovato
     */
    resetTimer(taskId, restart = false) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        // Salva la durata originale
        const { duration } = timer;
        const now = Date.now();

        // Resetta lo stato del timer
        timer.elapsedTime = 0;
        timer.startTime = now;
        timer.lastUpdateTime = now;
        timer.running = restart;
        timer.completed = false;

        console.log(`TimerService: Timer resettato per task ${taskId}, riavvio: ${restart}`);

        // Notifica il reset del timer
        this.notifyTimerUpdated(taskId, timer);

        // Forza un salvataggio immediato
        this.saveTimers();

        return timer;
    }

    /**
     * Elimina un timer
     * @param {string|number} taskId - ID del task
     * @returns {boolean} - true se il timer è stato eliminato, false altrimenti
     */
    deleteTimer(taskId) {
        if (!this.timers[taskId]) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return false;
        }

        // Elimina il timer
        delete this.timers[taskId];

        console.log(`TimerService: Timer eliminato per task ${taskId}`);

        // Notifica l'eliminazione del timer
        this.notifyTimerDeleted(taskId);

        // Forza un salvataggio immediato
        this.saveTimers();

        return true;
    }

    /**
     * Ottiene i dati di un timer
     * @param {string|number} taskId - ID del task
     * @returns {Object|null} - Dati del timer o null se non trovato
     */
    getTimer(taskId) {
        const timer = this.timers[taskId];

        if (!timer) {
            return null;
        }

        // Se il timer è in esecuzione, calcola il tempo rimanente
        if (timer.running) {
            const now = Date.now();
            const elapsed = now - timer.lastUpdateTime;
            const totalElapsed = timer.elapsedTime + elapsed;
            const timeLeft = Math.max(0, timer.duration - totalElapsed);

            return {
                ...timer,
                currentElapsed: totalElapsed,
                timeLeft
            };
        }

        // Se il timer è in pausa, restituisci i dati attuali
        const timeLeft = Math.max(0, timer.duration - timer.elapsedTime);

        return {
            ...timer,
            currentElapsed: timer.elapsedTime,
            timeLeft
        };
    }

    /**
     * Ottiene tutti i timer attivi
     * @returns {Object} - Mappa dei timer attivi
     */
    getAllTimers() {
        const result = {};
        const now = Date.now();

        // Calcola i dati aggiornati per ogni timer
        for (const taskId in this.timers) {
            const timer = this.timers[taskId];

            // Se il timer è in esecuzione, calcola il tempo trascorso
            if (timer.running) {
                const elapsed = now - timer.lastUpdateTime;
                const totalElapsed = timer.elapsedTime + elapsed;
                const timeLeft = Math.max(0, timer.duration - totalElapsed);

                result[taskId] = {
                    ...timer,
                    currentElapsed: totalElapsed,
                    timeLeft
                };
            } else {
                // Se il timer è in pausa, usa i dati attuali
                const timeLeft = Math.max(0, timer.duration - timer.elapsedTime);

                result[taskId] = {
                    ...timer,
                    currentElapsed: timer.elapsedTime,
                    timeLeft
                };
            }
        }

        return result;
    }

    /**
     * Converte un tempo in millisecondi in un formato leggibile
     * @param {number} timeMs - Tempo in millisecondi
     * @returns {string} - Tempo formattato (HH:MM:SS)
     */
    formatTime(timeMs) {
        const totalSeconds = Math.floor(timeMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
    }

    /**
     * Converte un tempo in formato leggibile in millisecondi
     * @param {string} timeFormatted - Tempo formattato (HH:MM:SS)
     * @returns {number} - Tempo in millisecondi
     */
    parseFormattedTime(timeFormatted) {
        const [hours, minutes, seconds] = timeFormatted.split(':').map(Number);
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    /**
     * Registra un callback per il salvataggio dei timer
     * @param {Function} callback - Funzione da chiamare quando i timer vengono salvati
     */
    onSave(callback) {
        if (typeof callback === 'function') {
            this.saveCallbacks.push(callback);
        }
    }

    /**
     * Registra un callback per l'aggiornamento di un timer
     * @param {string|number} taskId - ID del task o 'all' per tutti i timer
     * @param {Function} callback - Funzione da chiamare quando il timer viene aggiornato
     */
    onTimerUpdate(taskId, callback) {
        if (typeof callback === 'function') {
            if (!this.updateCallbacks[taskId]) {
                this.updateCallbacks[taskId] = [];
            }
            this.updateCallbacks[taskId].push(callback);
        }
    }

    /**
     * Rimuove un callback per l'aggiornamento di un timer
     * @param {string|number} taskId - ID del task
     * @param {Function} callback - Callback da rimuovere
     */
    offTimerUpdate(taskId, callback) {
        if (this.updateCallbacks[taskId]) {
            this.updateCallbacks[taskId] = this.updateCallbacks[taskId]
                .filter(cb => cb !== callback);
        }
    }

    /**
     * Notifica i listeners che un timer è stato aggiornato
     * @param {string|number} taskId - ID del task
     * @param {Object} timerData - Dati aggiornati del timer
     */
    notifyTimerUpdated(taskId, timerData) {
        // Chiama i callback specifici per questo timer
        if (this.updateCallbacks[taskId]) {
            this.updateCallbacks[taskId].forEach(callback => {
                try {
                    callback(timerData);
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di aggiornamento per ${taskId}`, error);
                }
            });
        }

        // Chiama i callback generici per tutti i timer
        if (this.updateCallbacks['all']) {
            this.updateCallbacks['all'].forEach(callback => {
                try {
                    callback({ taskId, ...timerData });
                } catch (error) {
                    console.error('TimerService: Errore nel callback di aggiornamento globale', error);
                }
            });
        }
    }

    /**
     * Notifica i listeners che un timer è stato completato
     * @param {string|number} taskId - ID del task
     * @param {Object} timerData - Dati del timer completato
     */
    notifyTimerCompleted(taskId, timerData) {
        // Evento specifico di completamento
        if (this.updateCallbacks[`${taskId}:completed`]) {
            this.updateCallbacks[`${taskId}:completed`].forEach(callback => {
                try {
                    callback(timerData);
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di completamento per ${taskId}`, error);
                }
            });
        }

        // Evento generico di completamento
        if (this.updateCallbacks['completed']) {
            this.updateCallbacks['completed'].forEach(callback => {
                try {
                    callback({ taskId, ...timerData });
                } catch (error) {
                    console.error('TimerService: Errore nel callback di completamento globale', error);
                }
            });
        }
    }

    /**
     * Notifica i listeners che un timer è stato eliminato
     * @param {string|number} taskId - ID del task
     */
    notifyTimerDeleted(taskId) {
        // Evento specifico di eliminazione
        if (this.updateCallbacks[`${taskId}:deleted`]) {
            this.updateCallbacks[`${taskId}:deleted`].forEach(callback => {
                try {
                    callback({ taskId });
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di eliminazione per ${taskId}`, error);
                }
            });
        }

        // Evento generico di eliminazione
        if (this.updateCallbacks['deleted']) {
            this.updateCallbacks['deleted'].forEach(callback => {
                try {
                    callback({ taskId });
                } catch (error) {
                    console.error('TimerService: Errore nel callback di eliminazione globale', error);
                }
            });
        }
    }
}

// Esporta un'istanza singleton del servizio
const timerService = new TimerService();
export default timerService; 