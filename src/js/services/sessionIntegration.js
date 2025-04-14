/**
 * sessionIntegration.js
 * Modulo per integrare SessionManager con il sistema esistente
 */

const SessionManager = require('./SessionManager');
const { databaseService } = require('./DatabaseService');

let sessionManager = null;
let lastActiveApp = null;
let isChecking = false;

/**
 * Inizializza il gestore delle sessioni
 * @returns {SessionManager} Istanza di SessionManager
 */
async function initSessionManager() {
    if (sessionManager) return sessionManager;

    await databaseService.initialize(); // Usa sia Supabase che IndexedDB
    const supabase = databaseService.supabase;

    if (!supabase) {
        throw new Error('Supabase non disponibile');
    }

    sessionManager = new SessionManager(supabase);
    setupIntegration();

    return sessionManager;
}

/**
 * Configura l'integrazione con il sistema esistente
 */
function setupIntegration() {
    if (window.electronAPI?.getForegroundApp) {
        const checkInterval = setInterval(async () => {
            if (isChecking) return;

            try {
                isChecking = true;
                const foregroundApp = await window.electronAPI.getForegroundApp();

                if (foregroundApp && foregroundApp !== lastActiveApp) {
                    console.log(`App in primo piano cambiata: ${foregroundApp}`);

                    const associatedTaskId = await findTaskIdForApp(foregroundApp);

                    if (associatedTaskId) {
                        sessionManager?.startSession(foregroundApp, associatedTaskId);
                    } else if (sessionManager?.getCurrentSession()) {
                        sessionManager.endSession();
                    }

                    lastActiveApp = foregroundApp;
                }
            } catch (error) {
                console.error('Errore nel monitoraggio app in primo piano:', error);
            } finally {
                isChecking = false;
            }
        }, 1000);

        window.addEventListener('beforeunload', () => {
            clearInterval(checkInterval);
        });
    }

    if (typeof window.activeTimers !== 'undefined') {
        const originalStartTaskTimer = window.startTaskTimer;
        if (typeof originalStartTaskTimer === 'function') {
            window.startTaskTimer = async function (taskId, initialSecondsValue) {
                originalStartTaskTimer(taskId, initialSecondsValue);

                const appName = await getAppForTask(taskId);
                if (appName) {
                    sessionManager?.startSession(appName, taskId);
                }
            };
        }

        const originalStopTaskTimer = window.stopTaskTimer;
        if (typeof originalStopTaskTimer === 'function') {
            window.stopTaskTimer = function (taskId) {
                originalStopTaskTimer(taskId);
                const currentSession = sessionManager?.getCurrentSession();
                if (currentSession?.taskId === taskId) {
                    sessionManager.endSession();
                }
            };
        }
    }

    window.addEventListener('beforeunload', () => {
        sessionManager?.flushToDisk();
    });
}

/**
 * Trova l'ID della task associata a un'app
 * @param {string} appName - Nome dell'applicazione
 * @returns {string|null} ID della task o null
 */
async function findTaskIdForApp(appName) {
    try {
        const supabase = databaseService.supabase;
        if (!supabase) return null;

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

        return matchingTask?.id || null;
    } catch (error) {
        console.error('Errore nella ricerca della task per app:', error);
        return null;
    }
}

/**
 * Ottiene l'app associata a una task
 * @param {string} taskId - ID della task
 * @returns {string|null}
 */
async function getAppForTask(taskId) {
    try {
        const supabase = databaseService.supabase;
        if (!supabase) return null;

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
 */
function getSessionManager() {
    return sessionManager;
}

// Debug e accesso globale in contesto browser
if (typeof window !== 'undefined') {
    window.sessionManager = {
        init: initSessionManager,
        get: getSessionManager,
        listSessions: () => sessionManager?.getAllSessions() || []
    };

    window.addEventListener('beforeunload', () => {
        sessionManager?.flushToDisk();
    });
}

module.exports = {
    initSessionManager,
    getSessionManager
};
