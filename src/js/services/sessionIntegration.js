/**
 * sessionIntegration.js
 * Modulo per integrare SessionManager con il sistema esistente
 */

const SessionManager = require('./SessionManager');
const { default: databaseService } = require('./DatabaseService.js');


// Integrazione con l'app esistente
let sessionManager = null;
let lastActiveApp = null;
let isChecking = false;
let supabase = null;

async function initSessionManager() {
    if (sessionManager) return sessionManager;

    await databaseService.initialize();
    supabase = databaseService.supabase;

    sessionManager = new SessionManager(supabase);
    setupIntegration();

    return sessionManager;
}

async function findTaskIdForApp(appName) {
    if (!supabase) throw new Error('Supabase non inizializzato');

    const { data, error } = await supabase
        .from('tasks')
        .select('id, assigned_to')
        .eq('completed', false)
        .not('assigned_to', 'is', null);

    if (error) throw error;

    const normalizedAppName = normalizeAppName(appName);
    const matchingTask = data.find(task => {
        const taskApp = task.assigned_to ? normalizeAppName(task.assigned_to) : '';
        return taskApp.includes(normalizedAppName) || normalizedAppName.includes(taskApp);
    });

    return matchingTask ? matchingTask.id : null;
}


/**
 * Configura l'integrazione con il sistema esistente
 */
function setupIntegration() {
    // Monitora i cambi di app in primo piano
    if (window.electronAPI && typeof window.electronAPI.getForegroundApp === 'function') {
        // Polling periodico per l'app in primo piano
        const checkInterval = setInterval(async () => {
            // Se è già in corso un controllo, salta questo ciclo
            if (isChecking) return;

            try {
                isChecking = true; // Imposta il flag per prevenire chiamate sovrapposte

                const foregroundApp = await window.electronAPI.getForegroundApp();

                // Se è cambiata l'app in primo piano
                if (foregroundApp && foregroundApp !== lastActiveApp) {
                    console.log(`App in primo piano cambiata: ${foregroundApp}`);

                    // Se c'è una task associata a questa app
                    const associatedTaskId = await findTaskIdForApp(foregroundApp);

                    if (associatedTaskId) {
                        // Avvia una nuova sessione per questa app
                        if (sessionManager) {
                            sessionManager.startSession(foregroundApp, associatedTaskId);
                        }
                    } else {
                        // Se non c'è una task, chiudi la sessione corrente
                        if (sessionManager && sessionManager.getCurrentSession()) {
                            sessionManager.endSession();
                        }
                    }

                    lastActiveApp = foregroundApp;
                }
            } catch (error) {
                console.error('Errore nel monitoraggio app in primo piano:', error);
            } finally {
                isChecking = false; // Reimposta il flag indipendentemente dal risultato
            }
        }, 1000); // Controllo ogni secondo (anziché 3 secondi)

        // Pulizia al termine
        window.addEventListener('beforeunload', () => {
            clearInterval(checkInterval);
        });
    }

    // Intercetta eventi di task management
    if (typeof window.activeTimers !== 'undefined') {
        // Intercetta l'avvio dei timer
        const originalStartTaskTimer = window.startTaskTimer;
        if (typeof originalStartTaskTimer === 'function') {
            window.startTaskTimer = async function (taskId, initialSecondsValue) {
                // Chiamata originale
                originalStartTaskTimer(taskId, initialSecondsValue);

                // Ottieni l'app associata alla task
                const appName = await getAppForTask(taskId);

                // Se c'è un'app associata, avvia una sessione
                if (appName && sessionManager) {
                    sessionManager.startSession(appName, taskId);
                }
            };
        }

        // Intercetta lo stop dei timer
        const originalStopTaskTimer = window.stopTaskTimer;
        if (typeof originalStopTaskTimer === 'function') {
            window.stopTaskTimer = function (taskId) {
                // Chiamata originale
                originalStopTaskTimer(taskId);

                // Termina la sessione relativa a questa task
                if (sessionManager) {
                    const currentSession = sessionManager.getCurrentSession();
                    if (currentSession && currentSession.taskId === taskId) {
                        sessionManager.endSession();
                    }
                }
            };
        }
    }

    // Intercetta eventi di chiusura dell'app
    window.addEventListener('beforeunload', () => {
        if (sessionManager) {
            // Forza il salvataggio
            sessionManager.flushToDisk();
        }
    });
}

/**
 * Trova l'ID della task associata a un'app
 * @param {string} appName - Nome dell'applicazione
 * @returns {string|null} ID della task o null
 */
async function findTaskIdForApp(appName) {
    try {
        // Se c'è Supabase client disponibile globalmente
        if (typeof supabase !== 'undefined') {
            // Ottieni task non completate con app associata
            const { data, error } = await supabase
                .from('tasks')
                .select('id, assigned_to')
                .eq('completed', false)
                .not('assigned_to', 'is', null);

            if (error) throw error;

            // Cerca una corrispondenza case-insensitive
            const normalizedAppName = normalizeAppName(appName);
            const matchingTask = data.find(task => {
                const taskApp = task.assigned_to ? normalizeAppName(task.assigned_to) : '';
                return taskApp.includes(normalizedAppName) || normalizedAppName.includes(taskApp);
            });

            return matchingTask ? matchingTask.id : null;
        }
    } catch (error) {
        console.error('Errore nella ricerca della task per app:', error);
    }

    return null;
}

/**
 * Ottiene l'app associata a una task
 * @param {string} taskId - ID della task
 * @returns {string|null} Nome dell'app o null
 */
async function getAppForTask(taskId) {
    try {
        if (!supabase) {
            throw new Error('Supabase non inizializzato');
        }

        const { data, error } = await supabase
            .from('tasks')
            .select('assigned_to')
            .eq('id', taskId)
            .maybeSingle();

        if (error) throw error;

        return data?.assigned_to || null;

    } catch (error) {
        console.error(`Errore nell'ottenere l'app per task ${taskId}:`, error);
        return null;
    }
}


/**
 * Ottiene l'istanza di SessionManager
 * @returns {SessionManager|null} Istanza di SessionManager o null se non inizializzato
 */
function getSessionManager() {
    return sessionManager;
}

// Esponi funzioni globali per debug
if (typeof window !== 'undefined') {
    window.sessionManager = {
        init: initSessionManager,
        get: getSessionManager,
        listSessions: () => sessionManager ? sessionManager.getAllSessions() : []
    };

    // Eventi app e integrazioni
    window.addEventListener('beforeunload', () => {
        if (sessionManager) {
            sessionManager.flushToDisk();
        }
    });
}


module.exports = {
    initSessionManager,
    getSessionManager
}; 