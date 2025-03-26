/**
 * Componente per la gestione dei task
 * Si occupa del rendering e dell'aggiornamento dei task nell'interfaccia
 */
class TaskComponent {
    constructor(appState, databaseService, timerService) {
        this.appState = appState;
        this.db = databaseService;
        this.timerService = timerService;

        // Cache degli elementi DOM
        this.elements = {
            taskList: document.getElementById('taskList'),
            completedTasksList: document.getElementById('completedTasksList')
        };

        // Mappa dei task renderizzati
        this.renderedTasks = new Map();

        // Riferimenti agli ascoltatori
        this.listeners = {
            unsubscribeActive: null,
            unsubscribeCompleted: null
        };

        // Stato locale
        this.dragState = {
            dragging: false,
            draggedElement: null,
            originalIndex: -1,
            currentHover: null
        };

        // Timer per controllo aggiornamento task giornalieri
        this.dailyTasksTimer = null;
        this.lastDayChecked = null;
    }

    /**
     * Inizializza il componente
     */
    initialize() {
        console.log('TaskComponent: Inizializzazione...');

        // Registra gli ascoltatori per lo stato
        this.registerStateListeners();

        // Registra ascoltatori per eventi DOM
        this.setupEventListeners();

        // Avvia il timer per i task giornalieri
        this.startDailyTasksChecker();

        console.log('TaskComponent: Inizializzazione completata');
    }

    /**
     * Avvia il controllo periodico dei task giornalieri
     */
    startDailyTasksChecker() {
        // Controlla subito al primo avvio
        this.checkAndResetDailyTasks();

        // Controlla ogni minuto
        this.dailyTasksTimer = setInterval(() => {
            this.checkAndResetDailyTasks();
        }, 60000); // Controllo ogni minuto
    }

    /**
     * Controlla se è necessario ripristinare i task giornalieri
     */
    checkAndResetDailyTasks() {
        const now = new Date();
        const currentDay = now.toDateString();

        // Se è un nuovo giorno o è la prima volta che controlliamo
        if (this.lastDayChecked !== currentDay) {
            console.log('TaskComponent: Nuovo giorno rilevato, aggiornamento task giornalieri');

            // Aggiorna la data dell'ultimo controllo
            this.lastDayChecked = currentDay;

            // Se siamo vicini alla mezzanotte (23:55-00:05) o è la prima esecuzione
            if (this.isNearMidnight(now) || !this.lastDayChecked) {
                this.resetDailyTasks();
            }
        }
    }

    /**
     * Controlla se l'ora corrente è vicina alla mezzanotte
     * @param {Date} date - Data corrente
     * @returns {boolean} - True se siamo vicini alla mezzanotte
     */
    isNearMidnight(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();

        // Consideriamo "vicino alla mezzanotte" tra le 23:55 e le 00:05
        return (hours === 23 && minutes >= 55) || (hours === 0 && minutes <= 5);
    }

    /**
     * Ripristina i task giornalieri
     */
    async resetDailyTasks() {
        try {
            // Ottieni il progetto attivo
            const activeProject = this.appState.getState('activeProject');
            if (!activeProject) return;

            // Carica i task dal database
            const tasks = await this.db.getTasksByProject(activeProject.id);
            const dailyTasks = tasks.filter(task => task.is_daily);

            let taskUpdated = false;

            // Per ogni task giornaliero completato, reimpostalo come non completato
            for (const task of dailyTasks) {
                if (task.completed) {
                    // Aggiorna nel database
                    const updatedTask = await this.db.updateTask(task.id, {
                        completed: false,
                        completed_at: null
                    });

                    // Aggiorna nello stato
                    this.appState.updateTask(updatedTask);
                    taskUpdated = true;
                }
            }

            // Forza il ricaricamento e la renderizzazione di tutti i task
            await this.loadAndRenderTasks(activeProject.id);

            // Emetti un evento personalizzato per notificare l'aggiornamento dei task giornalieri
            if (taskUpdated) {
                const event = new CustomEvent('dailyTasksReset', {
                    detail: { projectId: activeProject.id }
                });
                document.dispatchEvent(event);
            }

            console.log('TaskComponent: Task giornalieri ripristinati');
        } catch (error) {
            console.error('TaskComponent: Errore durante il ripristino dei task giornalieri', error);
        }
    }

