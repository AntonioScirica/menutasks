/**
 * Componente per la gestione delle task
 */

// Variabili per il drag and drop
let draggedTask = null;
let dragTargetTimeout = null;
let potentialParent = null;

/**
 * Carica le task di un progetto
 * @returns {Promise<void>}
 */
async function loadTasks() {
    if (!currentProjectId) {
        document.getElementById('taskList').innerHTML = '';
        document.getElementById('completedTasksList').innerHTML = '';
        updateInfoStats([]); // Aggiorna le statistiche con array vuoto
        return;
    }

    try {
        // Prima di caricare le task, verifica se ci sono task giornaliere da resettare
        const hasResetTasks = await checkDailyTasksForReset();
        if (hasResetTasks) {
            console.log('Task giornaliere resettate, proseguo con il caricamento delle task');
        }

        // Carica tutte le task del progetto corrente
        const tasks = await databaseService.loadTasks(currentProjectId);

        const taskList = document.getElementById('taskList');
        const completedTasksList = document.getElementById('completedTasksList');

        taskList.innerHTML = '';
        completedTasksList.innerHTML = '';

        // Se non ci sono task, resetta le statistiche
        if (!tasks || tasks.length === 0) {
            updateInfoStats([]); // Resetta tutti i contatori a zero
            return;
        }

        // Aggiorna le statistiche con tutte le task
        updateInfoStats(tasks);

        // Separa le task principali dalle subtask
        const mainTasks = tasks.filter(task => !task.parent_id);
        const subtasks = tasks.filter(task => task.parent_id);

        // Crea una mappa delle subtask per parent_id
        const subtasksMap = new Map();
        subtasks.forEach(subtask => {
            if (!subtasksMap.has(subtask.parent_id)) {
                subtasksMap.set(subtask.parent_id, []);
            }
            subtasksMap.get(subtask.parent_id).push(subtask);
        });

        // Separa le task completate dalle non completate
        const activeTasks = mainTasks.filter(task => !task.completed);
        const completedTasks = mainTasks.filter(task => task.completed);

        // Ordina le task attive usando l'ordinamento salvato o la posizione
        const orderedActiveTasks = getOrderedTasks(activeTasks, currentProjectId);

        // Ordina le subtask
        subtasksMap.forEach((taskSubtasks, parentId) => {
            subtasksMap.set(parentId, getOrderedSubtasks(taskSubtasks, parentId));
        });

        // Crea gli elementi per le task attive
        orderedActiveTasks.forEach(task => {
            createTaskElement(task.id, task.content, null, subtasksMap.get(task.id), task.priority, task.completed);
        });

        // Raggruppa le task completate per data
        if (completedTasks.length > 0) {
            // Ordina per data di completamento (più recenti prima)
            completedTasks.sort((a, b) => {
                const dateA = a.completed_at ? new Date(a.completed_at) :
                    (a.created_at ? new Date(a.created_at) : new Date(0));
                const dateB = b.completed_at ? new Date(b.completed_at) :
                    (b.created_at ? new Date(b.created_at) : new Date(0));
                return dateB - dateA;
            });

            // Crea una mappa per raggruppare per data
            const tasksByDate = new Map();

            completedTasks.forEach(task => {
                const dateKey = task.completed_at ?
                    formatDate(task.completed_at) : 'Data sconosciuta';

                if (!tasksByDate.has(dateKey)) {
                    tasksByDate.set(dateKey, []);
                }

                tasksByDate.get(dateKey).push(task);
            });

            // Crea sezioni per ogni data
            tasksByDate.forEach((tasks, dateKey) => {
                // Crea intestazione solo se ci sono task
                if (tasks && tasks.length > 0) {
                    const dateHeader = document.createElement('div');
                    dateHeader.className = 'completed-date-header';
                    dateHeader.textContent = dateKey;
                    completedTasksList.appendChild(dateHeader);

                    // Crea le task per questa data
                    tasks.forEach(task => {
                        createTaskElement(task.id, task.content, null, subtasksMap.get(task.id), task.priority, task.completed, task.completed_at);
                    });
                }
            });
        }

        // Aggiorna il contatore delle task completate
        updateCompletedCounter();

        // Inizializza i timer per le task attive
        timerService.initializeTaskTimers(activeTasks);
    } catch (error) {
        console.error('Errore durante il caricamento delle task:', error);
        showStatus('Errore durante il caricamento delle task', 'error');
    }
}

