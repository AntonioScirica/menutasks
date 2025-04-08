/**
 * Assegna un'app tracciata a una task
 * @param {number|string} taskId - ID della task
 * @param {string} appName - Nome dell'app da tracciare
 */
function assignAppToTask(taskId, appName) {
    if (!window.appTimerTracker) {
        console.error('taskService: appTimerTracker non disponibile');
        return;
    }

    // Avvia il timer per l'app da zero
    window.appTimerTracker.setAppForTask(taskId, appName);
    console.log(`taskService: App "${appName}" associata alla task ${taskId}`);
}

/**
 * Aggiunge o aggiorna una task con app tracciata
 * @param {Object} taskData - Dati della task
 * @param {number|string|null} taskId - ID della task (null per creazione)
 */
async function saveTaskWithTrackedApp(taskData, taskId = null) {
    try {
        // Salva la task nel database
        let savedTask;

        if (taskId) {
            // Aggiornamento
            savedTask = await databaseService.updateTask(taskId, taskData);
        } else {
            // Creazione
            savedTask = await databaseService.addTask(taskData);
        }

        // Se la task ha un'app tracciata, avvia il timer
        if (savedTask && taskData.trackedApp && taskData.trackedApp.name) {
            assignAppToTask(savedTask.id, taskData.trackedApp.name);
        }

        return savedTask;
    } catch (error) {
        console.error('Errore durante il salvataggio della task con app tracciata:', error);
        throw error;
    }
}

// Rendi la funzione disponibile globalmente
window.saveTaskWithTrackedApp = saveTaskWithTrackedApp; 