    /**
     * Registra gli ascoltatori per lo stato
     */
    registerStateListeners() {
        // Ascoltatore per i task attivi
        this.listeners.unsubscribeActive = this.appState.subscribe('activeProject', (project) => {
            if (project) {
                // Quando cambia il progetto attivo, carica e renderizza i task
                this.loadAndRenderTasks(project.id);
            } else {
                // Nessun progetto attivo, svuota la lista
                this.clearTaskList();
            }
        });

        // Ascoltatore per i filtri
        this.appState.subscribe('filters', (filters) => {
            // Quando cambiano i filtri, aggiorna la visualizzazione
            this.applyFilters(filters);
        });
    }

    /**
     * Configura gli ascoltatori per gli eventi DOM
     */
    setupEventListeners() {
        // Assicurati che gli elementi esistano
        if (!this.elements.taskList || !this.elements.completedTasksList) {
            console.error('TaskComponent: Elementi DOM necessari non trovati');
            return;
        }

        // Eventi di drag and drop
        this.elements.taskList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.elements.taskList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.elements.taskList.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.elements.taskList.addEventListener('drop', this.handleDrop.bind(this));
        this.elements.taskList.addEventListener('dragend', this.handleDragEnd.bind(this));

        // Eventi per task completati
        this.elements.completedTasksList.addEventListener('click', this.handleCompletedTaskClick.bind(this));
    }

    /**
     * Carica e renderizza i task di un progetto
     * @param {number|string} projectId - ID del progetto
     */
    async loadAndRenderTasks(projectId) {
        try {
            console.log(`TaskComponent: Caricamento task per progetto ${projectId}`);

            // Carica i task dal database
            const tasks = await this.db.getTasksByProject(projectId);

            // Aggiorna lo stato dell'app
            this.appState.updateProjectTasks(tasks);

            // Svuota e renderizza la lista
            this.renderTasks(tasks);

            console.log(`TaskComponent: Caricati e renderizzati ${tasks.length} task`);
        } catch (error) {
            console.error('TaskComponent: Errore nel caricamento dei task', error);
        }
    }

    /**
     * Renderizza tutti i task
     * @param {Array} tasks - Array di task da renderizzare
     */
    renderTasks(tasks) {
        // Pulisci liste esistenti
        this.clearTaskList();

        // Dividi task completati e non completati
        const activeTasks = tasks.filter(task => !task.completed);
        const completedTasks = tasks.filter(task => task.completed);

        // Ordina i task attivi per posizione
        const sortedActiveTasks = this.sortTasks(activeTasks);

        // Ordina i task completati per data di completamento
        const sortedCompletedTasks = this.sortCompletedTasks(completedTasks);

        // Renderizza i task attivi
        sortedActiveTasks.forEach(task => {
            this.renderTask(task);
        });

        // Renderizza i task completati
        sortedCompletedTasks.forEach(task => {
            this.renderTask(task, true);
        });

        // Aggiorna i timer attivi
        this.updateTimers();
    }

