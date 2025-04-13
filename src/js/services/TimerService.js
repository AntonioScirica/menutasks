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

    async initialize(databaseService) {
        if (this.isInitialized) {
            console.log('TimerService: Già inizializzato');
            return;
        }

        console.log('TimerService: Inizializzazione...');

        this.db = databaseService;

        try {
            await this.loadTimers();
            this.startTimerLoop();
            this.isInitialized = true;
            console.log('TimerService: Inizializzazione completata');
        } catch (error) {
            console.error('TimerService: Errore durante l\'inizializzazione', error);
            throw error;
        }
    }

    startTimerLoop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.updateTimers();
            const now = Date.now();
            if (now - this.lastSaveTime >= this.saveBatchInterval) {
                this.saveTimers();
                this.lastSaveTime = now;
            }
        }, 1000);

        console.log('TimerService: Loop timer avviato');
    }

    stopTimerLoop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('TimerService: Loop timer fermato');
        }
    }

    async loadTimers() {
        try {
            const timerState = await this.db.getAppState('activeTimers');

            if (timerState && timerState.value) {
                this.timers = timerState.value;
                console.log('TimerService: Timer caricati', Object.keys(this.timers).length);
            } else {
                this.timers = {};
                console.log('TimerService: Nessun timer da caricare');
            }

            this.lastSaveTime = Date.now();
        } catch (error) {
            console.error('TimerService: Errore durante il caricamento dei timer', error);
            this.timers = {};
        }
    }

    async saveTimers() {
        if (!this.db || Object.keys(this.timers).length === 0) {
            return;
        }

        try {
            await this.db.saveAppState('activeTimers', this.timers);
            console.log('TimerService: Timer salvati', Object.keys(this.timers).length);

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

    updateTimers() {
        const now = Date.now();
        let timerUpdated = false;

        for (const taskId in this.timers) {
            const timer = this.timers[taskId];
            if (!timer.running) continue;

            const elapsed = now - timer.lastUpdateTime;
            timer.elapsedTime += elapsed;
            timer.lastUpdateTime = now;

            const timeLeft = Math.max(0, timer.duration - timer.elapsedTime);

            if (timeLeft === 0 && timer.running) {
                timer.running = false;
                timer.completed = true;
                this.notifyTimerCompleted(taskId, timer);
            }

            this.notifyTimerUpdated(taskId, {
                ...timer,
                timeLeft
            });

            timerUpdated = true;
        }

        if (timerUpdated && (now - this.lastSaveTime >= 10000)) {
            this.saveTimers();
            this.lastSaveTime = now;
        }
    }

    startTimer(taskId, duration, timerData = {}) {
        const now = Date.now();

        this.timers[taskId] = {
            taskId,
            duration,
            elapsedTime: 0,
            startTime: now,
            lastUpdateTime: now,
            running: true,
            completed: false,
            ...timerData
        };

        console.log(`TimerService: Avviato timer per task ${taskId}, durata ${duration}ms`);
        this.notifyTimerUpdated(taskId, this.timers[taskId]);
        this.saveTimers();

        return this.timers[taskId];
    }

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

        const now = Date.now();
        const elapsed = now - timer.lastUpdateTime;

        timer.elapsedTime += elapsed;
        timer.lastUpdateTime = now;
        timer.running = false;

        console.log(`TimerService: Timer in pausa per task ${taskId}, tempo trascorso ${timer.elapsedTime}ms`);
        this.notifyTimerUpdated(taskId, timer);
        this.saveTimers();

        return timer;
    }

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

        const now = Date.now();
        timer.lastUpdateTime = now;
        timer.running = true;

        console.log(`TimerService: Timer ripreso per task ${taskId}`);
        this.notifyTimerUpdated(taskId, timer);
        this.saveTimers();

        return timer;
    }

    stopTimer(taskId) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        if (timer.running) {
            const now = Date.now();
            const elapsed = now - timer.lastUpdateTime;
            timer.elapsedTime += elapsed;
        }

        timer.running = false;
        timer.completed = true;

        console.log(`TimerService: Timer fermato per task ${taskId}, tempo finale ${timer.elapsedTime}ms`);
        this.notifyTimerUpdated(taskId, timer);
        this.saveTimers();

        return timer;
    }

    resetTimer(taskId, restart = false) {
        const timer = this.timers[taskId];

        if (!timer) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return null;
        }

        const { duration } = timer;
        const now = Date.now();

        timer.elapsedTime = 0;
        timer.startTime = now;
        timer.lastUpdateTime = now;
        timer.running = restart;
        timer.completed = false;

        console.log(`TimerService: Timer resettato per task ${taskId}, riavvio: ${restart}`);
        this.notifyTimerUpdated(taskId, timer);
        this.saveTimers();

        return timer;
    }

    deleteTimer(taskId) {
        if (!this.timers[taskId]) {
            console.log(`TimerService: Timer non trovato per task ${taskId}`);
            return false;
        }

        delete this.timers[taskId];

        console.log(`TimerService: Timer eliminato per task ${taskId}`);
        this.notifyTimerDeleted(taskId);
        this.saveTimers();

        return true;
    }

    getTimer(taskId) {
        const timer = this.timers[taskId];
        if (!timer) return null;

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

        const timeLeft = Math.max(0, timer.duration - timer.elapsedTime);
        return {
            ...timer,
            currentElapsed: timer.elapsedTime,
            timeLeft
        };
    }

    getAllTimers() {
        const result = {};
        const now = Date.now();

        for (const taskId in this.timers) {
            const timer = this.timers[taskId];

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

    parseFormattedTime(timeFormatted) {
        const [hours, minutes, seconds] = timeFormatted.split(':').map(Number);
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    onSave(callback) {
        if (typeof callback === 'function') {
            this.saveCallbacks.push(callback);
        }
    }

    onTimerUpdate(taskId, callback) {
        if (typeof callback === 'function') {
            if (!this.updateCallbacks[taskId]) {
                this.updateCallbacks[taskId] = [];
            }
            this.updateCallbacks[taskId].push(callback);
        }
    }

    offTimerUpdate(taskId, callback) {
        if (this.updateCallbacks[taskId]) {
            this.updateCallbacks[taskId] = this.updateCallbacks[taskId]
                .filter(cb => cb !== callback);
        }
    }

    notifyTimerUpdated(taskId, timerData) {
        if (this.updateCallbacks[taskId]) {
            this.updateCallbacks[taskId].forEach(callback => {
                try {
                    callback(timerData);
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di aggiornamento per ${taskId}`, error);
                }
            });
        }

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

    notifyTimerCompleted(taskId, timerData) {
        if (this.updateCallbacks[`${taskId}:completed`]) {
            this.updateCallbacks[`${taskId}:completed`].forEach(callback => {
                try {
                    callback(timerData);
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di completamento per ${taskId}`, error);
                }
            });
        }

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

    notifyTimerDeleted(taskId) {
        if (this.updateCallbacks[`${taskId}:deleted`]) {
            this.updateCallbacks[`${taskId}:deleted`].forEach(callback => {
                try {
                    callback({ taskId });
                } catch (error) {
                    console.error(`TimerService: Errore nel callback di eliminazione per ${taskId}`, error);
                }
            });
        }

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

// Aggiunta: compatibilità per getTimerValueFromSupabase
TimerService.prototype.getTimerValueFromSupabase = async function (taskId) {
    try {
        const timer = this.getTimer(taskId);
        if (timer) {
            console.log(`TimerService: Timer recuperato per task ${taskId}`, timer);
            return timer;
        } else {
            console.warn(`TimerService: Nessun timer trovato per il task ${taskId}`);
            return null;
        }
    } catch (err) {
        console.error('TimerService: Errore nel recupero del timer:', err);
        return null;
    }
};

// Esporta un'istanza singleton del servizio
const timerService = new TimerService();
window.timerService = timerService;


window.getTimerValueFromSupabase = function (taskId) {
    const timer = window.timerService.getTimer(taskId);
    if (!timer) return null;
    return {
        elapsed: timer.elapsedTime,
        remaining: timer.timeLeft,
        isRunning: timer.running
    };
};
