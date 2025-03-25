/**
 * Servizio per gestire la sincronizzazione tra locale e remoto
 * 
 * Si occupa di sincronizzare i dati tra IndexedDB e Supabase
 * e gestire il comportamento offline
 */
class SyncService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingOperations = [];
        this.syncInterval = null;
        this.initialized = false;
    }

    /**
     * Inizializza il servizio
     */
    initialize() {
        if (this.initialized) return;

        // Ascolta gli eventi di connessione
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Avvia il controllo periodico
        this.startPeriodicSync();

        this.initialized = true;
        console.log('SyncService inizializzato');
    }

    /**
     * Gestisce un cambio dello stato di connessione
     * @param {boolean} isOnline - true se online, false se offline
     */
    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        console.log(`Connessione: ${isOnline ? 'Online' : 'Offline'}`);

        if (isOnline) {
            // Se torniamo online, sincronizziamo subito
            this.synchronize();
        }
    }

    /**
     * Avvia la sincronizzazione periodica
     */
    startPeriodicSync() {
        // Ferma eventuali intervalli esistenti
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Sincronizza ogni 2 minuti
        this.syncInterval = setInterval(() => {
            if (this.isOnline) {
                this.synchronize();
            }
        }, 120000); // 2 minuti
    }

    /**
     * Sincronizza i dati locali con Supabase
     * @returns {Promise<void>}
     */
    async synchronize() {
        if (!this.isOnline) {
            console.log('Non posso sincronizzare: offline');
            return;
        }

        console.log('Avvio sincronizzazione...');

        try {
            // 1. Sincronizza i timer salvati localmente
            await this.syncTimers();

            // 2. Esegui tutte le operazioni in sospeso
            await this.processPendingOperations();

            console.log('Sincronizzazione completata con successo');
        } catch (error) {
            console.error('Errore durante la sincronizzazione:', error);
        }
    }

    /**
     * Sincronizza i timer salvati in locale con Supabase
     * @returns {Promise<void>}
     */
    async syncTimers() {
        console.log('Sincronizzazione timer...');

        // TODO: Implementare la sincronizzazione dei timer
        // Per ora, salviamo solo i timer attivi
        await timerService.saveAllTimers();
    }

    /**
     * Processa le operazioni in sospeso
     * @returns {Promise<void>}
     */
    async processPendingOperations() {
        if (this.pendingOperations.length === 0) {
            console.log('Nessuna operazione in sospeso');
            return;
        }

        console.log(`Processando ${this.pendingOperations.length} operazioni in sospeso...`);

        // Creiamo una copia delle operazioni per evitare problemi in caso di errori
        const operations = [...this.pendingOperations];

        // Svuotiamo la lista
        this.pendingOperations = [];

        // Proviamo ad eseguire ogni operazione
        for (const operation of operations) {
            try {
                await this.executeOperation(operation);
                console.log(`Operazione ${operation.id} completata con successo`);
            } catch (error) {
                console.error(`Errore nell'operazione ${operation.id}:`, error);
                // Rimettiamo l'operazione nella lista
                this.pendingOperations.push(operation);
            }
        }
    }

    /**
     * Esegue un'operazione
     * @param {Object} operation - Operazione da eseguire
     * @returns {Promise<void>}
     */
    async executeOperation(operation) {
        const { type, data } = operation;

        switch (type) {
            case 'create_task':
                await databaseService.createTask(data);
                break;

            case 'update_task':
                await databaseService.updateTask(data.id, data.updateData);
                break;

            case 'delete_task':
                await databaseService.deleteTask(data.id);
                break;

            case 'create_project':
                await databaseService.createProject(data.name);
                break;

            case 'delete_project':
                await databaseService.deleteProject(data.id);
                break;

            default:
                console.warn(`Tipo di operazione sconosciuto: ${type}`);
        }
    }

    /**
     * Aggiunge un'operazione alla lista delle operazioni in sospeso
     * @param {string} type - Tipo di operazione
     * @param {Object} data - Dati dell'operazione
     */
    addPendingOperation(type, data) {
        const operation = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type,
            data,
            timestamp: Date.now()
        };

        this.pendingOperations.push(operation);
        console.log(`Operazione ${operation.id} aggiunta alla lista delle operazioni in sospeso`);

        // Se siamo online, proviamo a sincronizzare subito
        if (this.isOnline) {
            setTimeout(() => this.synchronize(), 100);
        }
    }

    /**
     * Esegue un'operazione con fallback offline
     * @param {string} type - Tipo di operazione
     * @param {Object} data - Dati dell'operazione
     * @param {Function} onlineOperation - Funzione da eseguire se online
     * @returns {Promise<any>} - Risultato dell'operazione
     */
    async executeWithOfflineFallback(type, data, onlineOperation) {
        try {
            if (this.isOnline) {
                // Se siamo online, eseguiamo l'operazione normalmente
                return await onlineOperation();
            } else {
                // Se siamo offline, aggiungiamo l'operazione alla lista
                this.addPendingOperation(type, data);
                return { offline: true, message: 'Operazione aggiunta alla lista delle operazioni in sospeso' };
            }
        } catch (error) {
            console.error(`Errore nell'esecuzione dell'operazione ${type}:`, error);

            // Se c'è un errore (es. timeout), aggiungiamo l'operazione alla lista
            this.addPendingOperation(type, data);

            throw error;
        }
    }
}

// Istanza singleton del servizio
const syncService = new SyncService(); 