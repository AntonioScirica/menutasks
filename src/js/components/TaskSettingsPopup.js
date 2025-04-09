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
        this.initAssignedToSection();

        console.log('TaskSettingsPopup inizializzato');

        // Popola il dropdown delle app al caricamento
        this.populateAppDropdown();
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
            <div class="settings-row">
                <div class="settings-label">Assegnato a</div>
                <div class="select-container">
                    <select id="assignedToSelect" class="task-dropdown">
                        <option value="">-- Seleziona --</option>
                        <option value="persona1">Persona 1</option>
                        <option value="persona2">Persona 2</option>
                        <option value="persona3">Persona 3</option>
                        <option value="persona4">Persona 4</option>
                        <option value="persona5">Persona 5</option>
                    </select>
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

                // Usa il nuovo metodo saveSettings per gestire correttamente il salvataggio
                this.saveSettings();
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
     * Inizializza i gestori degli eventi per la sezione di assegnazione
     */
    initAssignedToSection() {
        const assignedToSelect = document.getElementById('assignedToSelect');
        if (assignedToSelect) {
            assignedToSelect.addEventListener('change', (event) => {
                const selectedValue = event.target.value;
                console.log('Task assegnata a:', selectedValue);

                // Imposta la variabile globale e assicurati che esista
                window.currentAssignedTo = selectedValue;

                // Debug - verifica se la variabile è stata impostata correttamente
                console.log('Variabile window.currentAssignedTo impostata a:', window.currentAssignedTo);
            });
        } else {
            console.error('Elemento assignedToSelect non trovato nel DOM');
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
        const assignedTo = document.getElementById('assignedToSelect').value;

        let days = 0, hours = 0, minutes = 0;
        if (!timerEnabled) {
            days = parseInt(document.getElementById('taskDays').value) || 0;
            hours = parseInt(document.getElementById('taskHours').value) || 0;
            minutes = parseInt(document.getElementById('taskMinutes').value) || 0;
        }

        // Dati base della task
        const taskData = {
            timerEnabled,
            isDailyEnabled,
            description,
            assignedTo,
            time: {
                days,
                hours,
                minutes
            }
        };

        console.log('Dati task raccolti:', taskData);
        return taskData;
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
     * Popola il dropdown con le app attualmente in esecuzione
     */
    async populateAppDropdown() {
        const assignedToSelect = document.getElementById('assignedToSelect');
        if (!assignedToSelect) {
            console.error('Elemento assignedToSelect non trovato');
            return;
        }

        try {
            // Salva il valore correntemente selezionato (se esiste)
            const currentValue = assignedToSelect.value;

            // Pulisci il dropdown
            assignedToSelect.innerHTML = '<option value="">-- Seleziona --</option>';

            // Ottieni le app attive tramite electronAPI
            if (window.electronAPI && typeof window.electronAPI.getActiveApps === 'function') {
                console.log('Richiesta app attive in corso...');
                const apps = await window.electronAPI.getActiveApps();

                console.log('App attive ottenute:', apps);

                // Aggiungi ciascuna app come opzione
                if (Array.isArray(apps) && apps.length > 0) {
                    apps.forEach(app => {
                        const option = document.createElement('option');
                        option.value = app;
                        option.textContent = app;
                        assignedToSelect.appendChild(option);
                    });

                    // Ripristina il valore selezionato in precedenza, se era valido
                    if (currentValue && apps.includes(currentValue)) {
                        assignedToSelect.value = currentValue;
                    }
                } else {
                    console.warn('Nessuna app attiva rilevata, utilizzo placeholder');
                    this.addPlaceholderOptions(assignedToSelect, currentValue);
                }
            } else {
                console.warn('API getActiveApps non disponibile, utilizzo placeholder');
                this.addPlaceholderOptions(assignedToSelect, currentValue);
            }
        } catch (error) {
            console.error('Errore nel popolare il dropdown delle app:', error);
            // In caso di errore, aggiungi comunque opzioni placeholder
            this.addPlaceholderOptions(document.getElementById('assignedToSelect'));
        }
    }

    /**
     * Aggiunge opzioni placeholder al dropdown
     * @param {HTMLElement} selectElement - Elemento select da popolare
     * @param {string} currentValue - Valore attualmente selezionato
     */
    addPlaceholderOptions(selectElement, currentValue = '') {
        if (!selectElement) return;

        const placeholders = ['Chrome', 'Safari', 'Firefox', 'VS Code', 'Terminal'];
        placeholders.forEach(app => {
            const option = document.createElement('option');
            option.value = app;
            option.textContent = app;
            selectElement.appendChild(option);
        });

        // Ripristina il valore selezionato in precedenza, se era valido
        if (currentValue && placeholders.includes(currentValue)) {
            selectElement.value = currentValue;
        }
    }

    /**
     * Mostra il popup di impostazioni della task
     * @param {Object|HTMLElement} params - Parametri o elemento target (per retrocompatibilità)
     */
    show(params) {
        // Supporto per vecchie chiamate
        let targetIcon, taskId, taskName, timeData;

        if (params instanceof HTMLElement) {
            // Vecchio formato: show(targetIcon)
            targetIcon = params;
            taskId = window.activeTaskId;
        } else {
            // Nuovo formato: show({targetIcon, taskId, taskName, timeData})
            targetIcon = params.targetIcon;
            taskId = params.taskId || window.activeTaskId;
            taskName = params.taskName;
            timeData = params.timeData;
        }

        // Memorizza l'ID della task corrente
        window.currentEditingTaskId = taskId;

        console.log("TaskSettingsPopup.show - taskId:", taskId);

        if (!this.popup) {
            this.createPopup();
        }

        // Aggiorna il titolo
        if (taskName) {
            const titleElement = this.popup.querySelector('.popup-title');
            if (titleElement) {
                titleElement.textContent = taskName;
            }
        }

        // Popola i campi del form con i dati della task
        if (taskId) {
            window.databaseService.getTask(taskId)
                .then(task => {
                    if (task) {
                        console.log("Task caricata:", task);
                        // Popola i campi del form
                        this.populateTaskData(task);
                    }
                })
                .catch(error => {
                    console.error('Errore nel recupero della task:', error);
                });
        }

        this.popup.style.display = 'block';
        this.positionPopup(targetIcon);

        // Popola il dropdown con le app attive
        this.populateAppDropdown();
    }

    /**
     * Nasconde il popup
     */
    hide() {
        if (!this.popup) return;
        this.popup.style.display = 'none';
    }

    /**
     * Attiva/disattiva la visibilità del popup
     * @param {HTMLElement|Object} params L'elemento rispetto a cui posizionare il popup o un oggetto con i parametri
     */
    toggle(params) {
        if (!this.popup) {
            this.createPopup();
        }

        if (this.popup.style.display === 'none' || !this.popup.style.display) {
            this.show(params);
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
     * Mostra una notifica all'utente
     * @param {string} message - Messaggio da mostrare
     * @param {string} type - Tipo di notifica (info, success, warning, error)
     */
    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`Notifica (${type}): ${message}`);
            // Fallback semplice se la funzione globale non è disponibile
            alert(message);
        }
    }

    /**
     * Popola i campi del form con i dati della task esistente
     * @param {Object} task - Dati della task
     */
    populateTaskData(task) {
        // Imposta il toggle Giornaliero
        const dailyToggle = document.getElementById('dailyToggle');
        if (dailyToggle) {
            dailyToggle.checked = !!task.is_daily;
            if (typeof window.isDailyEnabled !== 'undefined') {
                window.isDailyEnabled = !!task.is_daily;
            }
        }

        // Imposta timer
        const timerToggle = document.getElementById('timerToggle');
        const timerLabel = document.getElementById('timerLabel');
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerToggle && timerLabel && timerDisplay) {
            const timerEnabled = !!task.timer_enabled;
            timerToggle.checked = timerEnabled;

            if (timerEnabled) {
                timerLabel.style.display = 'none';
                timerDisplay.style.display = 'inline';
                if (window.updateTimerState) {
                    window.updateTimerState(true);
                }
            } else {
                timerLabel.style.display = 'inline';
                timerDisplay.style.display = 'none';
            }
        }

        // Imposta descrizione
        const taskDescription = document.getElementById('taskDescription');
        const addDescriptionRow = document.getElementById('addDescriptionRow');
        const descriptionRow = document.getElementById('descriptionRow');

        if (taskDescription && addDescriptionRow && descriptionRow) {
            if (task.description) {
                taskDescription.value = task.description;
                addDescriptionRow.style.display = 'none';
                descriptionRow.style.display = 'flex';

                if (typeof window.currentTaskDescription !== 'undefined') {
                    window.currentTaskDescription = task.description;
                }
            } else {
                taskDescription.value = '';
                addDescriptionRow.style.display = 'flex';
                descriptionRow.style.display = 'none';

                if (typeof window.currentTaskDescription !== 'undefined') {
                    window.currentTaskDescription = '';
                }
            }
        }

        // Imposta l'assegnazione
        const assignedToSelect = document.getElementById('assignedToSelect');
        if (assignedToSelect) {
            if (task.assigned_to) {
                assignedToSelect.value = task.assigned_to;
                if (typeof window.currentAssignedTo !== 'undefined') {
                    window.currentAssignedTo = task.assigned_to;
                }
            } else {
                assignedToSelect.value = '';
                if (typeof window.currentAssignedTo !== 'undefined') {
                    window.currentAssignedTo = '';
                }
            }
        }

        // Imposta tempo
        if (task.time_end_task) {
            const totalMinutes = task.time_end_task;
            const days = Math.floor(totalMinutes / (24 * 60));
            const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
            const minutes = totalMinutes % 60;

            const dayInput = document.getElementById('taskDays');
            const hourInput = document.getElementById('taskHours');
            const minuteInput = document.getElementById('taskMinutes');

            if (dayInput && hourInput && minuteInput) {
                // Solo se c'è un valore effettivo di tempo, mostra la sezione
                if (days > 0 || hours > 0 || minutes > 0) {
                    dayInput.value = days;
                    hourInput.value = hours;
                    minuteInput.value = minutes;

                    // Nascondi "Aggiungi tempo" e mostra i campi del tempo
                    const addTimeRow = document.getElementById('addTimeRow');
                    const timeSettingsRow = document.getElementById('timeSettingsRow');

                    if (addTimeRow && timeSettingsRow) {
                        addTimeRow.style.display = 'none';
                        timeSettingsRow.style.display = 'flex';
                    }

                    // Aggiorna le variabili globali
                    if (typeof window.savedTaskDays !== 'undefined') window.savedTaskDays = days;
                    if (typeof window.savedTaskHours !== 'undefined') window.savedTaskHours = hours;
                    if (typeof window.savedTaskMinutes !== 'undefined') window.savedTaskMinutes = minutes;
                }
            }
        }

        console.log('Form popolato con i dati della task:', task);
    }

    /**
     * Salva le impostazioni della task
     */
    saveSettings() {
        console.log('=== saveSettings chiamato nel popup ===');
        // Ottiene i valori dai campi del popup
        const taskDays = parseInt(document.getElementById('taskDays').value) || 0;
        const taskHours = parseInt(document.getElementById('taskHours').value) || 0;
        const taskMinutes = parseInt(document.getElementById('taskMinutes').value) || 0;
        const isDailyEnabled = document.getElementById('dailyToggle').checked;
        const timerEnabled = document.getElementById('timerToggle').checked;
        const taskDescription = document.getElementById('taskDescription').value.trim();
        const assignedTo = document.getElementById('assignedToSelect').value;

        console.log(`Giorni: ${taskDays}, Ore: ${taskHours}, Minuti: ${taskMinutes}`);
        console.log(`Giornaliera: ${isDailyEnabled}, Timer: ${timerEnabled}`);
        console.log(`Descrizione: ${taskDescription}`);
        console.log(`Assegnato a prima del salvataggio: ${assignedTo}`);

        // Salva i valori nelle variabili globali per essere usati durante la creazione della task
        window.savedTaskDays = taskDays;
        window.savedTaskHours = taskHours;
        window.savedTaskMinutes = taskMinutes;
        window.isDailyEnabled = isDailyEnabled;
        window.timerEnabled = timerEnabled;
        window.currentTaskDescription = taskDescription;
        window.currentAssignedTo = assignedTo;

        // Debug - verifica dopo l'assegnazione
        console.log(`Variabile window.currentAssignedTo dopo il salvataggio: ${window.currentAssignedTo}`);

        // Importante: Se c'è almeno un valore di tempo, imposta timeSettingsSaved a true
        const hasSomeTime = taskDays > 0 || taskHours > 0 || taskMinutes > 0;
        window.timeSettingsSaved = hasSomeTime;

        console.log(`Time settings saved: ${window.timeSettingsSaved}`);

        // Se stiamo modificando una task esistente
        if (window.currentEditingTaskId) {
            console.log(`Aggiornamento task esistente: ${window.currentEditingTaskId}`);

            // Prepara i dati per l'aggiornamento
            const taskData = {
                time_end_task: taskDays * 24 * 60 + taskHours * 60 + taskMinutes,
                is_daily: isDailyEnabled,
                timer_enabled: timerEnabled,
                description: taskDescription,
                assigned_to: assignedTo
            };

            // Aggiorna la task
            window.databaseService.updateTask(window.currentEditingTaskId, taskData)
                .then(updatedTask => {
                    console.log('Task aggiornata con successo:', updatedTask);

                    // Aggiorna l'interfaccia utente
                    if (typeof window.loadTasks === 'function') {
                        window.loadTasks();
                    }

                    this.showNotification('Task aggiornata con successo', 'success');
                })
                .catch(error => {
                    console.error('Errore durante l\'aggiornamento della task:', error);
                    this.showNotification('Errore durante l\'aggiornamento della task', 'error');
                });
        } else {
            console.log('Nessuna task esistente da aggiornare, i dati saranno usati per la prossima task');
            this.showNotification('Impostazioni salvate per la prossima task', 'success');
        }

        // Chiudi il popup
        this.hide();
        console.log('=== Fine saveSettings ===');
    }
}