    /**
     * Renderizza un singolo task
     * @param {Object} task - Task da renderizzare
     * @param {boolean} [isCompleted=false] - Se il task è completato
     * @returns {HTMLElement} - Elemento DOM creato
     */
    renderTask(task, isCompleted = false) {
        const container = isCompleted ? this.elements.completedTasksList : this.elements.taskList;

        if (!container) {
            console.error(`TaskComponent: Contenitore ${isCompleted ? 'completedTasksList' : 'taskList'} non trovato`);
            return null;
        }

        // Crea elemento task
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.dataset.id = task.id;
        taskElement.dataset.position = task.position || 0;
        taskElement.draggable = !isCompleted;

        // Aggiungi classe completato se necessario
        if (task.completed) {
            taskElement.classList.add('completed');
        }

        // Aggiungi priorità come classe
        if (task.priority) {
            taskElement.classList.add(`priority-${task.priority}`);
        }

        // Aggiungi classe per task giornalieri
        if (task.is_daily) {
            taskElement.classList.add('daily');
        }

        // Struttura HTML
        taskElement.innerHTML = `
            <div class="task-checkbox-container">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}">
                    <svg class="checkmark" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path>
                    </svg>
                </div>
            </div>
            <div class="task-content" contenteditable="false">${task.content}</div>
            <div class="task-actions">
                ${this.renderTaskTimerSection(task)}
                <div class="task-priority">
                    <button class="priority-button ${task.priority === 'urgent' ? 'active' : ''}" data-priority="urgent" title="Urgente">
                        <i data-lucide="flame" class="icon-flame"></i>
                    </button>
                    <button class="priority-button ${task.priority === 'medium' ? 'active' : ''}" data-priority="medium" title="Media">
                        <i data-lucide="alert-circle" class="icon-alert-circle"></i>
                    </button>
                    <button class="priority-button ${task.priority === 'normal' ? 'active' : ''}" data-priority="normal" title="Normale">
                        <i data-lucide="circle" class="icon-circle"></i>
                    </button>
                </div>
                <button class="task-menu-button">
                    <i data-lucide="more-vertical" class="icon-more-vertical"></i>
                    <div class="task-menu">
                        <div class="task-menu-option edit" data-action="edit">
                            <i data-lucide="edit" class="icon-edit"></i>
                            <span>Modifica</span>
                        </div>
                        <div class="task-menu-option delete" data-action="delete">
                            <i data-lucide="trash" class="icon-trash"></i>
                            <span>Elimina</span>
                        </div>
                    </div>
                </button>
            </div>
        `;

        // Aggiungi gli event listener
        this.attachTaskEventListeners(taskElement, task);

        // Aggiungi al container
        container.appendChild(taskElement);

        // Inizializza le icone
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ scope: taskElement });
        }

        // Salva il riferimento nella mappa
        this.renderedTasks.set(task.id, taskElement);

        return taskElement;
    }

    /**
     * Renderizza la sezione timer del task
     * @param {Object} task - Task da renderizzare
     * @returns {string} - HTML per la sezione timer
     */
    renderTaskTimerSection(task) {
        // Se il task non ha un timer, mostra solo l'icona timer
        if (!task.time_end_task && !task.timer_enabled) {
            return `
                <div class="task-timer" title="Aggiungi timer">
                    <i data-lucide="timer" class="icon-timer"></i>
                </div>
            `;
        }

        // Controlla se c'è un timer attivo per questo task
        const timer = this.timerService.getTimer(task.id);
        const hasActiveTimer = timer && !timer.completed;

        // Se c'è solo un tempo stimato (non un timer attivo)
        if (task.time_end_task && !hasActiveTimer) {
            const formattedTime = this.formatTaskTime(task.time_end_task);

            return `
                <div class="task-timer with-time" title="Tempo stimato: ${formattedTime}">
                    <i data-lucide="timer" class="icon-timer"></i>
                    <span class="timer-time">${formattedTime}</span>
                </div>
            `;
        }

        // Se c'è un timer attivo
        if (hasActiveTimer) {
            const formattedTime = this.timerService.formatTime(timer.timeLeft);
            const timerStatus = timer.running ? 'running' : 'paused';

            return `
                <div class="task-timer active ${timerStatus}" data-timer-id="${task.id}" title="Timer attivo">
                    <i data-lucide="${timer.running ? 'pause' : 'play'}" class="icon-timer-control"></i>
                    <span class="timer-time">${formattedTime}</span>
                </div>
            `;
        }
    }

    /**
     * Formatta il tempo di un task in un formato leggibile
     * @param {number} timeMs - Tempo in millisecondi
     * @returns {string} - Tempo formattato (es. "2h 30m")
     */
    formatTaskTime(timeMs) {
        const days = Math.floor(timeMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));

        let result = '';

        if (days > 0) {
            result += `${days}d `;
        }

        if (hours > 0 || days > 0) {
            result += `${hours}h `;
        }

        if (minutes > 0 || (days === 0 && hours === 0)) {
            result += `${minutes}m`;
        }

        return result.trim();
    }

    /**
     * Aggiunge gli ascoltatori di eventi a un elemento task
     * @param {HTMLElement} taskElement - Elemento DOM del task
     * @param {Object} task - Dati del task
     */
    attachTaskEventListeners(taskElement, task) {
        // Checkbox per completamento
        const checkbox = taskElement.querySelector('.task-checkbox');
        if (checkbox) {
            checkbox.addEventListener('click', () => this.toggleTaskCompletion(task));
        }

        // Contenuto del task (doppio click per modificare)
        const content = taskElement.querySelector('.task-content');
        if (content) {
            content.addEventListener('dblclick', () => this.editTaskContent(taskElement, task));
            content.addEventListener('blur', (event) => this.saveTaskContent(event, task));
            content.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.target.blur();
                }
            });
        }

        // Pulsanti priorità
        const priorityButtons = taskElement.querySelectorAll('.priority-button');
        priorityButtons.forEach(button => {
            button.addEventListener('click', () => {
                const priority = button.dataset.priority;
                this.updateTaskPriority(task, priority);
            });
        });

        // Menu task
        const menuButton = taskElement.querySelector('.task-menu-button');
        if (menuButton) {
            menuButton.addEventListener('click', (event) => {
                event.stopPropagation();
                menuButton.classList.toggle('active');
            });

            // Opzioni del menu
            const menuOptions = taskElement.querySelectorAll('.task-menu-option');
            menuOptions.forEach(option => {
                option.addEventListener('click', (event) => {
                    event.stopPropagation();
                    menuButton.classList.remove('active');

                    const action = option.dataset.action;
                    if (action === 'edit') {
                        this.editTaskContent(taskElement, task);
                    } else if (action === 'delete') {
                        this.deleteTask(task);
                    }
                });
            });
        }

        // Timer
        const timerElement = taskElement.querySelector('.task-timer');
        if (timerElement) {
            timerElement.addEventListener('click', () => this.handleTimerClick(task));
        }

        // Chiudi menu cliccando fuori
        document.addEventListener('click', () => {
            const activeMenus = document.querySelectorAll('.task-menu-button.active');
            activeMenus.forEach(menu => menu.classList.remove('active'));
        });
    }

    /**
     * Gestisce il click sul timer di un task
     * @param {Object} task - Task associato al timer
     */
    handleTimerClick(task) {
        // Verifica se c'è un timer attivo
        const timer = this.timerService.getTimer(task.id);

        if (timer) {
            // Timer esiste già, alterna pausa/avvio
            if (timer.running) {
                this.timerService.pauseTimer(task.id);
            } else {
                this.timerService.resumeTimer(task.id);
            }

            // Aggiorna la visualizzazione
            this.updateTaskTimer(task.id);
        } else {
            // Nessun timer attivo, mostra impostazioni timer
            this.showTimerSettings(task);
        }
    }

    /**
     * Mostra le impostazioni del timer
     * @param {Object} task - Task associato al timer
     */
    showTimerSettings(task) {
        // Qui si integrerebbe con un componente per le impostazioni del timer
        // Per ora implementiamo una versione base

        // Durata predefinita (25 minuti)
        const defaultDuration = 25 * 60 * 1000;

        // Usa durata dal task se disponibile
        const duration = task.time_end_task || defaultDuration;

        // Avvia il timer
        this.timerService.startTimer(task.id, duration, {
            taskName: task.content
        });

        // Aggiorna la visualizzazione
        this.updateTaskTimer(task.id);
    }

    /**
     * Aggiorna la visualizzazione del timer di un task
     * @param {number|string} taskId - ID del task
     */
    updateTaskTimer(taskId) {
        const taskElement = this.renderedTasks.get(taskId);
        if (!taskElement) return;

        const timerContainer = taskElement.querySelector('.task-timer');
        if (!timerContainer) return;

        const timer = this.timerService.getTimer(taskId);
        if (!timer) return;

        // Aggiorna classi
        timerContainer.classList.add('active');
        timerContainer.classList.toggle('running', timer.running);
        timerContainer.classList.toggle('paused', !timer.running);

        // Aggiorna icona
        const iconElement = timerContainer.querySelector('i');
        if (iconElement) {
            iconElement.setAttribute('data-lucide', timer.running ? 'pause' : 'play');
            // Aggiorna l'icona
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ scope: timerContainer });
            }
        }

        // Aggiorna tempo
        let timeText = timerContainer.querySelector('.timer-time');
        if (!timeText) {
            timeText = document.createElement('span');
            timeText.className = 'timer-time';
            timerContainer.appendChild(timeText);
        }

        // Formatta il tempo
        timeText.textContent = this.timerService.formatTime(timer.timeLeft);
    }

    /**
     * Aggiorna tutti i timer visualizzati
     */
    updateTimers() {
        const timers = this.timerService.getAllTimers();

        for (const taskId in timers) {
            this.updateTaskTimer(taskId);
        }
    }

    /**
     * Alterna lo stato di completamento di un task
     * @param {Object} task - Task da aggiornare
     */
    async toggleTaskCompletion(task) {
        try {
            const newCompletionState = !task.completed;
            const completedAt = newCompletionState ? new Date().getTime() : null;

            // Aggiorna nel database
            const updatedTask = await this.db.updateTask(task.id, {
                completed: newCompletionState,
                completed_at: completedAt
            });

            // Aggiorna nello stato
            this.appState.updateTask(updatedTask);

            // Aggiorna la visualizzazione
            this.updateTaskUI(updatedTask);

            console.log(`TaskComponent: Task ${task.id} ${newCompletionState ? 'completato' : 'riattivato'}`);

            // Se il task è stato completato, ferma eventuali timer
            if (newCompletionState) {
                this.timerService.stopTimer(task.id);
            }
        } catch (error) {
            console.error('TaskComponent: Errore durante l\'aggiornamento del completamento', error);
        }
    }

    /**
     * Abilita la modifica del contenuto di un task
     * @param {HTMLElement} taskElement - Elemento DOM del task
     * @param {Object} task - Dati del task
     */
    editTaskContent(taskElement, task) {
        const content = taskElement.querySelector('.task-content');
        if (!content) return;

        // Abilita la modifica
        content.contentEditable = 'true';
        content.focus();

        // Seleziona tutto il testo
        const range = document.createRange();
        range.selectNodeContents(content);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Salva il contenuto modificato di un task
     * @param {Event} event - Evento blur
     * @param {Object} task - Dati del task
     */
    async saveTaskContent(event, task) {
        const content = event.target;
        content.contentEditable = 'false';

        const newContent = content.textContent.trim();

        // Se il contenuto non è cambiato, non fare nulla
        if (newContent === task.content) {
            return;
        }

        // Se il contenuto è vuoto, ripristina il valore precedente
        if (newContent === '') {
            content.textContent = task.content;
            return;
        }

        try {
            // Aggiorna nel database
            const updatedTask = await this.db.updateTask(task.id, {
                content: newContent
            });

            // Aggiorna nello stato
            this.appState.updateTask(updatedTask);

            console.log(`TaskComponent: Aggiornato contenuto del task ${task.id}`);
        } catch (error) {
            console.error('TaskComponent: Errore durante l\'aggiornamento del contenuto', error);
            // Ripristina il valore precedente in caso di errore
            content.textContent = task.content;
        }
    }

    /**
     * Aggiorna la priorità di un task
     * @param {Object} task - Task da aggiornare
     * @param {string} priority - Nuova priorità ('urgent', 'medium', 'normal')
     */
    async updateTaskPriority(task, priority) {
        // Se la priorità è già impostata, la togliamo (imposta a normal)
        const newPriority = task.priority === priority ? 'normal' : priority;

        try {
            // Aggiorna nel database
            const updatedTask = await this.db.updateTaskPriority(task.id, newPriority);

            // Aggiorna nello stato
            this.appState.updateTask(updatedTask);

            // Aggiorna la visualizzazione
            this.updateTaskUI(updatedTask);

            console.log(`TaskComponent: Aggiornata priorità del task ${task.id} a ${newPriority}`);
        } catch (error) {
            console.error('TaskComponent: Errore durante l\'aggiornamento della priorità', error);
        }
    }

    /**
     * Elimina un task
     * @param {Object} task - Task da eliminare
     */
    async deleteTask(task) {
        if (!confirm('Sei sicuro di voler eliminare questo task?')) {
            return;
        }

        try {
            // Elimina dal database
            await this.db.deleteTask(task.id);

            // Elimina dallo stato
            this.appState.removeTask(task.id, task.project_id);

            // Elimina eventuali timer
            this.timerService.deleteTimer(task.id);

            // Rimuovi dalla visualizzazione
            const taskElement = this.renderedTasks.get(task.id);
            if (taskElement) {
                taskElement.remove();
                this.renderedTasks.delete(task.id);
            }

            console.log(`TaskComponent: Task ${task.id} eliminato`);
        } catch (error) {
            console.error('TaskComponent: Errore durante l\'eliminazione del task', error);
        }
    }

    /**
     * Aggiorna l'UI di un task in base ai dati aggiornati
     * @param {Object} task - Task aggiornato
     */
    updateTaskUI(task) {
        // Trova l'elemento del task
        const taskElement = this.renderedTasks.get(task.id);
        if (!taskElement) {
            console.warn(`TaskComponent: Task ${task.id} non trovato nella mappa renderizzati`);
            return;
        }

        // Aggiorna la classe completato
        taskElement.classList.toggle('completed', task.completed);

        // Aggiorna la checkbox
        const checkbox = taskElement.querySelector('.task-checkbox');
        if (checkbox) {
            checkbox.classList.toggle('checked', task.completed);
        }

        // Aggiorna il contenuto
        const content = taskElement.querySelector('.task-content');
        if (content) {
            content.textContent = task.content;
        }

        // Aggiorna la priorità
        taskElement.className = taskElement.className.replace(/priority-\w+/g, '');
        if (task.priority) {
            taskElement.classList.add(`priority-${task.priority}`);
        }

        const priorityButtons = taskElement.querySelectorAll('.priority-button');
        priorityButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.priority === task.priority);
        });

        // Aggiorna il timer se necessario
        if (task.time_end_task) {
            const timerElement = taskElement.querySelector('.task-timer');
            if (timerElement) {
                const timeText = timerElement.querySelector('.timer-time');
                if (timeText) {
                    timeText.textContent = this.formatTaskTime(task.time_end_task);
                }
            }
        }

        // Se il task è stato completato, spostalo nella lista dei completati
        if (task.completed && taskElement.parentElement === this.elements.taskList) {
            taskElement.remove();
            this.elements.completedTasksList.appendChild(taskElement);
            taskElement.draggable = false;
        }
        // Se il task è stato riattivato, spostalo nella lista principale
        else if (!task.completed && taskElement.parentElement === this.elements.completedTasksList) {
            taskElement.remove();
            this.elements.taskList.appendChild(taskElement);
            taskElement.draggable = true;

            // Riordina i task
            this.reorderTasksInDOM();
        }
    }

    /**
     * Applica i filtri ai task
     * @param {Object} filters - Filtri da applicare
     */
    applyFilters(filters) {
        // Applica i filtri a tutti i task renderizzati
        this.renderedTasks.forEach((taskElement, taskId) => {
            let visible = true;

            // Filtro per completati
            if (!filters.showCompleted && taskElement.classList.contains('completed')) {
                visible = false;
            }

            // Filtro per priorità
            if (filters.priorities && filters.priorities.length > 0) {
                const taskPriority = Array.from(taskElement.classList)
                    .find(cls => cls.startsWith('priority-'))
                    ?.replace('priority-', '');

                if (!filters.priorities.includes(taskPriority)) {
                    visible = false;
                }
            }

            // Filtro per ricerca
            if (filters.searchQuery && filters.searchQuery.trim() !== '') {
                const query = filters.searchQuery.trim().toLowerCase();
                const content = taskElement.querySelector('.task-content')?.textContent.toLowerCase();

                if (!content || !content.includes(query)) {
                    visible = false;
                }
            }

            // Applica visibilità
            taskElement.style.display = visible ? 'flex' : 'none';
        });

        // Aggiorna visibilità lista completati
        if (this.elements.completedTasksList) {
            this.elements.completedTasksList.style.display =
                filters.showCompleted ? 'block' : 'none';
        }
    }

    /**
     * Gestisce l'inizio del drag
     * @param {DragEvent} event - Evento dragstart
     */
    handleDragStart(event) {
        if (!event.target.classList.contains('task-item')) return;

        this.dragState.dragging = true;
        this.dragState.draggedElement = event.target;

        // Salva l'indice originale
        const taskItems = Array.from(this.elements.taskList.querySelectorAll('.task-item:not(.completed)'));
        this.dragState.originalIndex = taskItems.indexOf(event.target);

        // Aggiungi classe di trascinamento
        event.target.classList.add('dragging');

        // Imposta i dati trasferiti
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', event.target.dataset.id);
    }

    /**
     * Gestisce l'evento dragover
     * @param {DragEvent} event - Evento dragover
     */
    handleDragOver(event) {
        event.preventDefault();

        if (!this.dragState.dragging) return;

        // Trova l'elemento target valido
        const targetElement = event.target.closest('.task-item');
        if (!targetElement || targetElement.classList.contains('completed')) return;

        // Non fare nulla se siamo sullo stesso elemento
        if (targetElement === this.dragState.draggedElement) return;

        // Rimuovi highlight precedente
        if (this.dragState.currentHover && this.dragState.currentHover !== targetElement) {
            this.dragState.currentHover.classList.remove('drag-over');
        }

        // Aggiungi highlight
        targetElement.classList.add('drag-over');
        this.dragState.currentHover = targetElement;
    }

    /**
     * Gestisce l'evento dragleave
     * @param {DragEvent} event - Evento dragleave
     */
    handleDragLeave(event) {
        const targetElement = event.target.closest('.task-item');
        if (targetElement) {
            targetElement.classList.remove('drag-over');
        }
    }

    /**
     * Gestisce l'evento drop
     * @param {DragEvent} event - Evento drop
     */
    handleDrop(event) {
        event.preventDefault();

        if (!this.dragState.dragging) return;

        // Trova l'elemento target valido
        const targetElement = event.target.closest('.task-item');
        if (!targetElement || targetElement.classList.contains('completed')) return;

        // Rimuovi classe di highlight
        targetElement.classList.remove('drag-over');

        // Se abbiamo rilasciato su un altro elemento
        if (targetElement !== this.dragState.draggedElement) {
            // Ottieni tutte le task visibili e non completate
            const tasks = Array.from(this.elements.taskList.querySelectorAll('.task-item:not(.completed)'));

            // Trova l'indice di destinazione
            const targetIndex = tasks.indexOf(targetElement);

            // Sposta l'elemento nel DOM
            if (targetIndex > this.dragState.originalIndex) {
                targetElement.parentNode.insertBefore(this.dragState.draggedElement, targetElement.nextSibling);
            } else {
                targetElement.parentNode.insertBefore(this.dragState.draggedElement, targetElement);
            }

            // Aggiorna le posizioni nel database
            this.updateTaskPositions();
        }
    }

    /**
     * Gestisce la fine del drag
     * @param {DragEvent} event - Evento dragend
     */
    handleDragEnd(event) {
        // Rimuovi classe di trascinamento
        event.target.classList.remove('dragging');

        // Reset dello stato
        this.dragState.dragging = false;
        this.dragState.draggedElement = null;
        this.dragState.originalIndex = -1;

        // Rimuovi highlight da tutti gli elementi
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    /**
     * Aggiorna le posizioni dei task dopo un cambiamento nell'ordine
     */
    async updateTaskPositions() {
        try {
            // Ottieni tutti i task visibili e non completati
            const taskElements = Array.from(this.elements.taskList.querySelectorAll('.task-item:not(.completed)'));

            // Per ogni elemento, aggiorna la posizione
            for (let i = 0; i < taskElements.length; i++) {
                const taskId = taskElements[i].dataset.id;
                const newPosition = i;

                // Aggiorna la posizione nell'elemento DOM
                taskElements[i].dataset.position = newPosition;

                // Aggiorna nel database
                await this.db.updateTaskPosition(taskId, newPosition);
            }

            console.log('TaskComponent: Posizioni dei task aggiornate');
        } catch (error) {
            console.error('TaskComponent: Errore durante l\'aggiornamento delle posizioni', error);
        }
    }

    /**
     * Gestisce i click sui task completati
     * @param {Event} event - Evento click
     */
    handleCompletedTaskClick(event) {
        const taskElement = event.target.closest('.task-item');
        if (!taskElement) return;

        // Se è un click sulla checkbox, gestisci il cambio di stato
        if (event.target.closest('.task-checkbox')) {
            const taskId = taskElement.dataset.id;
            const projectId = this.appState.getState('activeProject')?.id;

            if (!projectId) return;

            // Trova il task nello stato
            const tasks = this.appState.getState(`tasks.${projectId}`) || [];
            const task = tasks.find(t => t.id == taskId);

            if (task) {
                this.toggleTaskCompletion(task);
            }
        }
    }

    /**
     * Ordina i task in base alla posizione
     * @param {Array} tasks - Array di task da ordinare
     * @returns {Array} - Task ordinati
     */
    sortTasks(tasks) {
        return [...tasks].sort((a, b) => {
            // Prima per posizione (se definita)
            if (a.position !== undefined && b.position !== undefined) {
                return a.position - b.position;
            }

            // Poi per data di creazione
            return new Date(a.created_at) - new Date(b.created_at);
        });
    }

    /**
     * Ordina i task completati in base alla data di completamento
     * @param {Array} tasks - Array di task completati da ordinare
     * @returns {Array} - Task ordinati
     */
    sortCompletedTasks(tasks) {
        return [...tasks].sort((a, b) => {
            // Prima per data di completamento (dal più recente)
            if (a.completed_at && b.completed_at) {
                return new Date(b.completed_at) - new Date(a.completed_at);
            }

            // Poi per data di creazione
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    /**
     * Riordina fisicamente i task nel DOM in base alla posizione
     */
    reorderTasksInDOM() {
        // Ottieni tutti i task non completati
        const taskElements = Array.from(this.elements.taskList.querySelectorAll('.task-item:not(.completed)'));

        // Ordina in base alla posizione
        taskElements.sort((a, b) => {
            return parseInt(a.dataset.position || 0) - parseInt(b.dataset.position || 0);
        });

        // Rimuovi tutti i task dalla lista
        taskElements.forEach(el => el.remove());

        // Reinserisci in ordine corretto
        taskElements.forEach(el => {
            this.elements.taskList.appendChild(el);
        });
    }

    /**
     * Svuota le liste dei task
     */
    clearTaskList() {
        if (this.elements.taskList) {
            this.elements.taskList.innerHTML = '';
        }

        if (this.elements.completedTasksList) {
            this.elements.completedTasksList.innerHTML = '';
        }

        // Resetta la mappa dei task renderizzati
        this.renderedTasks.clear();
    }

    /**
     * Pulisce le risorse utilizzate dal componente
     */
    cleanup() {
        // Cancella gli ascoltatori
        if (this.listeners.unsubscribeActive) {
            this.listeners.unsubscribeActive();
        }

        if (this.listeners.unsubscribeCompleted) {
            this.listeners.unsubscribeCompleted();
        }

        // Ferma il timer per i task giornalieri
        if (this.dailyTasksTimer) {
            clearInterval(this.dailyTasksTimer);
            this.dailyTasksTimer = null;
        }

        // Svuota le liste
        this.clearTaskList();
    }
}

export default TaskComponent; 