/**
 * Ottiene le task ordinate in base all'ordine salvato o alla posizione
 * @param {Array} tasks - Task da ordinare
 * @param {string} projectId - ID del progetto
 * @returns {Array} - Task ordinate
 */
function getOrderedTasks(tasks, projectId) {
    let orderedTasks = [...tasks];

    // Ottieni l'ordine salvato dal localStorage
    const savedOrder = localStorage.getItem(`taskOrder_${projectId}`);

    if (savedOrder) {
        const orderArray = JSON.parse(savedOrder);

        // Verifica che gli ID esistano ancora nei dati
        const validOrderArray = orderArray.filter(id =>
            tasks.some(task => task.id.toString() === id.toString())
        );

        if (validOrderArray.length > 0) {
            // Mappa gli ID nell'ordine salvato alle task reali
            const orderedTasksMap = new Map();
            tasks.forEach(task => {
                orderedTasksMap.set(task.id.toString(), task);
            });

            // Ordina in base all'ordine salvato
            orderedTasks = validOrderArray
                .map(id => orderedTasksMap.get(id.toString()))
                .filter(Boolean);

            // Aggiungi le task che non erano nell'ordine salvato
            const remainingTasks = tasks.filter(task =>
                !validOrderArray.includes(task.id.toString())
            );

            orderedTasks = [...orderedTasks, ...remainingTasks];
        } else {
            // Se l'ordine salvato non contiene ID validi, usa position
            orderedTasks.sort((a, b) => a.position - b.position);
        }
    } else {
        // Se non c'è un ordine salvato, usa position
        orderedTasks.sort((a, b) => a.position - b.position);
    }

    return orderedTasks;
}

/**
 * Ottiene le subtask ordinate in base all'ordine salvato o alla posizione
 * @param {Array} subtasks - Subtask da ordinare
 * @param {string} parentId - ID della task genitore
 * @returns {Array} - Subtask ordinate
 */
function getOrderedSubtasks(subtasks, parentId) {
    // Controlla se esiste un ordine salvato
    const savedOrder = localStorage.getItem(`subtaskOrder_${parentId}`);

    if (savedOrder) {
        try {
            const orderArray = JSON.parse(savedOrder);

            // Verifica che gli ID esistano ancora nelle subtask
            const validOrderArray = orderArray.filter(id =>
                subtasks.some(task => task.id.toString() === id.toString())
            );

            if (validOrderArray.length > 0) {
                // Mappa gli ID nell'ordine salvato alle subtask reali
                const orderedSubtasksMap = new Map();
                subtasks.forEach(task => {
                    orderedSubtasksMap.set(task.id.toString(), task);
                });

                // Ordina in base all'ordine salvato
                const orderedSubtasks = validOrderArray
                    .map(id => orderedSubtasksMap.get(id.toString()))
                    .filter(Boolean);

                // Aggiungi le subtask che non erano nell'ordine salvato
                const remainingSubtasks = subtasks.filter(task =>
                    !validOrderArray.includes(task.id.toString())
                );

                // Ritorna le subtask ordinate
                return [...orderedSubtasks, ...remainingSubtasks];
            }
        } catch (error) {
            console.error('Errore nel parsing dell\'ordine delle subtask:', error);
        }
    }

    // In caso di errore o se non c'è un ordine salvato, ordina per position
    return [...subtasks].sort((a, b) => a.position - b.position);
}

/**
 * Aggiorna le statistiche nella sezione info
 * @param {Array} tasks - Le task da analizzare
 */
