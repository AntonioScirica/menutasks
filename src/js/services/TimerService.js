/**
 * Servizio per la gestione dei timer delle task
 * 
 * Gestisce un singolo ciclo di aggiornamento per tutti i timer
 * invece di avere cicli separati per ogni timer
 */
class TimerService {
    constructor() {
        this.activeTimers = new Map();
        this.timerSavedStates = new Map();
        this.updateInterval = null;
        this.saveInterval = null;
        this.initialized = false;
        this.modalOpen = false;
        this.currentTaskId = null;
        this.timerInterval = null;
    }

    /**
     * Inizializza il servizio
     */
    initialize() {
        if (this.initialized) return;

        // Avvia l'intervallo di aggiornamento globale
        this.startGlobalTimerLoop();

        this.initialized = true;
        console.log('TimerService inizializzato');
    }

    /**
     * Avvia un timer globale che gestisce tutti i timer attivi
     */
    startGlobalTimerLoop() {
        // Ferma eventuali intervalli esistenti
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }

        // Intervallo per incrementare tutti i timer ogni secondo
        this.updateInterval = setInterval(() => {
            this.activeTimers.forEach((timer, taskId) => {
                // Incrementa il timer
                timer.seconds++;

                // Aggiorna eventuali visualizzazioni UI
                this.updateTimerDisplay(taskId, timer.seconds);
            });
        }, 1000);

        // Intervallo per salvare tutti i timer ogni minuto
        this.saveInterval = setInterval(() => {
            this.saveAllTimers();
        }, 60000); // 1 minuto

