/**
 * DatabaseService - Gestisce l'interfacciamento con IndexedDB e Supabase
 * Fornisce un'API unificata per la gestione dei dati dell'applicazione
 */
class DatabaseService {
    constructor() {
        this.db = null;
        this.supabase = null;
        this.isInitialized = false;
        this.syncInProgress = false;
        this.dbName = 'taskManagerDB';
        this.dbVersion = 1;
        this.lastSync = null;
    }

    /**
     * Inizializza il database e la connessione a Supabase
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('DatabaseService: Inizializzazione...');

        if (this.isInitialized) {
            console.log('DatabaseService: Già inizializzato');
            return;
        }

        try {
            // Inizializza IndexedDB
            await this.initIndexedDB();

            // Inizializza Supabase se disponibile
            await this.initSupabase();

            this.isInitialized = true;
            console.log('DatabaseService: Inizializzazione completata');

            // Sincronizza i dati con Supabase se disponibile
            if (this.supabase) {
                this.syncWithSupabase();
            }
        } catch (error) {
            console.error('DatabaseService: Errore durante l\'inizializzazione', error);
            throw error;
        }
    }

    /**
     * Inizializza IndexedDB
     * @returns {Promise<void>}
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('DatabaseService: Errore apertura IndexedDB', event);
                reject(new Error('Impossibile aprire IndexedDB'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('DatabaseService: IndexedDB aperto con successo');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('DatabaseService: Creazione/aggiornamento schema IndexedDB');
                const db = event.target.result;

                // Crea object store per i progetti se non esiste
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectsStore.createIndex('name', 'name', { unique: false });
                    projectsStore.createIndex('created_at', 'created_at', { unique: false });
                }

                // Crea object store per i task se non esiste
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    tasksStore.createIndex('project_id', 'project_id', { unique: false });
                    tasksStore.createIndex('completed', 'completed', { unique: false });
                    tasksStore.createIndex('created_at', 'created_at', { unique: false });
                    tasksStore.createIndex('position', 'position', { unique: false });
                }

                // Crea object store per lo stato dell'app se non esiste
                if (!db.objectStoreNames.contains('appState')) {
                    db.createObjectStore('appState', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Inizializza la connessione a Supabase
     * @returns {Promise<void>}
     */
    async initSupabase() {
        // Verifica se Supabase è disponibile nell'ambiente
        if (typeof supabaseClient !== 'undefined') {
            try {
                const { SUPABASE_URL, SUPABASE_KEY } = await this.getSupabaseCredentials();

                if (SUPABASE_URL && SUPABASE_KEY) {
                    this.supabase = supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('DatabaseService: Supabase inizializzato');

                    // Carica l'ultima sincronizzazione
                    const syncData = await this.getAppState('lastSync');
                    if (syncData) {
                        this.lastSync = new Date(syncData.value);
                        console.log(`DatabaseService: Ultima sincronizzazione: ${this.lastSync}`);
                    }
                } else {
                    console.log('DatabaseService: Credenziali Supabase non disponibili');
                }
            } catch (error) {
                console.error('DatabaseService: Errore inizializzazione Supabase', error);
                // Continuiamo con solo IndexedDB
            }
        } else {
            console.log('DatabaseService: Supabase non disponibile, utilizzo solo IndexedDB');
        }
    }

    /**
     * Ottiene le credenziali per Supabase
     * @returns {Promise<{SUPABASE_URL: string, SUPABASE_KEY: string}>}
     */
    async getSupabaseCredentials() {
        // Prova a caricare le credenziali dallo storage
        const credentials = await this.getAppState('supabaseCredentials');

        if (credentials) {
            return credentials.value;
        }

        // Credenziali predefinite (vuote)
        return {
            SUPABASE_URL: '',
            SUPABASE_KEY: ''
        };
    }

    /**
     * Salva le credenziali di Supabase
     * @param {string} url - URL di Supabase
     * @param {string} key - Chiave API di Supabase
     * @returns {Promise<void>}
     */
    async saveSupabaseCredentials(url, key) {
        await this.saveAppState('supabaseCredentials', { SUPABASE_URL: url, SUPABASE_KEY: key });

        // Reinizializza Supabase con le nuove credenziali
        await this.initSupabase();
    }