function updateInfoStats(tasks) {
    if (!tasks || tasks.length === 0) {
        // Se non ci sono task, imposta tutti i contatori a zero
        document.getElementById('completedCount').textContent = '0';
        document.getElementById('totalTime').textContent = '0m';
        document.getElementById('urgentTasksCount').textContent = '0';
        document.getElementById('mediumTasksCount').textContent = '0';
        document.getElementById('basicTasksCount').textContent = '0';
        return;
    }

    // Conta le task completate
    const completedCount = tasks.filter(task => task.completed).length;
    document.getElementById('completedCount').textContent = completedCount;

    // Calcola il tempo totale sommando i valori di time_end_task
    let totalMinutes = 0;

    tasks.forEach(task => {
        // Se la task ha un valore time_end_task, sommalo
        if (task.time_end_task && !isNaN(task.time_end_task)) {
            totalMinutes += parseInt(task.time_end_task);
        }
    });

    // Aggiorna il tempo totale
    document.getElementById('totalTime').textContent = formatTotalTime(totalMinutes);

    // Filtra per escludere le task completate prima di contare per priorità
    const activeTasks = tasks.filter(task => !task.completed);

    // Aggiorna i contatori per priorità considerando solo le task attive
    const urgentCount = activeTasks.filter(task => task.priority === 'urgent').length;
    const mediumCount = activeTasks.filter(task => task.priority === 'medium').length;
    const basicCount = activeTasks.filter(task => task.priority === 'normal').length;

    document.getElementById('urgentTasksCount').textContent = urgentCount;
    document.getElementById('mediumTasksCount').textContent = mediumCount;
    document.getElementById('basicTasksCount').textContent = basicCount;
}

/**
 * Mostra/nasconde le task completate
 */
function toggleCompletedTasks() {
    const completedTasksList = document.getElementById('completedTasksList');
    const completedButton = document.getElementById('completedTasksButton');

    showCompletedTasks = !showCompletedTasks;

    if (showCompletedTasks) {
        completedTasksList.style.display = 'flex';
        completedButton.classList.add('active');
    } else {
        completedTasksList.style.display = 'none';
        completedButton.classList.remove('active');
    }
}

/**
 * Aggiorna il contatore delle task completate
 */
function updateCompletedCounter() {
    const completedTasks = document.getElementById('completedTasksList').querySelectorAll('.task-container').length;
    document.getElementById('completedCount').textContent = completedTasks.toString();

    // Mostra/nascondi il contatore in base al numero di task completate
    if (completedTasks > 0) {
        document.getElementById('completedCount').style.display = 'inline-flex';
    } else {
        document.getElementById('completedCount').style.display = 'inline-flex'; // Modificato per mostrare sempre il contatore

        // Se siamo nella vista delle task completate, torna alla vista normale
        if (showCompletedTasks) {
            toggleCompletedTasks();
        }
    }
}

/**
 * Crea un elemento task nell'interfaccia
 * @param {string} taskId - ID della task
 * @param {string} taskText - Testo della task
 * @param {string|null} parentId - ID della task genitore (null se è una task principale)
 * @param {Array} subtasks - Lista delle subtask
 * @param {string} priority - Priorità della task
 * @param {boolean} completed - Se la task è completata
 * @param {string|null} completed_at - Data di completamento (null se non completata)
 */
function createTaskElement(taskId, taskText, parentId = null, subtasks = [], priority = 'normal', completed = false, completed_at = null) {
    // Troveremo questo componente in un file separato
    // per non appesantire troppo questo file
}

/**
 * Aggiunge un nuovo task al progetto corrente
 */
