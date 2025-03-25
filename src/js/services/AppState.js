/**
 * AppState - Gestisce lo stato globale dell'applicazione
 * Fornisce un meccanismo di sottoscrizione per notificare i componenti 
 * quando lo stato cambia
 */
class AppState {
    constructor() {
        this.state = {
            activeProject: null,
            projects: [],
            tasks: {},
            completedTasks: [],
            filters: {
                showCompleted: false,
                priorities: [],
                searchQuery: ''
            },
            ui: {
                sidebarOpen: true,
                currentView: 'tasks',
                lastSelectedProject: null
            },
            stats: {
                completedCount: 0,
                totalTime: 0,
                priorityCounts: {
                    urgent: 0,
                    medium: 0,
                    normal: 0
                }
            }
        };

        this.listeners = {}; // Callbacks associati a chiavi specifiche dello stato
        this.globalListeners = []; // Callbacks per qualsiasi cambiamento di stato
        this.databaseService = null;
    }

    /**
     * Inizializza lo stato dell'applicazione
     * @param {Object} databaseService - Servizio database per la persistenza
     * @returns {Promise<void>}
     */
    async initialize(databaseService) {
        this.databaseService = databaseService;

        console.log('AppState: Inizializzazione...');

        try {
            // Carica lo stato salvato dal database
            const savedState = await this.databaseService.getAppState('appState');

            if (savedState && savedState.value) {
                // Combina lo stato predefinito con quello salvato
                this.state = {
                    ...this.state,
                    ...savedState.value
                };
                console.log('AppState: Stato caricato dal database');
            } else {
                console.log('AppState: Nessuno stato salvato trovato, utilizzo defaults');
            }

            // Carica anche l'ultimo progetto selezionato
            const lastProject = await this.databaseService.getLastSelectedProject();
            if (lastProject) {
                this.state.ui.lastSelectedProject = lastProject;
                console.log('AppState: Ultimo progetto selezionato caricato', lastProject.id);
            }

            console.log('AppState: Inizializzazione completata');
        } catch (error) {
            console.error('AppState: Errore durante l\'inizializzazione', error);
        }
    }

    /**
     * Ottiene lo stato intero o una parte specifica
     * @param {string} [key] - Chiave opzionale per ottenere una parte specifica dello stato
     * @returns {any} - Stato richiesto
     */
    getState(key = null) {
        if (key === null) {
            return { ...this.state };
        }

        return this.getNestedProperty(this.state, key);
    }

    /**
     * Aggiorna lo stato
     * @param {string} key - Chiave dello stato da aggiornare
     * @param {any} value - Nuovo valore
     * @param {boolean} [persist=true] - Se salvare lo stato aggiornato
     * @returns {boolean} - true se lo stato è stato aggiornato, false altrimenti
     */
    updateState(key, value, persist = true) {
        // Controlla se il valore è effettivamente cambiato
        const currentValue = this.getNestedProperty(this.state, key);

        // Verifica se i valori sono identici (semplice confronto per riferimento)
        if (currentValue === value) {
            return false; // Nessun cambiamento
        }

        // Verifica più approfondita per oggetti e array
        if (typeof value === 'object' && value !== null && typeof currentValue === 'object' && currentValue !== null) {
            // Confronta gli oggetti come JSON
            if (JSON.stringify(currentValue) === JSON.stringify(value)) {
                return false; // Nessun cambiamento
            }
        }

        // Aggiorna lo stato
        this.setNestedProperty(this.state, key, value);

        // Notifica i listener
        this.notifyListeners(key, value);

        // Salva lo stato se richiesto
        if (persist) {
            this.persistState();
        }

        return true;
    }

    /**
     * Aggiorna più parti dello stato contemporaneamente
     * @param {Object} updates - Oggetto con le chiavi e i valori da aggiornare
     * @param {boolean} [persist=true] - Se salvare lo stato aggiornato
     * @returns {boolean} - true se almeno una parte dello stato è stata aggiornata
     */
    batchUpdate(updates, persist = true) {
        let hasChanges = false;

        // Applica tutti gli aggiornamenti senza persistere
        for (const key in updates) {
            if (this.updateState(key, updates[key], false)) {
                hasChanges = true;
            }
        }

        // Persiste solo una volta alla fine se ci sono cambiamenti
        if (hasChanges && persist) {
            this.persistState();
        }

        return hasChanges;
    }

