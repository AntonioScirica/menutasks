/**
 * direct-update.js
 * Script per aggiornare direttamente la colonna tracked_app nel database Supabase
 * 
 * IMPORTANTE: Includi questo script nella pagina principale con:
 * <script src="tools/direct-update.js"></script>
 */

// IIFE per evitare inquinamento dello scope globale
(function () {
    // Configurazione Supabase
    const SUPABASE_URL = 'https://lrchdpuvgitjzoeqeirj.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyY2hkcHV2Z2l0anpvZXFlaXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMzgxMjgsImV4cCI6MjA1NzgxNDEyOH0.fnfrPJYDGjKYNouCVEzfxMnF0N-AWmYtX0V8G_bOa58';

    /**
     * Aggiorna direttamente la colonna tracked_app per una task
     * @param {string|number} taskId - ID della task
     * @param {string} appName - Nome dell'applicazione da tracciare
     * @returns {Promise} Promise che si risolve con il risultato dell'aggiornamento
     */
    function directUpdateTrackedApp(taskId, appName) {
        if (!taskId) {
            console.error('[directUpdateTrackedApp] ID task non valido');
            return Promise.reject(new Error('ID task non valido'));
        }

        if (!appName || typeof appName !== 'string') {
            console.error('[directUpdateTrackedApp] Nome app non valido');
            return Promise.reject(new Error('Nome app non valido'));
        }

        console.log(`[directUpdateTrackedApp] Aggiornamento task ${taskId} con app ${appName}`);

        // Esegui l'aggiornamento diretto con API REST
        return fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ tracked_app: appName })
        })
            .then(response => {
                if (!response.ok) {
                    console.error(`[directUpdateTrackedApp] Errore HTTP: ${response.status}`);
                    throw new Error(`Errore HTTP: ${response.status}`);
                }

                console.log(`[directUpdateTrackedApp] Aggiornamento eseguito con status ${response.status}`);

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
                    console.error('[directUpdateTrackedApp] Task non trovata dopo aggiornamento');
                    throw new Error('Task non trovata dopo aggiornamento');
                }

                const updatedTask = tasks[0];
                console.log('[directUpdateTrackedApp] Nuovo valore tracked_app:', updatedTask.tracked_app);

                // Verifica se l'aggiornamento ha avuto successo
                if (updatedTask.tracked_app !== appName) {
                    console.warn(`[directUpdateTrackedApp] ATTENZIONE: L'aggiornamento non è stato applicato! Atteso: ${appName}, Attuale: ${updatedTask.tracked_app}`);
                } else {
                    console.log('[directUpdateTrackedApp] ✅ Aggiornamento verificato con successo!');
                }

                return updatedTask;
            })
            .catch(error => {
                console.error('[directUpdateTrackedApp] Errore:', error);
                throw error;
            });
    }

    // Aggiunge pulsante di aggiornamento diretto al popup
    function addDirectUpdateButton() {
        // Funzione per verificare periodicamente la presenza del popup e del selectedAppRow
        const checkAndAddButton = () => {
            const taskSettingsPopup = document.getElementById('taskSettingsPopup');
            const selectedAppRow = document.getElementById('selectedAppRow');
            const saveButtonRow = document.querySelector('.settings-save-button')?.parentElement;

            // Non fare nulla se il popup non è ancora presente o se il pulsante è già stato aggiunto
            if (!taskSettingsPopup || !selectedAppRow || !saveButtonRow || document.getElementById('forceUpdateAppBtn')) {
                return;
            }

            console.log('[directUpdateTrackedApp] Aggiunta pulsante di aggiornamento forzato');

            // Crea una nuova riga per il pulsante di aggiornamento forzato
            const forceUpdateRow = document.createElement('div');
            forceUpdateRow.className = 'settings-row save-button-row';
            forceUpdateRow.style.marginTop = '10px';

            // Crea il pulsante
            const forceUpdateBtn = document.createElement('button');
            forceUpdateBtn.id = 'forceUpdateAppBtn';
            forceUpdateBtn.className = 'settings-save-button';
            forceUpdateBtn.style.backgroundColor = '#e91e63';
            forceUpdateBtn.textContent = 'Forza Aggiornamento App';

            // Aggiungi il pulsante alla riga
            forceUpdateRow.appendChild(forceUpdateBtn);

            // Inserisci la riga dopo il pulsante Salva
            saveButtonRow.after(forceUpdateRow);

            // Aggiungi event listener al pulsante
            forceUpdateBtn.addEventListener('click', (event) => {
                event.stopPropagation();

                // Ottieni l'ID della task e il nome dell'app selezionata
                const taskId = window.activeTaskId;
                const appName = document.getElementById('selectedAppName')?.textContent || null;

                if (!taskId || !appName) {
                    alert('Dati mancanti: seleziona prima un\'app');
                    return;
                }

                console.log(`[forceUpdateAppBtn] Aggiornamento forzato per task ${taskId} con app ${appName}`);

                // Esegui l'aggiornamento diretto
                directUpdateTrackedApp(taskId, appName)
                    .then(updatedTask => {
                        // Crea una notifica di successo
                        const notification = document.createElement('div');
                        notification.style.position = 'fixed';
                        notification.style.top = '50%';
                        notification.style.left = '50%';
                        notification.style.transform = 'translate(-50%, -50%)';
                        notification.style.backgroundColor = updatedTask.tracked_app === appName ? '#4CAF50' : '#f44336';
                        notification.style.color = 'white';
                        notification.style.padding = '20px';
                        notification.style.borderRadius = '4px';
                        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
                        notification.style.zIndex = '10000';
                        notification.style.textAlign = 'center';

                        // Contenuto della notifica
                        if (updatedTask.tracked_app === appName) {
                            notification.innerHTML = `
                                <h3 style="margin-top: 0;">✅ Aggiornamento riuscito!</h3>
                                <p>L'app "${appName}" è stata assegnata alla task ${taskId}</p>
                                <p>Valore salvato: ${updatedTask.tracked_app}</p>
                            `;
                        } else {
                            notification.innerHTML = `
                                <h3 style="margin-top: 0;">❌ Aggiornamento fallito</h3>
                                <p>Non è stato possibile assegnare l'app "${appName}" alla task ${taskId}</p>
                                <p>Valore attuale: ${updatedTask.tracked_app || 'null'}</p>
                            `;
                        }

                        // Aggiungi un pulsante di chiusura
                        const closeButton = document.createElement('button');
                        closeButton.textContent = 'Chiudi';
                        closeButton.style.marginTop = '10px';
                        closeButton.style.padding = '5px 10px';
                        closeButton.style.border = 'none';
                        closeButton.style.borderRadius = '4px';
                        closeButton.style.backgroundColor = 'white';
                        closeButton.style.color = '#333';
                        closeButton.style.cursor = 'pointer';

                        closeButton.addEventListener('click', () => {
                            document.body.removeChild(notification);
                        });

                        notification.appendChild(closeButton);
                        document.body.appendChild(notification);

                        // Auto-chiudi dopo 10 secondi
                        setTimeout(() => {
                            if (document.body.contains(notification)) {
                                document.body.removeChild(notification);
                            }
                        }, 10000);
                    })
                    .catch(error => {
                        alert(`Errore: ${error.message}`);
                    });
            });
        };

        // Controlla periodicamente la presenza del popup
        const observerInterval = setInterval(checkAndAddButton, 1000);

        // Pulisci l'intervallo dopo 60 secondi per evitare leak di memoria
        setTimeout(() => {
            clearInterval(observerInterval);
        }, 60000);
    }

    // Monitora eventuali cambiamenti al DOM per installare il patch
    function installTrackedAppPatch() {
        console.log('[directUpdateTrackedApp] Installazione patch per tracked_app...');

        // Aggiungi il pulsante di aggiornamento forzato
        addDirectUpdateButton();

        // Patch per TaskSettingsPopup
        const originalSelectApp = window.TaskSettingsPopup?.prototype?.selectApp;
        if (originalSelectApp) {
            console.log('[directUpdateTrackedApp] Patch di TaskSettingsPopup.selectApp');

            // Override del metodo selectApp
            window.TaskSettingsPopup.prototype.selectApp = function (appName, appData) {
                // Chiamata al metodo originale
                originalSelectApp.call(this, appName, appData);

                // Dopo la chiamata originale, aggiorna direttamente il database
                const taskId = window.activeTaskId;
                if (taskId) {
                    console.log(`[directUpdateTrackedApp] Intercettato selectApp per task ${taskId} con app ${appName}`);

                    // Esegui l'aggiornamento diretto
                    directUpdateTrackedApp(taskId, appName)
                        .then(updatedTask => {
                            console.log('[directUpdateTrackedApp] Task aggiornata:', updatedTask);

                            // Notifica l'utente del completamento
                            const notification = document.createElement('div');
                            notification.style.position = 'fixed';
                            notification.style.bottom = '20px';
                            notification.style.right = '20px';
                            notification.style.backgroundColor = '#4CAF50';
                            notification.style.color = 'white';
                            notification.style.padding = '10px 20px';
                            notification.style.borderRadius = '4px';
                            notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                            notification.style.zIndex = '9999';
                            notification.textContent = `App "${appName}" assegnata correttamente`;

                            document.body.appendChild(notification);

                            // Rimuovi la notifica dopo 3 secondi
                            setTimeout(() => {
                                document.body.removeChild(notification);
                            }, 3000);
                        })
                        .catch(error => {
                            console.error('[directUpdateTrackedApp] Errore durante l\'aggiornamento:', error);
                        });
                }
            };

            console.log('[directUpdateTrackedApp] Patch installata con successo');
        } else {
            console.warn('[directUpdateTrackedApp] TaskSettingsPopup.selectApp non trovato, impossibile installare patch');
        }
    }

    // Esporta la funzione nel namespace globale
    window.directUpdateTrackedApp = directUpdateTrackedApp;

    // Installa la patch quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installTrackedAppPatch);
    } else {
        // Il DOM è già pronto
        setTimeout(installTrackedAppPatch, 1000);
    }

    console.log('[directUpdateTrackedApp] Script caricato');
})();
