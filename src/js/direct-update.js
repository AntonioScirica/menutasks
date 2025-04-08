/**
 * Utility per aggiornare direttamente il campo tracked_app in Supabase
 */

// Includi questo script nel file HTML principale
document.addEventListener('DOMContentLoaded', () => {
    patchUpdateTrackedAppDirectly();
    console.log('Patch per aggiornamento diretto installata');
});

/**
 * Applica la patch al metodo updateTrackedAppDirectly
 */
function patchUpdateTrackedAppDirectly() {
    // Controlla periodicamente se la classe TaskSettingsPopup è disponibile
    const checkInterval = setInterval(() => {
        if (window.TaskSettingsPopup && window.TaskSettingsPopup.prototype.updateTrackedAppDirectly) {
            clearInterval(checkInterval);

            // Salva il metodo originale
            const originalMethod = window.TaskSettingsPopup.prototype.updateTrackedAppDirectly;

            // Sostituisci con la versione modificata
            window.TaskSettingsPopup.prototype.updateTrackedAppDirectly = function () {
                console.log('=== updateTrackedAppDirectly PATCHED chiamato ===');

                // Controlli standard
                if (!this.selectedApp || !this.selectedApp.name) {
                    console.error('Nessuna app selezionata da aggiornare');
                    this.showNotification('Errore: nessuna app selezionata', 'error');
                    return;
                }

                // Ottieni l'ID task
                let taskId = window.currentEditingTaskId || window.activeTaskId;
                if (!taskId) {
                    const activeTaskElement = document.querySelector('.todo-list-item.active');
                    if (activeTaskElement && activeTaskElement.dataset.taskId) {
                        taskId = activeTaskElement.dataset.taskId;
                    }
                }

                if (!taskId) {
                    console.error('Nessuna task attiva trovata');
                    this.showNotification('Errore: nessuna task attiva trovata', 'error');
                    return;
                }

                const appName = this.selectedApp.name;
                console.log("Aggiornamento diretto REST API: Task " + taskId + ", App " + appName);

                // Modifica UI del pulsante
                const directUpdateBtn = document.getElementById('directUpdateBtn');
                if (directUpdateBtn) {
                    directUpdateBtn.textContent = 'Aggiornamento...';
                    directUpdateBtn.disabled = true;
                }

                // Configurazione Supabase
                const SUPABASE_URL = 'https://lrchdpuvgitjzoeqeirj.supabase.co';
                const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyY2hkcHV2Z2l0anpvZXFlaXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMzgxMjgsImV4cCI6MjA1NzgxNDEyOH0.fnfrPJYDGjKYNouCVEzfxMnF0N-AWmYtX0V8G_bOa58';

                // Esegui l'aggiornamento diretto con API REST
                fetch(SUPABASE_URL + "/rest/v1/tasks?id=eq." + taskId, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_KEY,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ tracked_app: appName })
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Errore HTTP: " + response.status);
                        }

                        // Verifica che l'aggiornamento sia stato applicato
                        return fetch(SUPABASE_URL + "/rest/v1/tasks?id=eq." + taskId, {
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': SUPABASE_KEY,
                                'Authorization': 'Bearer ' + SUPABASE_KEY
                            }
                        });
                    })
                    .then(response => response.json())
                    .then(tasks => {
                        if (!tasks || tasks.length === 0) {
                            throw new Error('Task non trovata dopo aggiornamento');
                        }

                        const updatedTask = tasks[0];
                        console.log('Nuovo valore tracked_app:', updatedTask.tracked_app);

                        // Verifica successo
                        if (updatedTask.tracked_app !== appName) {
                            throw new Error("Aggiornamento non riuscito. Valore attuale: " + (updatedTask.tracked_app || 'null'));
                        }

                        // Mostra notifica di successo
                        this.showNotification("App '" + appName + "' aggiornata con successo in Supabase", 'success');

                        // Aggiorna database locale
                        return window.databaseService.updateTask(taskId, {
                            tracked_app: appName,
                            trackedApp: this.selectedApp
                        });
                    })
                    .then(() => {
                        // Aggiorna pulsante per feedback
                        if (directUpdateBtn) {
                            directUpdateBtn.disabled = false;
                            directUpdateBtn.textContent = 'Aggiornato ✓';
                            directUpdateBtn.style.backgroundColor = '#4CAF50';

                            setTimeout(() => {
                                directUpdateBtn.style.backgroundColor = '#4a6cf7';
                                directUpdateBtn.textContent = 'Aggiorna Diretto';
                            }, 2000);
                        }
                    })
                    .catch(error => {
                        console.error("Errore durante l'aggiornamento diretto:", error);

                        // Ripristina pulsante
                        if (directUpdateBtn) {
                            directUpdateBtn.disabled = false;
                            directUpdateBtn.textContent = 'Aggiorna Diretto';
                        }

                        this.showNotification("Errore: " + error.message, 'error');

                        // Prova il metodo originale come fallback
                        console.log('Tentativo con il metodo originale...');
                        originalMethod.call(this);
                    });
            };

            console.log('Patch applicata con successo a updateTrackedAppDirectly');
        }
    }, 1000);

    // Ferma il controllo dopo 30 secondi per evitare memory leak
    setTimeout(() => {
        clearInterval(checkInterval);
    }, 30000);
}