    /**
     * Salva lo stato nel database
     * @returns {Promise<void>}
     */
    async persistState() {
        if (!this.databaseService) {
            console.warn('AppState: Impossibile salvare lo stato, databaseService non inizializzato');
            return;
        }

        try {
            await this.databaseService.saveAppState('appState', this.state);
            console.log('AppState: Stato salvato nel database');

            // Salva anche l'ultimo progetto selezionato separatamente per compatibilità
            if (this.state.ui.lastSelectedProject) {
                await this.databaseService.saveLastSelectedProject(this.state.ui.lastSelectedProject);
            }
        } catch (error) {
            console.error('AppState: Errore durante il salvataggio dello stato', error);
        }
    }

    /**
     * Sottoscrive un listener per i cambiamenti di una specifica chiave dello stato
     * @param {string} key - Chiave dello stato da monitorare
     * @param {Function} callback - Funzione da chiamare quando lo stato cambia
     * @returns {Function} - Funzione per cancellare la sottoscrizione
     */
    subscribe(key, callback) {
        if (typeof callback !== 'function') {
            console.error('AppState: Il callback deve essere una funzione');
            return () => { };
        }

        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }

        this.listeners[key].push(callback);

        // Chiamata iniziale con lo stato corrente
        const currentValue = this.getNestedProperty(this.state, key);
        callback(currentValue);