        console.log('Loop globale timer avviato');
    }

    /**
     * Aggiorna la visualizzazione UI per un timer specifico
     * @param {string} taskId - ID della task
     * @param {number} seconds - Secondi da visualizzare
     */
    updateTimerDisplay(taskId, seconds) {
        // Aggiorna eventuali elementi UI che mostrano questo timer
        const timerElement = document.querySelector(`#timer-${taskId}`);
        if (timerElement) {
            timerElement.textContent = formatTime(seconds);
        }
    }

    /**
     * Avvia un timer per una task specifica
     * @param {string} taskId - ID della task
     * @param {number|null} initialSeconds - Valore iniziale in secondi (opzionale)
     */
    startTaskTimer(taskId, initialSeconds = null) {
        if (!taskId) {
            console.error("startTaskTimer: ID task non valido");
            return;
        }

        // Se il timer è già attivo, non faccio nulla
        if (this.activeTimers.has(taskId)) {
            console.log(`Timer già attivo per task ${taskId}, non verrà riavviato`);
            return;
        }

        // Se ho un valore iniziale, lo uso
        if (initialSeconds !== null) {
            this.createTaskTimer(taskId, initialSeconds);
            return;
        }

        // Altrimenti recupero il valore dal database
        databaseService.supabase
            .from('tasks')
            .select('timer_seconds, timer_enabled')
            .eq('id', taskId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.error("Errore nel recupero del timer:", error);
                    return;
                }

                // Verifico che il timer sia abilitato
                if (!data.timer_enabled) {
                    console.log(`Timer non abilitato per task ${taskId}, non verrà avviato`);
                    return;
                }

                // Uso i secondi esistenti o zero
                const initialSeconds = data?.timer_seconds || 0;
                console.log(`Timer iniziale per task ${taskId}: ${initialSeconds} secondi`);

                this.createTaskTimer(taskId, initialSeconds);
            })
            .catch(err => {
                console.error("Errore nella query per il timer:", err);
            });
    }

    /**
     * Crea un timer per una task
     * @param {string} taskId - ID della task
     * @param {number} initialSeconds - Valore iniziale in secondi
     */
    createTaskTimer(taskId, initialSeconds) {
        // Crea un oggetto timer
        const timer = {
            taskId,
            seconds: initialSeconds || 0,
            startTime: Date.now()
        };

        // Aggiungo il timer alla mappa dei timer attivi
        this.activeTimers.set(taskId, timer);

        // Registro lo stato iniziale per il salvataggio
        this.updateSavedState(taskId, timer.seconds);

        console.log(`Timer avviato correttamente per task ${taskId}`);
    }

    /**
     * Ferma il timer di una task
     * @param {string} taskId - ID della task
     * @returns {Promise<void>}
     */
    async stopTaskTimer(taskId) {
        if (!taskId || !this.activeTimers.has(taskId)) {
            console.log(`Nessun timer attivo trovato per task ${taskId}`);
            return;
        }

        try {
            console.log(`Arresto timer per task ${taskId}`);

            // Ottengo il timer
            const timer = this.activeTimers.get(taskId);

            // Salvo lo stato finale
            await Promise.all([
                databaseService.saveTimerToLocalStorage(taskId, timer.seconds),
                databaseService.saveTimerToSupabase(taskId, timer.seconds)
            ]);

            console.log(`Timer per task ${taskId} arrestato e salvato: ${timer.seconds} secondi`);

            // Rimuovo il timer dalla mappa
            this.activeTimers.delete(taskId);

            // Rimuovo lo stato salvato
            this.timerSavedStates.delete(taskId);
        } catch (err) {
            console.error(`Errore nell'arresto del timer per task ${taskId}:`, err);
            // Rimuovo comunque il timer per evitare problemi
            this.activeTimers.delete(taskId);
            this.timerSavedStates.delete(taskId);
        }
    }

    /**
     * Salva tutti i timer attivi
     * @returns {Promise<void>}
     */
    async saveAllTimers() {
        console.log(`Salvataggio di ${this.activeTimers.size} timer attivi...`);

        const savePromises = [];

        this.activeTimers.forEach((timer, taskId) => {
            // Verifico se è necessario salvare questo timer
            if (this.shouldSaveTimer(taskId, timer.seconds)) {
                console.log(`Salvando timer per task ${taskId}: ${timer.seconds} secondi`);

                // Salva localmente e poi su Supabase
                const promise = databaseService.saveTimerToLocalStorage(taskId, timer.seconds)
                    .then(() => databaseService.saveTimerToSupabase(taskId, timer.seconds))
                    .then(() => {
                        this.updateSavedState(taskId, timer.seconds);
                    })
                    .catch(err => {
                        console.error(`Errore nel salvataggio del timer per task ${taskId}:`, err);
                    });

                savePromises.push(promise);
            }
        });

        if (savePromises.length > 0) {
            await Promise.all(savePromises);
            console.log(`Salvati ${savePromises.length} timer`);
        } else {
            console.log('Nessun timer da salvare');
        }
    }

    /**
     * Determina se è necessario salvare un timer
     * @param {string} taskId - ID della task
     * @param {number} seconds - Secondi attuali
     * @returns {boolean} - true se il timer deve essere salvato
     */
    shouldSaveTimer(taskId, seconds) {
        // Ottieni l'ultimo stato salvato
        const lastState = this.timerSavedStates.get(taskId);

        if (!lastState) {
            return true; // Salva sempre se non c'è stato precedente
        }

        // Se sono passati più di 5 minuti dall'ultimo salvataggio, salva
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (lastState.timestamp < fiveMinutesAgo) {
            return true;
        }

        // Se i secondi sono cambiati significativamente (più di 10), salva
        const secondsDiff = Math.abs(seconds - lastState.seconds);
        return secondsDiff >= 10;
    }

    /**
     * Aggiorna lo stato salvato di un timer
     * @param {string} taskId - ID della task
     * @param {number} seconds - Secondi attuali
     */
    updateSavedState(taskId, seconds) {
        this.timerSavedStates.set(taskId, {
            seconds: seconds,
            timestamp: Date.now()
        });
    }

    /**
     * Inizializza i timer per le task attive
     * @param {Array} tasks - Lista di task attive
     */
    initializeTaskTimers(tasks) {
        console.log(`Inizializzazione timer per ${tasks.length} task attive...`);

        // Inizializzo solo i timer per le task che non hanno già un timer attivo
        tasks.forEach(task => {
            if (!task.completed && !this.activeTimers.has(task.id) && task.timer_enabled) {
                console.log(`Inizializzando timer per task ${task.id}`);
                this.startTaskTimer(task.id);
            }
        });
    }

    /**
     * Arresto e pulizia di tutti i timer
     * @returns {Promise<void>}
     */
    async stopAllTimers() {
        console.log(`Arresto di ${this.activeTimers.size} timer attivi...`);

        const stopPromises = [];

        this.activeTimers.forEach((timer, taskId) => {
            stopPromises.push(this.stopTaskTimer(taskId));
        });

        await Promise.all(stopPromises);

        // Rimuovo gli intervalli globali
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }

        console.log('Tutti i timer sono stati fermati');
    }

    /**
     * Inizializza i timer per le task attive
     * @param {Array} tasks - Le task attive
     */
    initializeTaskTimers(tasks) {
        if (!tasks || tasks.length === 0) return;

        tasks.forEach(task => {
            if (task.time_active && !task.completed) {
                // Aggiorna il display del timer
                this.updateTimerDisplay(task.id, task.time_active);
            }
        });
    }

    /**
     * Aggiorna il display del timer di una task
     * @param {string} taskId - ID della task
     * @param {number} seconds - Secondi trascorsi
     */
    updateTimerDisplay(taskId, seconds) {
        const timerElement = document.getElementById(`task-time-${taskId}`);
        if (!timerElement) return;

        // Calcola ore, minuti e secondi
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        // Formatta il tempo
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours}h `;
        }
        if (minutes > 0 || hours > 0) {
            timeString += `${minutes}m `;
        }
        timeString += `${remainingSeconds}s`;

        // Aggiorna il testo del timer
        timerElement.innerHTML = `<span>${timeString}</span>`;

        // Applica la classe 'active' se il timer è in esecuzione
        if (this.activeTimers.has(taskId)) {
            timerElement.classList.add('active');
        } else {
            timerElement.classList.remove('active');
        }
    }

    /**
     * Apre la modale del timer per una task
     * @param {string} taskId - ID della task
     */
    async openTimerModal(taskId) {
        try {
            // Carica i dati della task
            const task = await databaseService.loadTask(taskId);
            if (!task) {
                console.error('Task non trovata:', taskId);
                return;
            }

            this.currentTaskId = taskId;
            this.modalOpen = true;

            // Prepara la finestra modale
            const modal = document.getElementById('timerModal');
            const taskNameElement = document.getElementById('timerModalTaskName');
            const timerDisplay = document.getElementById('timerModalDisplay');
            const startStopButton = document.getElementById('timerStartStopButton');
            const resetButton = document.getElementById('timerResetButton');
            const closeButton = document.getElementById('timerCloseButton');
            const endTaskButton = document.getElementById('timerEndTaskButton');
            const endTaskTimeInput = document.getElementById('endTaskTimeInput');
            const endTaskForm = document.getElementById('endTaskForm');

            // Imposta il nome della task
            taskNameElement.textContent = task.content;

            // Imposta il tempo corrente
            const seconds = task.time_active || 0;
            this.updateModalTimerDisplay(seconds);

            // Configura il pulsante Start/Stop
            const isTimerRunning = this.activeTimers.has(taskId);
            startStopButton.textContent = isTimerRunning ? 'Pausa' : 'Avvia';
            startStopButton.className = isTimerRunning ? 'button-warning' : 'button-success';

            // Configura il pulsante di chiusura
            closeButton.onclick = () => this.closeTimerModal();

            // Configura il pulsante Reset
            resetButton.onclick = () => this.resetTimer(taskId);

            // Configura il pulsante Start/Stop
            startStopButton.onclick = () => {
                if (this.activeTimers.has(taskId)) {
                    this.stopTimer(taskId);
                    startStopButton.textContent = 'Avvia';
                    startStopButton.className = 'button-success';
                } else {
                    this.startTimer(taskId);
                    startStopButton.textContent = 'Pausa';
                    startStopButton.className = 'button-warning';
                }
            };

            // Configura il form per terminare la task
            endTaskForm.onsubmit = (e) => {
                e.preventDefault();
                this.endTask(taskId, endTaskTimeInput.value);
            };

            // Mostra la finestra modale
            modal.style.display = 'flex';

            // Avvia l'intervallo per aggiornare il timer nella modale
            this.startModalTimerUpdate(taskId);
        } catch (error) {
            console.error('Errore durante l\'apertura della modale del timer:', error);
            showStatus('Errore durante l\'apertura del timer', 'error');
        }
    }

    /**
     * Chiude la modale del timer
     */
    closeTimerModal() {
        const modal = document.getElementById('timerModal');
        modal.style.display = 'none';

        this.modalOpen = false;
        this.currentTaskId = null;

        // Ferma l'aggiornamento del timer nella modale
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Avvia il timer per una task
     * @param {string} taskId - ID della task
     */
    async startTimer(taskId) {
        try {
            if (this.activeTimers.has(taskId)) {
                console.log(`Timer già attivo per la task ${taskId}`);
                return;
            }

            // Carica i dati attuali della task
            const task = await databaseService.loadTask(taskId);
            if (!task) {
                console.error('Task non trovata:', taskId);
                return;
            }

            // Imposta il tempo iniziale
            const startTime = Date.now();
            const initialSeconds = task.time_active || 0;

            // Crea l'oggetto timer
            const timer = {
                startTime,
                initialSeconds,
                interval: setInterval(() => {
                    this.updateTimer(taskId);
                }, 1000)
            };

            // Salva il timer
            this.activeTimers.set(taskId, timer);

            // Aggiorna immediatamente il display
            this.updateTimer(taskId);

            // Aggiorna lo stato del pulsante nella lista task
            const timerButton = document.getElementById(`task-time-${taskId}`);
            if (timerButton) {
                timerButton.classList.add('active');
            }

            console.log(`Timer avviato per la task ${taskId}`);
        } catch (error) {
            console.error(`Errore durante l'avvio del timer per la task ${taskId}:`, error);
            showStatus('Errore durante l\'avvio del timer', 'error');
        }
    }

    /**
     * Ferma il timer per una task
     * @param {string} taskId - ID della task
     */
    async stopTimer(taskId) {
        try {
            const timer = this.activeTimers.get(taskId);
            if (!timer) {
                console.log(`Nessun timer attivo per la task ${taskId}`);
                return;
            }

            // Ferma l'intervallo
            clearInterval(timer.interval);

            // Calcola il tempo trascorso
            const currentSeconds = this.calculateCurrentSeconds(timer);

            // Aggiorna il tempo nella task
            await databaseService.updateTask(taskId, { time_active: currentSeconds });

            // Rimuovi il timer dalla mappa
            this.activeTimers.delete(taskId);

            // Aggiorna il display
            this.updateTimerDisplay(taskId, currentSeconds);

            // Aggiorna lo stato del pulsante nella lista task
            const timerButton = document.getElementById(`task-time-${taskId}`);
            if (timerButton) {
                timerButton.classList.remove('active');
            }

            console.log(`Timer fermato per la task ${taskId}. Tempo totale: ${currentSeconds} secondi`);
        } catch (error) {
            console.error(`Errore durante l'arresto del timer per la task ${taskId}:`, error);
            showStatus('Errore durante l\'arresto del timer', 'error');
        }
    }

    /**
     * Resetta il timer per una task
     * @param {string} taskId - ID della task
     */
    async resetTimer(taskId) {
        try {
            // Ferma il timer se è attivo
            if (this.activeTimers.has(taskId)) {
                await this.stopTimer(taskId);
            }

            // Resetta il tempo nella task
            await databaseService.updateTask(taskId, { time_active: 0 });

            // Aggiorna il display
            this.updateTimerDisplay(taskId, 0);
            this.updateModalTimerDisplay(0);

            console.log(`Timer resettato per la task ${taskId}`);
            showStatus('Timer resettato', 'success');
        } catch (error) {
            console.error(`Errore durante il reset del timer per la task ${taskId}:`, error);
            showStatus('Errore durante il reset del timer', 'error');
        }
    }

    /**
     * Termina una task con un tempo specifico
     * @param {string} taskId - ID della task
     * @param {string} timeString - Tempo in formato "HH:MM"
     */
    async endTask(taskId, timeString) {
        try {
            // Ferma il timer se è attivo
            if (this.activeTimers.has(taskId)) {
                await this.stopTimer(taskId);
            }

            // Converte il tempo in secondi
            const [hours, minutes] = timeString.split(':').map(Number);
            const seconds = (hours * 3600) + (minutes * 60);

            // Aggiorna la task
            await databaseService.updateTask(taskId, {
                time_active: 0,
                time_end_task: seconds,
                completed: true,
                completed_at: new Date().toISOString()
            });

            // Chiudi la modale
            this.closeTimerModal();

            // Aggiorna l'interfaccia
            await loadTasks();

            showStatus('Task completata con successo', 'success');
        } catch (error) {
            console.error(`Errore durante il completamento della task ${taskId}:`, error);
            showStatus('Errore durante il completamento della task', 'error');
        }
    }

    /**
     * Aggiorna il timer per una task
     * @param {string} taskId - ID della task
     */
    async updateTimer(taskId) {
        const timer = this.activeTimers.get(taskId);
        if (!timer) return;

        // Calcola i secondi trascorsi
        const currentSeconds = this.calculateCurrentSeconds(timer);

        // Aggiorna il display
        this.updateTimerDisplay(taskId, currentSeconds);

        // Se la modale è aperta e questa è la task corrente, aggiorna anche il display della modale
        if (this.modalOpen && this.currentTaskId === taskId) {
            this.updateModalTimerDisplay(currentSeconds);
        }

        // Salva periodicamente lo stato del timer
        const now = Date.now();
        if (!timer.lastSave || (now - timer.lastSave) >= 30000) { // Salva ogni 30 secondi
            try {
                await databaseService.updateTask(taskId, { time_active: currentSeconds });
                timer.lastSave = now;
            } catch (error) {
                console.error(`Errore durante il salvataggio del timer per la task ${taskId}:`, error);
            }
        }
    }

    /**
     * Avvia l'aggiornamento del timer nella modale
     * @param {string} taskId - ID della task
     */
    startModalTimerUpdate(taskId) {
        // Ferma l'intervallo esistente se presente
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Avvia un nuovo intervallo
        this.timerInterval = setInterval(() => {
            if (this.modalOpen && this.currentTaskId === taskId) {
                // Se il timer è attivo, aggiorna il display
                if (this.activeTimers.has(taskId)) {
                    const timer = this.activeTimers.get(taskId);
                    const currentSeconds = this.calculateCurrentSeconds(timer);
                    this.updateModalTimerDisplay(currentSeconds);
                } else {
                    // Altrimenti, carica il tempo dalla task
                    databaseService.loadTask(taskId).then(task => {
                        if (task && this.modalOpen && this.currentTaskId === taskId) {
                            this.updateModalTimerDisplay(task.time_active || 0);
                        }
                    }).catch(error => {
                        console.error(`Errore durante il caricamento della task ${taskId}:`, error);
                    });
                }
            } else {
                // Se la modale è chiusa o è cambiata la task, ferma l'intervallo
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }, 1000);
    }

    /**
     * Aggiorna il display del timer nella modale
     * @param {number} seconds - Secondi trascorsi
     */
    updateModalTimerDisplay(seconds) {
        const timerDisplay = document.getElementById('timerModalDisplay');
        if (!timerDisplay) return;

        // Calcola ore, minuti e secondi
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        // Formatta il tempo
        const timeString = [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            remainingSeconds.toString().padStart(2, '0')
        ].join(':');

        // Aggiorna il display
        timerDisplay.textContent = timeString;
    }

    /**
     * Calcola i secondi trascorsi per un timer
     * @param {Object} timer - Oggetto timer
     * @returns {number} - Secondi trascorsi
     */
    calculateCurrentSeconds(timer) {
        const elapsedMilliseconds = Date.now() - timer.startTime;
        const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
        return timer.initialSeconds + elapsedSeconds;
    }
}

// Istanza singleton del servizio
const timerService = new TimerService();

// Esporta il servizio per l'uso in altri moduli
export default timerService; 