/**
 * Servizio per la gestione delle operazioni sul database
 */

class DatabaseService {
    constructor() {
        this.dbName = 'taskManagerDB';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * Inizializza il database
     * @returns {Promise<IDBDatabase>} Promise che si risolve con il database inizializzato
     */
    async initDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Errore durante l\'apertura del database:', event.target.error);
                reject('Errore durante l\'apertura del database');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database aperto con successo');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Crea lo store dei progetti se non esiste
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectsStore.createIndex('name', 'name', { unique: false });
                    projectsStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Crea lo store delle task se non esiste
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    tasksStore.createIndex('project_id', 'project_id', { unique: false });
                    tasksStore.createIndex('parent_id', 'parent_id', { unique: false });
                    tasksStore.createIndex('completed', 'completed', { unique: false });
                    tasksStore.createIndex('priority', 'priority', { unique: false });
                    tasksStore.createIndex('created_at', 'created_at', { unique: false });
                    tasksStore.createIndex('completed_at', 'completed_at', { unique: false });
                    tasksStore.createIndex('position', 'position', { unique: false });
                    tasksStore.createIndex('daily_reset', 'daily_reset', { unique: false });
                }

                // Crea lo store per lo stato dell'applicazione se non esiste
                if (!db.objectStoreNames.contains('app_state')) {
                    const appStateStore = db.createObjectStore('app_state', { keyPath: 'key' });
                    appStateStore.createIndex('key', 'key', { unique: true });
                    appStateStore.createIndex('updated_at', 'updated_at', { unique: false });

                    // Inizializza con alcuni stati di default
                    const transaction = event.target.transaction;
                    const store = transaction.objectStore('app_state');

                    // Aggiunge l'elemento per l'ultimo progetto selezionato
                    store.add({
                        key: 'lastSelectedProject',
                        value: null,
                        updated_at: new Date().toISOString()
                    });
                }

                console.log('Database creato/aggiornato con successo');
            };
        });
    }

    /**
     * Carica tutti i progetti dal database
     * @returns {Promise<Array>} Promise che si risolve con un array di progetti
     */
    async loadProjects() {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                console.error('Errore durante il caricamento dei progetti:', event.target.error);
                reject('Errore durante il caricamento dei progetti');
            };
        });
    }

    /**
     * Crea un nuovo progetto
     * @param {Object} projectData - Dati del progetto
     * @returns {Promise<number>} Promise che si risolve con l'ID del progetto creato
     */
    async createProject(projectData) {
        await this.initDB();

        // Aggiungi la data di creazione
        projectData.created_at = new Date().toISOString();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.add(projectData);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Errore durante la creazione del progetto:', event.target.error);
                reject('Errore durante la creazione del progetto');
            };
        });
    }

    /**
     * Aggiorna un progetto esistente
     * @param {number} projectId - ID del progetto
     * @param {Object} projectData - Nuovi dati del progetto
     * @returns {Promise<void>} Promise che si risolve quando l'aggiornamento è completato
     */
    async updateProject(projectId, projectData) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.get(projectId);

            request.onsuccess = () => {
                const project = request.result;
                if (!project) {
                    reject(`Progetto con ID ${projectId} non trovato`);
                    return;
                }

                // Aggiorna i dati del progetto
                const updatedProject = { ...project, ...projectData };
                const updateRequest = store.put(updatedProject);

                updateRequest.onsuccess = () => {
                    resolve();
                };

                updateRequest.onerror = (event) => {
                    console.error('Errore durante l\'aggiornamento del progetto:', event.target.error);
                    reject('Errore durante l\'aggiornamento del progetto');
                };
            };

            request.onerror = (event) => {
                console.error('Errore durante il recupero del progetto:', event.target.error);
                reject('Errore durante il recupero del progetto');
            };
        });
    }

    /**
     * Elimina un progetto e tutte le sue task
     * @param {number} projectId - ID del progetto
     * @returns {Promise<void>} Promise che si risolve quando l'eliminazione è completata
     */
    async deleteProject(projectId) {
        await this.initDB();

        return new Promise(async (resolve, reject) => {
            // Prima elimina tutte le task associate al progetto
            try {
                await this.deleteTasksByProjectId(projectId);
            } catch (error) {
                console.error('Errore durante l\'eliminazione delle task del progetto:', error);
                reject(error);
                return;
            }

            // Poi elimina il progetto
            const transaction = this.db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            const request = store.delete(projectId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Errore durante l\'eliminazione del progetto:', event.target.error);
                reject('Errore durante l\'eliminazione del progetto');
            };
        });
    }

    /**
     * Carica tutte le task di un progetto
     * @param {number} projectId - ID del progetto
     * @returns {Promise<Array>} Promise che si risolve con un array di task
     */
    async loadTasks(projectId) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('project_id');
            const request = index.getAll(IDBKeyRange.only(projectId));

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                console.error('Errore durante il caricamento delle task:', event.target.error);
                reject('Errore durante il caricamento delle task');
            };
        });
    }

    /**
     * Carica una singola task dal database
     * @param {number} taskId - ID della task
     * @returns {Promise<Object>} Promise che si risolve con la task
     */
    async loadTask(taskId) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.get(taskId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Errore durante il caricamento della task:', event.target.error);
                reject('Errore durante il caricamento della task');
            };
        });
    }

    /**
     * Crea una nuova task
     * @param {Object} taskData - Dati della task
     * @returns {Promise<number>} Promise che si risolve con l'ID della task creata
     */
    async createTask(taskData) {
        await this.initDB();

        // Aggiungi le date
        taskData.created_at = new Date().toISOString();
        taskData.updated_at = taskData.created_at;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.add(taskData);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Errore durante la creazione della task:', event.target.error);
                reject('Errore durante la creazione della task');
            };
        });
    }

    /**
     * Aggiorna una task esistente
     * @param {number} taskId - ID della task
     * @param {Object} taskData - Nuovi dati della task
     * @returns {Promise<void>} Promise che si risolve quando l'aggiornamento è completato
     */
    async updateTask(taskId, taskData) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.get(taskId);

            request.onsuccess = () => {
                const task = request.result;
                if (!task) {
                    reject(`Task con ID ${taskId} non trovata`);
                    return;
                }

                // Aggiorna i dati della task
                const updatedTask = { ...task, ...taskData, updated_at: new Date().toISOString() };
                const updateRequest = store.put(updatedTask);

                updateRequest.onsuccess = () => {
                    resolve();
                };

                updateRequest.onerror = (event) => {
                    console.error('Errore durante l\'aggiornamento della task:', event.target.error);
                    reject('Errore durante l\'aggiornamento della task');
                };
            };

            request.onerror = (event) => {
                console.error('Errore durante il recupero della task:', event.target.error);
                reject('Errore durante il recupero della task');
            };
        });
    }

    /**
     * Elimina una task e tutte le sue subtask
     * @param {number} taskId - ID della task
     * @returns {Promise<void>} Promise che si risolve quando l'eliminazione è completata
     */
    async deleteTask(taskId) {
        await this.initDB();

        return new Promise(async (resolve, reject) => {
            try {
                // Prima elimina tutte le subtask
                await this.deleteSubtasks(taskId);

                // Poi elimina la task
                const transaction = this.db.transaction(['tasks'], 'readwrite');
                const store = transaction.objectStore('tasks');
                const request = store.delete(taskId);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    console.error('Errore durante l\'eliminazione della task:', event.target.error);
                    reject('Errore durante l\'eliminazione della task');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Elimina tutte le subtask di una task
     * @param {number} parentId - ID della task genitore
     * @returns {Promise<void>} Promise che si risolve quando l'eliminazione è completata
     */
    async deleteSubtasks(parentId) {
        await this.initDB();

        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction(['tasks'], 'readwrite');
                const store = transaction.objectStore('tasks');
                const index = store.index('parent_id');
                const request = index.getAll(IDBKeyRange.only(parentId));

                request.onsuccess = async () => {
                    const subtasks = request.result || [];

                    // Elimina ricorsivamente tutte le subtask
                    for (const subtask of subtasks) {
                        await this.deleteTask(subtask.id);
                    }

                    resolve();
                };

                request.onerror = (event) => {
                    console.error('Errore durante il recupero delle subtask:', event.target.error);
                    reject('Errore durante il recupero delle subtask');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Elimina tutte le task di un progetto
     * @param {number} projectId - ID del progetto
     * @returns {Promise<void>} Promise che si risolve quando l'eliminazione è completata
     */
    async deleteTasksByProjectId(projectId) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const index = store.index('project_id');
            const request = index.getAll(IDBKeyRange.only(projectId));

            request.onsuccess = async () => {
                const tasks = request.result || [];

                try {
                    // Elimina ogni task (questo eliminerà anche le relative subtask)
                    for (const task of tasks) {
                        if (!task.parent_id) { // Elimina solo le task principali
                            await this.deleteTask(task.id);
                        }
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            request.onerror = (event) => {
                console.error('Errore durante il recupero delle task del progetto:', event.target.error);
                reject('Errore durante il recupero delle task del progetto');
            };
        });
    }

    /**
     * Carica tutte le task giornaliere che devono essere resettate
     * @returns {Promise<Array>} Promise che si risolve con un array di task
     */
    async loadDailyTasksToReset() {
        await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('daily_reset');
            const request = index.getAll(IDBKeyRange.only(true));

            request.onsuccess = () => {
                const tasks = request.result || [];

                // Filtra le task completate che devono essere resettate
                const tasksToReset = tasks.filter(task => {
                    if (!task.completed || !task.completed_at) return false;

                    // Controlla se la data di completamento è antecedente a oggi
                    const completedDate = new Date(task.completed_at);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    return completedDate < today;
                });

                resolve(tasksToReset);
            };

            request.onerror = (event) => {
                console.error('Errore durante il caricamento delle task giornaliere:', event.target.error);
                reject('Errore durante il caricamento delle task giornaliere');
            };
        });
    }

    /**
     * Resetta lo stato di completamento delle task giornaliere
     * @param {Array} tasks - Task da resettare
     * @returns {Promise<void>} Promise che si risolve quando il reset è completato
     */
    async resetDailyTasks(tasks) {
        await this.initDB();

        return new Promise(async (resolve, reject) => {
            try {
                for (const task of tasks) {
                    await this.updateTask(task.id, {
                        completed: false,
                        completed_at: null
                    });
                }

                resolve();
            } catch (error) {
                console.error('Errore durante il reset delle task giornaliere:', error);
                reject(error);
            }
        });
    }

    /**
     * Salva lo stato dell'applicazione in IndexedDB
     * @param {string} key - Chiave dello stato
     * @param {*} value - Valore da salvare
     * @returns {Promise<void>} Promise che si risolve quando il salvataggio è completato
     */
    async saveAppState(key, value) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['app_state'], 'readwrite');
                const store = transaction.objectStore('app_state');
                const request = store.get(key);

                request.onsuccess = (event) => {
                    let stateData = {
                        key: key,
                        value: value,
                        updated_at: new Date().toISOString()
                    };

                    // Se l'elemento esiste già, aggiorniamo il suo valore
                    if (event.target.result) {
                        stateData = { ...event.target.result, ...stateData };
                    }

                    const updateRequest = store.put(stateData);

                    updateRequest.onsuccess = () => {
                        console.log(`Stato dell'app salvato: ${key}`, value);
                        resolve();
                    };

                    updateRequest.onerror = (error) => {
                        console.error(`Errore durante il salvataggio dello stato dell'app: ${key}`, error);
                        reject(error);
                    };
                };

                request.onerror = (error) => {
                    console.error(`Errore durante il recupero dello stato dell'app: ${key}`, error);
                    reject(error);
                };
            } catch (error) {
                console.error(`Errore durante l'operazione su IndexedDB: ${key}`, error);
                reject(error);
            }
        });
    }

    /**
     * Recupera lo stato dell'applicazione da IndexedDB
     * @param {string} key - Chiave dello stato
     * @returns {Promise<*>} Promise che si risolve con il valore dello stato
     */
    async getAppState(key) {
        await this.initDB();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['app_state'], 'readonly');
                const store = transaction.objectStore('app_state');
                const request = store.get(key);

                request.onsuccess = (event) => {
                    const result = event.target.result;
                    console.log(`Stato dell'app recuperato: ${key}`, result);

                    // Se l'elemento esiste, restituisci il suo valore
                    if (result) {
                        resolve(result.value);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = (error) => {
                    console.error(`Errore durante il recupero dello stato dell'app: ${key}`, error);
                    reject(error);
                };
            } catch (error) {
                console.error(`Errore durante l'operazione su IndexedDB: ${key}`, error);
                reject(error);
            }
        });
    }

    /**
     * Salva l'ultimo progetto selezionato in IndexedDB
     * @param {Object} projectData - Dati del progetto
     * @returns {Promise<void>} Promise che si risolve quando il salvataggio è completato
     */
    async saveLastSelectedProject(projectData) {
        // Salva sia in localStorage (per compatibilità) che in IndexedDB (per persistenza)
        try {
            localStorage.setItem('lastSelectedProject', JSON.stringify(projectData));
            await this.saveAppState('lastSelectedProject', projectData);
            console.log('Ultimo progetto selezionato salvato in localStorage e IndexedDB:', projectData);
        } catch (error) {
            console.error('Errore durante il salvataggio dell\'ultimo progetto selezionato:', error);
            throw error;
        }
    }

    /**
     * Recupera l'ultimo progetto selezionato da IndexedDB o localStorage
     * @returns {Promise<Object|null>} Promise che si risolve con i dati del progetto
     */
    async getLastSelectedProject() {
        try {
            // Prima prova da localStorage per velocità
            const localData = localStorage.getItem('lastSelectedProject');
            if (localData) {
                try {
                    const parsedData = JSON.parse(localData);
                    console.log('Ultimo progetto selezionato recuperato da localStorage:', parsedData);
                    return parsedData;
                } catch (e) {
                    console.warn('Errore nel parsing dei dati in localStorage:', e);
                }
            }

            // Se non c'è nulla in localStorage o c'è un errore, prova da IndexedDB
            const dbData = await this.getAppState('lastSelectedProject');
            console.log('Ultimo progetto selezionato recuperato da IndexedDB:', dbData);

            // Se c'è un dato valido in IndexedDB, sincronizzalo con localStorage
            if (dbData) {
                localStorage.setItem('lastSelectedProject', JSON.stringify(dbData));
            }

            return dbData;
        } catch (error) {
            console.error('Errore durante il recupero dell\'ultimo progetto selezionato:', error);
            return null;
        }
    }
}

// Crea l'istanza del servizio
const databaseService = new DatabaseService();

// Esporta il servizio per l'uso in altri moduli
export default databaseService; 