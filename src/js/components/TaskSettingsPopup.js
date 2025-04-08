/**
 * TaskSettingsPopup.js
 * Componente per gestire il popup delle impostazioni di una task
 */

export default class TaskSettingsPopup {
    constructor() {
        // Creiamo il popup dinamicamente
        this.createPopupElement();

        // Aggiungiamo un listener per prevenire la propagazione dei click all'interno del popup
        this.popup.addEventListener('click', this.handlePopupClick.bind(this));

        // Inizializza i gestori per le diverse sezioni
        this.initTimeSection();
        this.initDescriptionSection();
        this.initToggleHandlers();
        this.initTrackAppSection();

        // Selezione dell'app da tracciare
        this.selectedApp = null;

        // Interval per aggiornare le app tracciate
        this.appUpdateInterval = null;

        console.log('TaskSettingsPopup inizializzato');
    }

    /**
     * Crea l'elemento popup dinamicamente
     */
    createPopupElement() {
        // Rimuovi il popup esistente se presente
        const existingPopup = document.getElementById('taskSettingsPopup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Crea l'elemento principale del popup
        this.popup = document.createElement('div');
        this.popup.id = 'taskSettingsPopup';
        this.popup.className = 'task-settings-popup';
        this.popup.style.display = 'none';

        // Imposta il contenuto HTML del popup
        this.popup.innerHTML = `
            <h2>impostazioni</h2>
            <div class="settings-row">
                <div class="settings-label">
                    <span id="timerLabel">Timer</span>
                    <span id="timerDisplay" style="display: none;">00:00:00</span>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="timerToggle">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-row">
                <div class="settings-label">Giornaliero</div>
                <label class="toggle-switch">
                    <input type="checkbox" id="dailyToggle">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-row track-app" id="trackAppRow">
                <div class="settings-label">Track App</div>
                <div class="track-app-icon">
                    <i data-lucide="plus"></i>
                </div>
            </div>
            <div class="settings-row app-dropdown-row" id="appDropdownRow" style="display: none;">
                <div class="app-dropdown-container">
                    <div class="app-dropdown-header">
                        <span>App Attive</span>
                        <button class="close-app-dropdown-btn" id="closeAppDropdownBtn">×</button>
                    </div>
                    <div class="app-list" id="appList">
                        <div class="app-list-loading">Caricamento app in corso...</div>
                    </div>
                </div>
            </div>
            <div class="settings-row selected-app-row" id="selectedAppRow" style="display: none;">
                <div class="selected-app-container">
                    <div class="selected-app-name">
                        <i data-lucide="app-window"></i>
                        <span id="selectedAppName">Nessuna app selezionata</span>
                    </div>
                    <button class="remove-app-btn" id="removeAppBtn">×</button>
                </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-row add-description" id="addDescriptionRow">
                <div class="settings-label">+ Aggiungi descrizione</div>
            </div>
            <div class="settings-row description-row" id="descriptionRow" style="display: none;">
                <div class="description-container">
                    <textarea id="taskDescription" class="description-textarea" placeholder="Descrizione..."></textarea>
                    <div class="close-button-container">
                        <button class="close-description-btn" id="closeDescriptionBtn">×</button>
                    </div>
                </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-row add-time" id="addTimeRow">
                <div class="settings-label">+ Aggiungi tempo</div>
            </div>
            <div class="settings-row" id="timeSettingsRow" style="display: none;">
                <div class="time-inputs">
                    <div class="time-input">
                        <input type="text" id="taskDays" placeholder="0" value="">
                        <div class="time-unit">giorni</div>
                    </div>
                    <div class="time-input">
                        <input type="text" id="taskHours" placeholder="0" value="">
                        <div class="time-unit">ore</div>
                    </div>
                    <div class="time-input">
                        <input type="text" id="taskMinutes" placeholder="00" value="">
                        <div class="time-unit">min</div>
                    </div>
                </div>
                <div class="close-button-container">
                    <button class="close-time-btn" id="closeTimeBtn">×</button>
                </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-row save-button-row">
                <button id="saveTimeSettings" class="settings-save-button">Salva</button>
            </div>
        `;

        // Aggiungi il popup al corpo del documento
        document.body.appendChild(this.popup);
    }

    /**
     * Inizializza i gestori degli eventi per i toggle
     */
    initToggleHandlers() {
        const timerToggle = document.getElementById('timerToggle');
        if (timerToggle) {
            timerToggle.addEventListener('change', (event) => {
                const timerLabel = document.getElementById('timerLabel');
                const timerDisplay = document.getElementById('timerDisplay');

                if (event.target.checked) {
                    timerLabel.style.display = 'none';
                    timerDisplay.style.display = 'inline';
                    // Assicurati che la variabile globale venga aggiornata
                    if (window.updateTimerState) {
                        window.updateTimerState(true);
                    }
                } else {
                    timerLabel.style.display = 'inline';
                    timerDisplay.style.display = 'none';
                    // Assicurati che la variabile globale venga aggiornata
                    if (window.updateTimerState) {
                        window.updateTimerState(false);
                    }
                }
            });
        }

        const dailyToggle = document.getElementById('dailyToggle');
        if (dailyToggle) {
            dailyToggle.addEventListener('change', (event) => {
                console.log('Giornaliero:', event.target.checked);
                // Assicurati che la variabile globale venga aggiornata
                if (typeof window.isDailyEnabled !== 'undefined') {
                    window.isDailyEnabled = event.target.checked;
                }
            });
        }
    }

    /**
     * Inizializza i gestori degli eventi per la sezione descrizione
     */
    initDescriptionSection() {
        const addDescriptionRow = document.getElementById('addDescriptionRow');
        if (addDescriptionRow) {
            addDescriptionRow.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Click su Aggiungi descrizione');

                // Nascondiamo la riga per aggiungere descrizione e mostriamo l'area di testo
                document.getElementById('addDescriptionRow').style.display = 'none';
                document.getElementById('descriptionRow').style.display = 'flex';

                // Mettiamo il focus sulla textarea
                document.getElementById('taskDescription').focus();
            });
        }