async function addTask() {
    console.log('Chiamata addTask con timestamp:', new Date().toISOString());

    // Ottieni il valore di input
    const taskInput = document.getElementById('taskInput');
    if (!taskInput) {
        console.error('Elemento taskInput non trovato nel DOM');
        return;
    }

    // Verifica se c'è testo nell'input
    const taskContent = taskInput.value.trim();
    console.log('Contenuto input:', taskContent);

    if (!taskContent) {
        console.log('Input vuoto, task non aggiunto');
        return;
    }

    // Ottieni l'ID del progetto corrente
    const projectContainer = document.querySelector('.projects-container');
    if (!projectContainer) {
        console.error('Contenitore progetti non trovato nel DOM');
        return;
    }

    const projectId = projectContainer.dataset.currentProjectId;
    if (!projectId) {
        console.error('Nessun progetto selezionato');
        showStatus('Seleziona un progetto prima di aggiungere un task', 'error');
        return;
    }

    console.log(`Aggiunta task al progetto: ${projectId}`);

    try {
        // Crea il nuovo task
        const newTask = {
            project_id: projectId,
            content: taskContent,
            completed: false,
            created_at: new Date().getTime(),
            priority: 'normal', // Default priority
            date: null // No due date by default
        };

        console.log('Nuovo task creato:', newTask);

        // Salva il task nel database
        const savedTask = await databaseService.addTask(newTask);
        console.log('Task salvato nel database:', savedTask);

        // Aggiungi il task alla UI
        const tasks = await databaseService.getTasksByProject(projectId);
        renderTasks(tasks);

        // Pulisci l'input e rimuovi la classe has-text
        taskInput.value = '';
        taskInput.classList.remove('has-text');

        // Trova e rimuovi la classe has-text dal contenitore
        const taskInputContainer = document.querySelector('.task-input-container');
        if (taskInputContainer) {
            taskInputContainer.classList.remove('has-text');
            console.log('Classe has-text rimossa dal contenitore');
        }

        // Forza l'aggiornamento dell'interfaccia
        taskInput.dispatchEvent(new Event('input'));

        console.log('Task aggiunto con successo');
    } catch (error) {
        console.error('Errore nell\'aggiunta del task:', error);
        showStatus('Errore nell\'aggiunta del task', 'error');
    }
}

/**
 * Attiva/disattiva il filtro per priorità
 * @param {string} priority - Priorità da filtrare ('urgent', 'medium', 'basic')
 */
function togglePriorityFilter(priority) {
    // Inverti lo stato del filtro
    activePriorityFilters[priority] = !activePriorityFilters[priority];

    // Aggiorna la visualizzazione del filtro
    const filterElement = document.getElementById(`${priority}Filter`);
    if (filterElement) {
        if (activePriorityFilters[priority]) {
            filterElement.classList.add('active');
        } else {
            filterElement.classList.remove('active');
        }
    }

    // Applica i filtri alle task
    applyPriorityFilters();
}

/**
 * Applica i filtri di priorità alle task
 */
function applyPriorityFilters() {
    // Verifica se c'è almeno un filtro attivo
    const hasActiveFilters = Object.values(activePriorityFilters).some(active => active);

    // Ottieni tutte le task non completate
    const taskItems = document.querySelectorAll('#taskList .task-item:not(.completed)');

    if (hasActiveFilters) {
        // Se ci sono filtri attivi, nascondi tutte le task
        taskItems.forEach(task => {
            task.closest('.task-container').style.display = 'none';
        });

        // Poi mostra solo quelle che corrispondono ai filtri attivi
        taskItems.forEach(task => {
            const hasPriority = (
                (activePriorityFilters.urgent && task.classList.contains('priority-urgent')) ||
                (activePriorityFilters.medium && task.classList.contains('priority-medium')) ||
                (activePriorityFilters.basic && task.classList.contains('priority-normal'))
            );

            if (hasPriority) {
                task.closest('.task-container').style.display = 'flex';
            }
        });
    } else {
        // Se non ci sono filtri attivi, mostra tutte le task
        taskItems.forEach(task => {
            task.closest('.task-container').style.display = 'flex';
        });
    }
}

/**
 * Salva l'ordine delle task
 */
function saveTaskOrder() {
    // Salva l'ordine delle task principali
    const taskOrder = [];
    document.querySelectorAll('#taskList > .task-container').forEach(container => {
        taskOrder.push(container.dataset.taskId);
    });

    // Salva l'ordine nel localStorage
    if (currentProjectId && taskOrder.length > 0) {
        localStorage.setItem(`taskOrder_${currentProjectId}`, JSON.stringify(taskOrder));
    }
}

/**
 * Mostra un messaggio di stato
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo di messaggio ('success', 'error', 'info')
 */
function showStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');

    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.opacity = '1';

    // Nascondi dopo 3 secondi
    setTimeout(() => {
        statusMessage.style.opacity = '0';
    }, 3000);
} 