        // Restituisce una funzione per annullare la sottoscrizione
        return () => {
            this.unsubscribe(key, callback);
        };
    }

    /**
     * Sottoscrive un listener per qualsiasi cambiamento dello stato
     * @param {Function} callback - Funzione da chiamare quando lo stato cambia
     * @returns {Function} - Funzione per cancellare la sottoscrizione
     */
    subscribeToAll(callback) {
        if (typeof callback !== 'function') {
            console.error('AppState: Il callback deve essere una funzione');
            return () => { };
        }

        this.globalListeners.push(callback);

        // Chiamata iniziale con lo stato corrente
        callback(this.state);

        // Restituisce una funzione per annullare la sottoscrizione
        return () => {
            this.unsubscribeFromAll(callback);
        };
    }

    /**
     * Cancella la sottoscrizione di un listener
     * @param {string} key - Chiave dello stato
     * @param {Function} callback - Callback da rimuovere
     */
    unsubscribe(key, callback) {
        if (this.listeners[key]) {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);

            // Rimuovi l'array se è vuoto
            if (this.listeners[key].length === 0) {
                delete this.listeners[key];
            }
        }
    }

    /**
     * Cancella la sottoscrizione di un listener globale
     * @param {Function} callback - Callback da rimuovere
     */
    unsubscribeFromAll(callback) {
        this.globalListeners = this.globalListeners.filter(cb => cb !== callback);
    }

    /**
     * Notifica i listener dei cambiamenti
     * @param {string} key - Chiave dello stato modificato
     * @param {any} value - Nuovo valore
     */
    notifyListeners(key, value) {
        // Notifica i listener diretti per la chiave
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                try {
                    callback(value);
                } catch (error) {
                    console.error(`AppState: Errore nel callback per ${key}`, error);
                }
            });
        }

        // Notifica anche i listener per le chiavi padre
        const keyParts = key.split('.');
        while (keyParts.length > 1) {
            keyParts.pop();
            const parentKey = keyParts.join('.');
            const parentValue = this.getNestedProperty(this.state, parentKey);

            if (this.listeners[parentKey]) {
                this.listeners[parentKey].forEach(callback => {
                    try {
                        callback(parentValue);
                    } catch (error) {
                        console.error(`AppState: Errore nel callback per ${parentKey}`, error);
                    }
                });
            }
        }

        // Notifica i listener globali
        this.globalListeners.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('AppState: Errore nel callback globale', error);
            }
        });
    }

    /**
     * Ottiene una proprietà annidata dallo stato
     * @param {Object} obj - Oggetto da cui ottenere la proprietà
     * @param {string} path - Percorso della proprietà (es. 'ui.sidebarOpen')
     * @returns {any} - Valore della proprietà o undefined se non trovata
     */
    getNestedProperty(obj, path) {
        if (!path) return obj;

        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }

            current = current[part];
        }

        return current;
    }

    /**
     * Imposta una proprietà annidata nello stato
     * @param {Object} obj - Oggetto in cui impostare la proprietà
     * @param {string} path - Percorso della proprietà (es. 'ui.sidebarOpen')
     * @param {any} value - Valore da impostare
     */
    setNestedProperty(obj, path, value) {
        if (!path) return;

        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];

            // Crea l'oggetto se non esiste
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }

            current = current[part];
        }

        // Imposta il valore finale
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }

    /**
     * Aggiorna le statistiche dell'applicazione
     * @param {Array} tasks - Array di task
     * @returns {Object} - Nuove statistiche
     */
    updateStats(tasks) {
        const stats = {
            completedCount: 0,
            totalTime: 0,
            priorityCounts: {
                urgent: 0,
                medium: 0,
                normal: 0
            }
        };

        // Calcola le statistiche in base ai task
        tasks.forEach(task => {
            // Conteggia task completati
            if (task.completed) {
                stats.completedCount++;
            }

            // Conteggia task per priorità
            if (task.priority) {
                stats.priorityCounts[task.priority] = (stats.priorityCounts[task.priority] || 0) + 1;
            }

            // Somma il tempo totale
            if (task.time_end_task) {
                stats.totalTime += task.time_end_task;
            }
        });

        // Aggiorna lo stato
        this.updateState('stats', stats);

        return stats;
    }

    /**
     * Imposta il progetto attivo
     * @param {Object} project - Progetto da attivare
     * @returns {boolean} - true se il progetto è stato attivato
     */
    setActiveProject(project) {
        if (!project) return false;

        // Aggiorna il progetto attivo
        const updated = this.updateState('activeProject', project);

        // Aggiorna anche l'ultimo progetto selezionato
        if (updated) {
            const lastSelectedProject = {
                id: project.id,
                name: project.name,
                timestamp: new Date().getTime()
            };

            this.updateState('ui.lastSelectedProject', lastSelectedProject);
        }

        return updated;
    }

    /**
     * Aggiorna i task per il progetto attivo
     * @param {Array} tasks - Array di task
     * @returns {boolean} - true se i task sono stati aggiornati
     */
    updateProjectTasks(tasks) {
        const activeProject = this.state.activeProject;

        if (!activeProject) {
            console.warn('AppState: Nessun progetto attivo per aggiornare i task');
            return false;
        }

        // Aggiorna la lista di task
        const updated = this.updateState('tasks', {
            ...this.state.tasks,
            [activeProject.id]: tasks
        });

        // Aggiorna anche le statistiche
        if (updated) {
            this.updateStats(tasks);
        }

        return updated;
    }

    /**
     * Aggiorna un singolo task
     * @param {Object} task - Task da aggiornare
     * @returns {boolean} - true se il task è stato aggiornato
     */
    updateTask(task) {
        if (!task || !task.id || !task.project_id) {
            console.warn('AppState: Task non valido per l\'aggiornamento', task);
            return false;
        }

        const projectId = task.project_id;
        const tasks = this.state.tasks[projectId] || [];

        // Trova l'indice del task da aggiornare
        const taskIndex = tasks.findIndex(t => t.id === task.id);

        if (taskIndex === -1) {
            // Task non trovato, lo aggiungiamo
            const newTasks = [...tasks, task];

            // Aggiorna la lista di task
            const updated = this.updateState(`tasks.${projectId}`, newTasks);

            // Aggiorna anche le statistiche
            if (updated) {
                this.updateStats(newTasks);
            }

            return updated;
        } else {
            // Task trovato, lo aggiorniamo
            const newTasks = [...tasks];
            newTasks[taskIndex] = task;

            // Aggiorna la lista di task
            const updated = this.updateState(`tasks.${projectId}`, newTasks);

            // Aggiorna anche le statistiche
            if (updated) {
                this.updateStats(newTasks);
            }

            return updated;
        }
    }

    /**
     * Rimuove un task
     * @param {number|string} taskId - ID del task
     * @param {number|string} projectId - ID del progetto
     * @returns {boolean} - true se il task è stato rimosso
     */
    removeTask(taskId, projectId) {
        const tasks = this.state.tasks[projectId] || [];

        // Filtra il task da rimuovere
        const newTasks = tasks.filter(t => t.id !== taskId);

        // Verifica se il task è stato trovato
        if (newTasks.length === tasks.length) {
            return false; // Task non trovato
        }

        // Aggiorna la lista di task
        const updated = this.updateState(`tasks.${projectId}`, newTasks);

        // Aggiorna anche le statistiche
        if (updated) {
            this.updateStats(newTasks);
        }

        return updated;
    }

    /**
     * Aggiorna i filtri dei task
     * @param {Object} filters - Filtri da applicare
     * @returns {boolean} - true se i filtri sono stati aggiornati
     */
    updateFilters(filters) {
        return this.updateState('filters', {
            ...this.state.filters,
            ...filters
        });
    }
}

// Esporta un'istanza singleton del servizio
const appState = new AppState();
export default appState; 