        const closeDescriptionBtn = document.getElementById('closeDescriptionBtn');
        if (closeDescriptionBtn) {
            closeDescriptionBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Click su pulsante chiusura descrizione (annullamento)');

                // Reset del valore inserito (annulla l'aggiunta della descrizione)
                const textareaElement = document.getElementById('taskDescription');
                if (textareaElement) {
                    textareaElement.value = '';
                }

                // Se c'è una variabile globale per la descrizione, non modificarla
                // Se siamo in modalità creazione, la lasciamo vuota
                // Se siamo in modalità modifica, manteniamo il valore originale

                // Nascondiamo la sezione descrizione
                document.getElementById('descriptionRow').style.display = 'none';

                // Mostriamo nuovamente la riga "Aggiungi descrizione"
                document.getElementById('addDescriptionRow').style.display = 'flex';
            });
        }

        // Aggiungi un listener di input per aggiornare la variabile globale in tempo reale
        const taskDescription = document.getElementById('taskDescription');
        if (taskDescription) {
            taskDescription.addEventListener('input', (event) => {
                if (typeof window.currentTaskDescription !== 'undefined') {
                    window.currentTaskDescription = event.target.value;
                }
            });
        }
    }

    /**
     * Inizializza i gestori degli eventi per la sezione "aggiungi tempo"
     */
    initTimeSection() {
        // Gestione del pulsante Salva
        const saveTimeButton = document.getElementById('saveTimeSettings');
        if (saveTimeButton) {
            saveTimeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Clic sul pulsante Salva');

                // Salviamo eventuali valori inseriti
                const taskData = this.collectTaskData();

                // Assicurati che le variabili globali vengano aggiornate
                if (typeof window.timeSettingsSaved !== 'undefined') {
                    window.timeSettingsSaved = true;
                }

                if (typeof window.currentTaskDescription !== 'undefined') {
                    const taskDescription = document.getElementById('taskDescription');
                    if (taskDescription) {
                        window.currentTaskDescription = taskDescription.value.trim();
                    }
                }

                if (typeof window.isDailyEnabled !== 'undefined') {
                    const dailyToggle = document.getElementById('dailyToggle');
                    if (dailyToggle) {
                        window.isDailyEnabled = dailyToggle.checked;
                    }
                }

                if (typeof window.savedTaskDays !== 'undefined' &&
                    typeof window.savedTaskHours !== 'undefined' &&
                    typeof window.savedTaskMinutes !== 'undefined') {

                    const timerToggle = document.getElementById('timerToggle');
                    const timerEnabled = timerToggle ? timerToggle.checked : false;

                    if (!timerEnabled) {
                        const dayInput = document.getElementById('taskDays');
                        const hourInput = document.getElementById('taskHours');
                        const minuteInput = document.getElementById('taskMinutes');

                        window.savedTaskDays = dayInput ? (parseInt(dayInput.value) || 0) : 0;
                        window.savedTaskHours = hourInput ? (parseInt(hourInput.value) || 0) : 0;
                        window.savedTaskMinutes = minuteInput ? (parseInt(minuteInput.value) || 0) : 0;
                    } else {
                        window.savedTaskDays = 0;
                        window.savedTaskHours = 0;
                        window.savedTaskMinutes = 0;
                    }
                }

                // Nascondi il popup
                this.hide();

                // Se è disponibile la funzione per salvare task con app tracciate e abbiamo un'app selezionata
                if (typeof window.saveTaskWithTrackedApp === 'function' && this.selectedApp) {
                    // Salva la task con l'app tracciata
                    const taskId = window.activeTaskId || null;
                    window.saveTaskWithTrackedApp(taskData, taskId)
                        .then(savedTask => {
                            console.log('Task salvata con app tracciata:', savedTask);
                        })
                        .catch(error => {
                            console.error('Errore durante il salvataggio della task con app tracciata:', error);
                        });
                }
            });
        }

        // Gestione espansione sezione tempo
        const addTimeRow = document.getElementById('addTimeRow');
        if (addTimeRow) {
            addTimeRow.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Click su Aggiungi tempo');

                // Prendiamo una misura dell'altezza del popup prima di aprire la sezione tempo
                const initialHeight = this.popup.offsetHeight;

                // Nascondiamo la riga per aggiungere tempo e mostriamo gli input
                document.getElementById('addTimeRow').style.display = 'none';
                document.getElementById('timeSettingsRow').style.display = 'flex';

                // Manteniamo la stessa posizione del popup
                this.popup.style.height = initialHeight + 'px';

                // Dopo un breve ritardo, lasciamo che il popup si adatti alla nuova altezza
                setTimeout(() => {
                    this.popup.style.height = 'auto';

                    // Mettiamo il focus sull'input delle ore
                    document.getElementById('taskHours').focus();
                }, 50);
            });
        }

        // Gestione chiusura sezione tempo
        const closeTimeBtn = document.getElementById('closeTimeBtn');
        if (closeTimeBtn) {
            closeTimeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Click su pulsante chiusura tempo');

                // Reset dei valori inseriti (per non salvare i dati)
                document.getElementById('taskDays').value = '';
                document.getElementById('taskHours').value = '';
                document.getElementById('taskMinutes').value = '';

                // Nascondiamo la sezione tempo
                document.getElementById('timeSettingsRow').style.display = 'none';

                // Mostriamo nuovamente la riga "Aggiungi tempo"
                document.getElementById('addTimeRow').style.display = 'flex';
            });
        }
    }

    /**
     * Raccoglie tutti i dati inseriti nel popup
     * @returns {Object} I dati raccolti
     */
    collectTaskData() {
        const timerEnabled = document.getElementById('timerToggle').checked;
        const isDailyEnabled = document.getElementById('dailyToggle').checked;
        const description = document.getElementById('taskDescription').value.trim();

        let days = 0, hours = 0, minutes = 0;
        if (!timerEnabled) {
            days = parseInt(document.getElementById('taskDays').value) || 0;
            hours = parseInt(document.getElementById('taskHours').value) || 0;
            minutes = parseInt(document.getElementById('taskMinutes').value) || 0;
        }

        // Se c'è un'app selezionata, aggiungi le informazioni sull'app
        if (this.selectedApp) {
            return {
                timerEnabled,
                isDailyEnabled,
                description,
                time: {
                    days,
                    hours,
                    minutes
                },
                trackedApp: {
                    name: this.selectedApp.name
                }
            };
        }

        return {
            timerEnabled,
            isDailyEnabled,
            description,
            time: {
                days,
                hours,
                minutes
            }
        };
    }

    /**
     * Posiziona il popup rispetto a un elemento target
     * @param {HTMLElement} targetIcon L'elemento rispetto a cui posizionare il popup
     */
    positionPopup(targetIcon) {
        if (!this.popup || !targetIcon) {
            console.error('Impossibile posizionare il popup: elemento mancante');
            return;
        }

        const iconRect = targetIcon.getBoundingClientRect();

        // Posiziona il popup vicino all'icona
        this.popup.style.position = 'fixed';
        this.popup.style.bottom = (window.innerHeight - iconRect.top + 25) + 'px';
        this.popup.style.right = (window.innerWidth - iconRect.right - 15) + 'px';
        this.popup.style.transform = 'none';
        this.popup.style.zIndex = '10000';

        console.log('Popup posizionato');

        // Notifica che la finestra è stata riposizionata
        if (window.electronAPI && typeof window.electronAPI.logMessage === 'function') {
            window.electronAPI.logMessage('Finestra riposizionata e mostrata');
        }
    }

    /**
     * Inizializzo gli aggiornamenti periodici per le app tracciate
     */
    startAppUpdates() {
        // Aggiorna il tempo dell'app tracciata ogni 30 secondi
        this.appUpdateInterval = setInterval(() => {
            this.updateTrackedAppTime();
        }, 30000);

        // Aggiorna subito il tempo dell'app
        this.updateTrackedAppTime();
    }

    /**
     * Aggiorna il tempo dell'app tracciata nella barra laterale
     */
    updateTrackedAppTime() {
        // Verifica se è presente un'app tracciata
        if (!this.selectedApp || !this.selectedApp.name) return;

        // Ottieni le informazioni aggiornate sull'app
        if (window.appTracker) {
            window.appTracker.getRunningApps()
                .then(stats => {
                    // Cerca l'app tracciata nei dati aggiornati
                    const appData = stats[this.selectedApp.name];
                    if (appData) {
                        // Aggiorna il tempo dell'app nel popup e nella barra laterale
                        this.selectedApp.formattedTime = appData.formattedTime;
                        this.selectedApp.running = appData.isRunning;

                        // Aggiorna l'elemento nella barra laterale
                        const trackedAppItem = document.getElementById('trackedAppItem');
                        if (trackedAppItem) {
                            const infoValue = trackedAppItem.querySelector('.info-value');
                            if (infoValue) {
                                infoValue.textContent = appData.formattedTime;
                            }
                        }
                    }
                })
                .catch(error => {
                    console.error('Errore nell\'aggiornamento del tempo dell\'app:', error);
                });
        }
    }

    /**
     * Ferma gli aggiornamenti periodici dell'app tracciata
     */
    stopAppUpdates() {
        if (this.appUpdateInterval) {
            clearInterval(this.appUpdateInterval);
            this.appUpdateInterval = null;
        }
    }

    /**
     * Mostra il popup
     * @param {HTMLElement} targetIcon L'elemento rispetto a cui posizionare il popup
     */
    show(targetIcon) {
        if (!this.popup) return;

        this.popup.style.display = 'block';
        this.positionPopup(targetIcon);

        // Avvia gli aggiornamenti per l'app tracciata
        this.startAppUpdates();
    }

    /**
     * Nasconde il popup
     */
    hide() {
        if (!this.popup) return;

        this.popup.style.display = 'none';

        // Ferma gli aggiornamenti per l'app tracciata
        this.stopAppUpdates();
    }

    /**
     * Attiva/disattiva la visibilità del popup
     * @param {HTMLElement} targetIcon L'elemento rispetto a cui posizionare il popup
     */
    toggle(targetIcon) {
        if (!this.popup) return;

        if (this.popup.style.display === 'none' || !this.popup.style.display) {
            this.show(targetIcon);
        } else {
            this.hide();
        }
    }

    /**
     * Gestisce i click all'interno del popup
     * @param {Event} event L'evento click
     */
    handlePopupClick(event) {
        // Preveniamo che il click si propaghi fuori dal popup
        event.stopPropagation();
    }

    /**
     * Inizializza i gestori degli eventi per la sezione Track App
     */
    initTrackAppSection() {
        const trackAppRow = document.getElementById('trackAppRow');
        if (trackAppRow) {
            trackAppRow.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Click su Track App');

                // Nascondi la riga Track App e mostra il dropdown
                trackAppRow.style.display = 'none';
                document.getElementById('appDropdownRow').style.display = 'flex';

                // Carica le app attive
                this.loadActiveApps();
            });
        }

        // Inizializza il pulsante di chiusura del dropdown
        const closeAppDropdownBtn = document.getElementById('closeAppDropdownBtn');
        if (closeAppDropdownBtn) {
            closeAppDropdownBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Chiusura dropdown app');

                // Nascondi il dropdown e mostra la riga Track App
                document.getElementById('appDropdownRow').style.display = 'none';
                trackAppRow.style.display = 'flex';
            });
        }

        // Inizializza il pulsante di rimozione dell'app selezionata
        const removeAppBtn = document.getElementById('removeAppBtn');
        if (removeAppBtn) {
            removeAppBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Rimozione app selezionata');

                // Rimuovi l'app selezionata
                this.selectedApp = null;

                // Rimuovi l'app dalla barra laterale
                this.removeAppFromSidebar();

                // Nascondi la riga dell'app selezionata e mostra la riga Track App
                document.getElementById('selectedAppRow').style.display = 'none';
                trackAppRow.style.display = 'flex';

                // Resetta la variabile globale
                if (typeof window.trackedAppName !== 'undefined') {
                    window.trackedAppName = null;
                }
            });
        }
    }

    /**
     * Carica le app attive dal sistema
     */
    loadActiveApps() {
        const appList = document.getElementById('appList');

        // Verifica che l'API appTracker sia disponibile
        if (!window.appTracker) {
            appList.innerHTML = '<div class="app-list-error">API appTracker non disponibile</div>';
            return;
        }

        // Mostra il messaggio di caricamento
        appList.innerHTML = '<div class="app-list-loading">Caricamento app in corso...</div>';

        // Carica le app attive
        window.appTracker.getRunningApps()
            .then(stats => {
                // Mostra solo le app in esecuzione
                const activeApps = Object.entries(stats)
                    .filter(([_, appData]) => appData.isRunning)
                    .sort((a, b) => a[0].localeCompare(b[0])); // Ordina per nome

                if (activeApps.length === 0) {
                    appList.innerHTML = '<div class="app-list-empty">Nessuna app attiva rilevata</div>';
                    return;
                }

                // Crea gli elementi della lista
                appList.innerHTML = '';
                activeApps.forEach(([appName, appData]) => {
                    const appItem = document.createElement('div');
                    appItem.className = 'app-item';

                    appItem.innerHTML = `
                        <div class="app-item-icon">
                            <i data-lucide="app-window"></i>
                        </div>
                        <div class="app-item-details">
                            <div class="app-item-name">${appName}</div>
                            <div class="app-item-time">${appData.formattedTime}</div>
                        </div>
                    `;

                    // Aggiungi il click handler
                    appItem.addEventListener('click', () => {
                        this.selectApp(appName, appData);
                    });

                    appList.appendChild(appItem);
                });

                // Inizializza le icone
                if (window.lucide) {
                    lucide.createIcons();
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento delle app:', error);
                appList.innerHTML = `<div class="app-list-error">Errore: ${error.message}</div>`;
            });
    }

    /**
     * Seleziona un'app per il tracciamento
     * @param {string} appName Nome dell'app selezionata
     * @param {Object} appData Dati dell'app selezionata
     */
    selectApp(appName, appData) {
        console.log('App selezionata:', appName);

        // Salva l'app selezionata
        this.selectedApp = {
            name: appName,
            formattedTime: "0h 0m 0s", // Tempo iniziale a zero
            running: true
        };

        // Aggiorna l'UI del popup
        const selectedAppName = document.getElementById('selectedAppName');
        if (selectedAppName) {
            selectedAppName.textContent = appName;
        }

        // Nascondi il dropdown e mostra la riga dell'app selezionata
        document.getElementById('appDropdownRow').style.display = 'none';
        document.getElementById('selectedAppRow').style.display = 'flex';

        // Aggiungi l'app selezionata alla barra laterale
        this.addAppToSidebar(appName, { formattedTime: "0h 0m 0s", isRunning: true });

        // Assicurati che la variabile globale venga aggiornata
        if (typeof window.trackedAppName !== 'undefined') {
            window.trackedAppName = appName;
        }
    }

    /**
     * Aggiunge l'app selezionata alla barra laterale sinistra
     * @param {string} appName Nome dell'app
     * @param {Object} appData Dati dell'app
     */
    addAppToSidebar(appName, appData) {
        // Trova la info-container nella barra laterale
        const infoContainer = document.querySelector('.info-container');
        if (!infoContainer) {
            console.error('Info container non trovato nella barra laterale');
            return;
        }

        // Verifica se esiste già una sezione TRACKED APP
        let trackedAppHeader = document.getElementById('trackedAppHeader');
        if (!trackedAppHeader) {
            // Crea una nuova intestazione per le app tracciate
            trackedAppHeader = document.createElement('h3');
            trackedAppHeader.id = 'trackedAppHeader';
            trackedAppHeader.className = 'info-header';
            trackedAppHeader.textContent = 'TRACKED APP';

            // Aggiungi l'header dopo la sezione PRIORITY
            const priorityHeader = document.getElementById('priorityHeader');
            if (priorityHeader) {
                // Trova l'ultimo elemento della sezione PRIORITY
                const lastPriorityElement = document.getElementById('basicFilter');
                if (lastPriorityElement) {
                    // Inserisci l'intestazione dopo l'ultimo elemento della sezione PRIORITY
                    lastPriorityElement.after(trackedAppHeader);
                } else {
                    // Fallback: inserisci alla fine del container
                    infoContainer.appendChild(trackedAppHeader);
                }
            } else {
                // Fallback: inserisci alla fine del container
                infoContainer.appendChild(trackedAppHeader);
            }
        }

        // Rimuovi eventuali app tracciate esistenti
        const existingTrackedApp = document.getElementById('trackedAppItem');
        if (existingTrackedApp) {
            existingTrackedApp.remove();
        }

        // Crea l'elemento per l'app tracciata
        const trackedAppItem = document.createElement('div');
        trackedAppItem.id = 'trackedAppItem';
        trackedAppItem.className = 'info-item';

        trackedAppItem.innerHTML = `
            <i data-lucide="app-window" class="icon-app-window"></i>
            <span>${appName}</span>
            <span class="info-value">${appData.formattedTime}</span>
        `;

        // Inserisci l'elemento dopo l'intestazione TRACKED APP
        trackedAppHeader.after(trackedAppItem);

        // Inizializza le icone Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    /**
     * Rimuove l'app tracciata dalla barra laterale
     */
    removeAppFromSidebar() {
        // Rimuovi l'app tracciata
        const trackedAppItem = document.getElementById('trackedAppItem');
        if (trackedAppItem) {
            trackedAppItem.remove();
        }

        // Verifica se rimuovere anche l'intestazione
        const trackedAppHeader = document.getElementById('trackedAppHeader');
        if (trackedAppHeader) {
            trackedAppHeader.remove();
        }
    }
}