    /**
     * Sincronizza i dati con Supabase
     * @returns {Promise<void>}
     */
    async syncWithSupabase() {
        if (!this.supabase || this.syncInProgress) {
            return;
        }

        try {
            this.syncInProgress = true;
            console.log('DatabaseService: Sincronizzazione con Supabase in corso...');

            // Ottieni tutti i dati locali
            const projects = await this.getAllProjects();
            const tasks = await this.getAllTasks();

            // Sincronizza i progetti
            await this.syncProjects(projects);

            // Sincronizza i task
            await this.syncTasks(tasks);

            // Aggiorna l'ultima sincronizzazione
            this.lastSync = new Date();
            await this.saveAppState('lastSync', this.lastSync);

            console.log('DatabaseService: Sincronizzazione completata');
        } catch (error) {
            console.error('DatabaseService: Errore durante la sincronizzazione', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sincronizza i progetti con Supabase
     * @param {Array} localProjects - Progetti locali
     * @returns {Promise<void>}
     */
    async syncProjects(localProjects) {
        if (!this.supabase) return;

        try {
            // Ottieni i progetti da Supabase
            const { data: remoteProjects, error } = await this.supabase
                .from('projects')
                .select('*');

            if (error) throw error;

            // Mappa per controllo rapido
            const remoteProjectsMap = {};
            remoteProjects.forEach(project => {
                remoteProjectsMap[project.id] = project;
            });

            // Sincronizza progetti locali verso il cloud
            for (const localProject of localProjects) {
                if (remoteProjectsMap[localProject.id]) {
                    // Aggiorna progetto esistente se più recente
                    const remoteProject = remoteProjectsMap[localProject.id];
                    if (new Date(localProject.updated_at) > new Date(remoteProject.updated_at)) {
                        await this.supabase
                            .from('projects')
                            .update(localProject)
                            .eq('id', localProject.id);
                    }
                } else {
                    // Inserisci nuovo progetto
                    await this.supabase
                        .from('projects')
                        .insert(localProject);
                }
            }

            // Sincronizza progetti cloud verso locale
            for (const remoteProject of remoteProjects) {
                const localProject = localProjects.find(p => p.id === remoteProject.id);

                if (!localProject) {
                    // Progetto nuovo da remoto
                    await this.addProject(remoteProject);
                } else if (new Date(remoteProject.updated_at) > new Date(localProject.updated_at)) {
                    // Aggiorna progetto locale se remoto più recente
                    await this.updateProject(remoteProject.id, remoteProject);
                }
            }
        } catch (error) {
            console.error('DatabaseService: Errore sincronizzazione progetti', error);
        }
    }

    /**
     * Sincronizza i task con Supabase
     * @param {Array} localTasks - Task locali
     * @returns {Promise<void>}
     */
    async syncTasks(localTasks) {
        if (!this.supabase) return;

        try {
            // Ottieni i task da Supabase
            const { data: remoteTasks, error } = await this.supabase
                .from('tasks')
                .select('*');

            if (error) throw error;

            // Mappa per controllo rapido
            const remoteTasksMap = {};
            remoteTasks.forEach(task => {
                remoteTasksMap[task.id] = task;
            });

            // Sincronizza task locali verso il cloud
            for (const localTask of localTasks) {
                if (remoteTasksMap[localTask.id]) {
                    // Aggiorna task esistente se più recente
                    const remoteTask = remoteTasksMap[localTask.id];
                    if (new Date(localTask.updated_at) > new Date(remoteTask.updated_at)) {
                        await this.supabase
                            .from('tasks')
                            .update(localTask)
                            .eq('id', localTask.id);
                    }
                } else {
                    // Inserisci nuovo task
                    await this.supabase
                        .from('tasks')
                        .insert(localTask);
                }
            }

            // Sincronizza task cloud verso locale
            for (const remoteTask of remoteTasks) {
                const localTask = localTasks.find(t => t.id === remoteTask.id);

                if (!localTask) {
                    // Task nuovo da remoto
                    await this.addTask(remoteTask);
                } else if (new Date(remoteTask.updated_at) > new Date(localTask.updated_at)) {
                    // Aggiorna task locale se remoto più recente
                    await this.updateTask(remoteTask.id, remoteTask);
                }
            }
        } catch (error) {
            console.error('DatabaseService: Errore sincronizzazione task', error);
        }
    }

    /**
     * Esegue una transazione su IndexedDB
     * @param {string} storeName - Nome dello store
     * @param {string} mode - Modalità ('readonly' o 'readwrite')
     * @param {Function} callback - Funzione da eseguire nella transazione
     * @returns {Promise<any>} - Risultato della transazione
     */
    async dbTransaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database non inizializzato'));
                return;
            }

            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);

            callback(store, resolve, reject);
        });
    }

    // =====================================================================
    // PROGETTI
    // =====================================================================

    /**
     * Ottiene tutti i progetti dal database
     * @returns {Promise<Array>} - Lista dei progetti
     */
    async getAllProjects() {
        return new Promise((resolve, reject) => {
            this.dbTransaction('projects', 'readonly', (store, _, reject) => {
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Ottiene un progetto specifico dal database
     * @param {number|string} id - ID del progetto
     * @returns {Promise<Object>} - Progetto
     */
    async getProject(id) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('projects', 'readonly', (store, _, reject) => {
                const request = store.get(Number(id));

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Aggiunge un nuovo progetto
     * @param {Object} project - Dati del progetto
     * @returns {Promise<Object>} - Progetto aggiunto con ID generato
     */
    async addProject(project) {
        const now = new Date();
        const newProject = {
            ...project,
            created_at: project.created_at || now.getTime(),
            updated_at: now.getTime()
        };

        return new Promise((resolve, reject) => {
            this.dbTransaction('projects', 'readwrite', (store, _, reject) => {
                const request = store.add(newProject);

                request.onsuccess = () => {
                    // Recupera il progetto con l'ID generato
                    const getRequest = store.get(request.result);
                    getRequest.onsuccess = () => resolve(getRequest.result);
                };

                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Aggiorna un progetto esistente
     * @param {number|string} id - ID del progetto
     * @param {Object} projectData - Dati aggiornati
     * @returns {Promise<Object>} - Progetto aggiornato
     */
    async updateProject(id, projectData) {
        // Ottieni il progetto esistente
        const existingProject = await this.getProject(Number(id));

        if (!existingProject) {
            throw new Error(`Progetto con ID ${id} non trovato`);
        }

        // Aggiorna il progetto
        const updatedProject = {
            ...existingProject,
            ...projectData,
            id: existingProject.id, // Mantieni l'ID originale
            updated_at: new Date().getTime()
        };

        return new Promise((resolve, reject) => {
            this.dbTransaction('projects', 'readwrite', (store, _, reject) => {
                const request = store.put(updatedProject);

                request.onsuccess = () => resolve(updatedProject);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Elimina un progetto e tutti i suoi task
     * @param {number|string} id - ID del progetto
     * @returns {Promise<void>}
     */
    async deleteProject(id) {
        const numericId = Number(id);

        // Elimina il progetto
        await new Promise((resolve, reject) => {
            this.dbTransaction('projects', 'readwrite', (store, _, reject) => {
                const request = store.delete(numericId);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        });

        // Elimina tutti i task associati al progetto
        const tasks = await this.getTasksByProject(numericId);

        for (const task of tasks) {
            await this.deleteTask(task.id);
        }
    }

    // =====================================================================
    // TASK
    // =====================================================================

    /**
     * Ottiene tutti i task dal database
     * @returns {Promise<Array>} - Lista dei task
     */
    async getAllTasks() {
        return new Promise((resolve, reject) => {
            this.dbTransaction('tasks', 'readonly', (store, _, reject) => {
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Ottiene un task specifico dal database
     * @param {number|string} id - ID del task
     * @returns {Promise<Object>} - Task
     */
    async getTask(id) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('tasks', 'readonly', (store, _, reject) => {
                const request = store.get(Number(id));

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Ottiene tutti i task di un progetto
     * @param {number|string} projectId - ID del progetto
     * @returns {Promise<Array>} - Lista dei task del progetto
     */
    async getTasksByProject(projectId) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('tasks', 'readonly', (store, _, reject) => {
                const index = store.index('project_id');
                const request = index.getAll(Number(projectId));

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Crea un nuovo task (alias per addTask per compatibilità)
     * @param {Object} task - Dati del task
     * @returns {Promise<Object>} - Task aggiunto con ID generato
     */
    async createTask(task) {
        console.log('DatabaseService: createTask chiamato con task completa:', JSON.stringify(task));

        // Verifica esplicita del campo assigned_to
        if (task.assigned_to !== undefined) {
            console.log('Campo assigned_to presente:', task.assigned_to);
            console.log('Tipo del campo assigned_to:', typeof task.assigned_to);
        } else {
            console.log('Campo assigned_to NON presente nella task');
        }

        return this.addTask(task);
    }

    /**
     * Aggiunge un nuovo task
     * @param {Object} task - Dati del task
     * @returns {Promise<Object>} - Task aggiunto con ID generato
     */
    async addTask(task) {
        console.log('DatabaseService: addTask chiamato con:', JSON.stringify(task));

        // Verifica il campo assigned_to anche qui
        if (task.assigned_to !== undefined) {
            console.log('addTask: Campo assigned_to presente:', task.assigned_to);
        } else {
            console.log('addTask: Campo assigned_to NON presente nella task');
        }

        const now = new Date();
        const newTask = {
            ...task,
            created_at: task.created_at || now.getTime(),
            updated_at: now.getTime()
        };

        // Verifica che il campo sia stato copiato correttamente in newTask
        if (newTask.assigned_to !== undefined) {
            console.log('newTask: Campo assigned_to presente dopo la copia:', newTask.assigned_to);
        } else {
            console.log('newTask: Campo assigned_to NON presente dopo la copia');
        }

        // Calcola la posizione se non specificata
        if (!newTask.position) {
            const tasks = await this.getTasksByProject(newTask.project_id);
            newTask.position = tasks.length > 0 ?
                Math.max(...tasks.map(t => t.position || 0)) + 1 : 0;
        }

        return new Promise((resolve, reject) => {
            this.dbTransaction('tasks', 'readwrite', (store, _, reject) => {
                const request = store.add(newTask);

                request.onsuccess = () => {
                    // Recupera il task con l'ID generato
                    const getRequest = store.get(request.result);
                    getRequest.onsuccess = () => {
                        const savedTask = getRequest.result;
                        console.log('Task salvata nel database:', JSON.stringify(savedTask));
                        resolve(savedTask);
                    };
                };

                request.onerror = (event) => {
                    console.error('Errore durante il salvataggio della task:', event.target.error);
                    reject(event.target.error);
                };
            });
        });
    }

    /**
     * Aggiorna un task esistente
     * @param {number|string} id - ID del task
     * @param {Object} taskData - Dati aggiornati
     * @returns {Promise<Object>} - Task aggiornato
     */
    async updateTask(id, taskData) {
        try {
            console.log(`DatabaseService: Aggiornamento task ${id}`, taskData);

            // Normalizza l'ID in formato numerico
            const numericId = Number(id);

            // Ottieni il task esistente
            const existingTask = await this.getTask(numericId);

            if (!existingTask) {
                const error = new Error(`Task con ID ${id} non trovato`);
                console.error('DatabaseService: updateTask fallito -', error.message);
                throw error;
            }

            // Validazioni sui campi prima dell'aggiornamento
            if (taskData.parent_id !== undefined) {
                if (taskData.parent_id === numericId) {
                    const error = new Error('Un task non può essere parent di se stesso');
                    console.error('DatabaseService: updateTask fallito -', error.message);
                    throw error;
                }

                // Se stiamo impostando un parent_id, verifichiamo che il parent esista
                if (taskData.parent_id !== null) {
                    const parentTask = await this.getTask(Number(taskData.parent_id));
                    if (!parentTask) {
                        const error = new Error(`Task parent con ID ${taskData.parent_id} non trovato`);
                        console.error('DatabaseService: updateTask fallito -', error.message);
                        throw error;
                    }
                }
            }

            // Aggiorna il task
            const updatedTask = {
                ...existingTask,
                ...taskData,
                id: existingTask.id, // Mantieni l'ID originale
                updated_at: new Date().getTime()
            };

            return new Promise((resolve, reject) => {
                this.dbTransaction('tasks', 'readwrite', (store, _, reject) => {
                    const request = store.put(updatedTask);

                    request.onsuccess = () => {
                        console.log(`DatabaseService: Task ${id} aggiornato con successo`);
                        resolve(updatedTask);
                    };

                    request.onerror = (event) => {
                        const error = event.target.error;
                        console.error(`DatabaseService: Errore durante l'aggiornamento del task ${id}`, error);
                        reject(error);
                    };
                });
            });
        } catch (error) {
            console.error(`DatabaseService: Errore durante l'aggiornamento del task ${id}:`, error);
            throw error;
        }
    }

    /**
     * Elimina un task
     * @param {number|string} id - ID del task
     * @returns {Promise<void>}
     */
    async deleteTask(id) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('tasks', 'readwrite', (store, _, reject) => {
                const request = store.delete(Number(id));

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Aggiorna lo stato di completamento di un task
     * @param {number|string} id - ID del task
     * @param {boolean} completed - Stato di completamento
     * @returns {Promise<Object>} - Task aggiornato
     */
    async toggleTaskCompletion(id, completed) {
        return this.updateTask(id, { completed });
    }

    /**
     * Aggiorna la priorità di un task
     * @param {number|string} id - ID del task
     * @param {string} priority - Priorità ('urgent', 'medium', 'normal')
     * @returns {Promise<Object>} - Task aggiornato
     */
    async updateTaskPriority(id, priority) {
        return this.updateTask(id, { priority });
    }

    /**
     * Aggiorna la posizione di un task
     * @param {number|string} id - ID del task
     * @param {number} position - Nuova posizione
     * @returns {Promise<Object>} - Task aggiornato
     */
    async updateTaskPosition(id, position) {
        return this.updateTask(id, { position });
    }

    /**
     * Ripristina lo stato dei task giornalieri
     * @returns {Promise<void>}
     */
    async resetDailyTasks() {
        const allTasks = await this.getAllTasks();
        const dailyTasks = allTasks.filter(task => task.is_daily);

        for (const task of dailyTasks) {
            // Ripristina solo se è completato
            if (task.completed) {
                await this.updateTask(task.id, {
                    completed: false,
                    completed_at: null
                });
            }
        }
    }

    // =====================================================================
    // STATO DELL'APP
    // =====================================================================

    /**
     * Ottiene un valore dallo stato dell'app
     * @param {string} key - Chiave dello stato
     * @returns {Promise<Object>} - Valore dello stato
     */
    async getAppState(key) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('appState', 'readonly', (store, _, reject) => {
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Salva un valore nello stato dell'app
     * @param {string} key - Chiave dello stato
     * @param {any} value - Valore da salvare
     * @returns {Promise<void>}
     */
    async saveAppState(key, value) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('appState', 'readwrite', (store, _, reject) => {
                const request = store.put({ key, value });

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Elimina un valore dallo stato dell'app
     * @param {string} key - Chiave dello stato da eliminare
     * @returns {Promise<void>}
     */
    async deleteAppState(key) {
        return new Promise((resolve, reject) => {
            this.dbTransaction('appState', 'readwrite', (store, _, reject) => {
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    /**
     * Salva l'ultimo progetto selezionato
     * @param {Object} projectData - Dati del progetto
     * @returns {Promise<void>}
     */
    async saveLastSelectedProject(projectData) {
        return this.saveAppState('lastSelectedProject', projectData);
    }

    /**
     * Ottiene l'ultimo progetto selezionato
     * @returns {Promise<Object>} - Ultimo progetto selezionato
     */
    async getLastSelectedProject() {
        const data = await this.getAppState('lastSelectedProject');
        return data ? data.value : null;
    }
}

// Esporta un'istanza singleton del servizio
const databaseService = new DatabaseService();
export default databaseService; 