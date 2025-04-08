/**
 * Utility per aggiornare forzatamente la colonna tracked_app in Supabase
 */

// Configurazione Supabase
const SUPABASE_URL = 'https://lrchdpuvgitjzoeqeirj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyY2hkcHV2Z2l0anpvZXFlaXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMzgxMjgsImV4cCI6MjA1NzgxNDEyOH0.fnfrPJYDGjKYNouCVEzfxMnF0N-AWmYtX0V8G_bOa58';

/**
 * Aggiorna direttamente la colonna tracked_app di una task
 * @param {number|string} taskId - ID della task da aggiornare
 * @param {string} appName - Nome dell'app da tracciare
 * @returns {Promise<Object>} - Task aggiornata
 */
function forceUpdateTrackedApp(taskId, appName) {
    // Log delle informazioni per debug
    console.log(`Tentativo di aggiornamento forzato della task ${taskId} con app ${appName}`);

    // Prima verifica se la task esiste
    return fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
        headers: {
            'apikey': SUPABASE_KEY
        }
    })
        .then(response => response.json())
        .then(tasks => {
            if (!tasks || tasks.length === 0) {
                throw new Error(`Task con ID ${taskId} non trovata`);
            }

            console.log('Task trovata:', tasks[0]);
            console.log('Valore tracked_app attuale:', tasks[0].tracked_app);

            // Esegui l'aggiornamento diretto
            return fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ tracked_app: appName })
            });
        })
        .then(response => {
            console.log('Risposta aggiornamento:', response.status);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }

            // Verifica che l'aggiornamento sia stato applicato
            return fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
                headers: {
                    'apikey': SUPABASE_KEY
                }
            });
        })
        .then(response => response.json())
        .then(tasks => {
            if (!tasks || tasks.length === 0) {
                throw new Error('Task non trovata dopo l\'aggiornamento');
            }

            const updatedTask = tasks[0];
            console.log('Task aggiornata:', updatedTask);
            console.log('Nuovo valore tracked_app:', updatedTask.tracked_app);

            // Verifica se l'aggiornamento ha avuto effetto
            if (updatedTask.tracked_app !== appName) {
                console.warn(`ATTENZIONE: L'aggiornamento non sembra essere stato applicato!`);
                console.warn(`Atteso: ${appName}, Attuale: ${updatedTask.tracked_app}`);

                // Tentativo alternativo con SQL diretto (se supportato)
                if (window.supabase && window.supabase.rpc) {
                    console.log('Tentativo con RPC...');
                    return window.supabase.rpc('update_tracked_app_direct', {
                        task_id: taskId,
                        app_name: appName
                    }).then(() => {
                        console.log('RPC eseguita, verifico il risultato...');
                        return fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
                            headers: {
                                'apikey': SUPABASE_KEY
                            }
                        }).then(r => r.json());
                    });
                } else {
                    return updatedTask;
                }
            } else {
                console.log('✅ Aggiornamento verificato con successo!');
                return updatedTask;
            }
        })
        .catch(error => {
            console.error('Errore durante l\'aggiornamento:', error);
            throw error;
        });
}

// Esponi la funzione globalmente
window.forceUpdateTrackedApp = forceUpdateTrackedApp;

// Funzione di test accessibile dalla console
function testUpdate(taskId, appName) {
    if (!taskId) {
        console.error('Specifica un ID task valido');
        return;
    }

    if (!appName) {
        console.error('Specifica un nome app valido');
        return;
    }

    return forceUpdateTrackedApp(taskId, appName)
        .then(result => {
            console.log('Test completato:', result);
            console.log(`%c Aggiornamento task ${taskId} con app ${appName}:`, 'background: #4CAF50; color: white; padding: 2px 5px;');
            console.log(`%c Risultato: ${result.tracked_app === appName ? 'SUCCESSO' : 'FALLIMENTO'}`,
                `background: ${result.tracked_app === appName ? '#4CAF50' : '#F44336'}; color: white; padding: 2px 5px;`);
            return result;
        })
        .catch(error => {
            console.error('Test fallito:', error);
            return null;
        });
}

// Esponi anche la funzione di test
window.testUpdateTrackedApp = testUpdate;

// Istruzioni per la console
console.log('%c Come usare questo script:', 'font-weight: bold; font-size: 14px;');
console.log('%c 1. Apri la console sviluppatori (F12)', 'font-size: 12px;');
console.log('%c 2. Esegui: testUpdateTrackedApp(ID_TASK, "Nome App")', 'font-size: 12px;');
console.log('%c Esempio: testUpdateTrackedApp(1169, "Chrome")', 'font-size: 12px; font-style: italic;');
