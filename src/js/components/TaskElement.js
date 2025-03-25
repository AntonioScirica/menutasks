/**
 * Componente per la creazione e gestione degli elementi task nell'interfaccia
 */

/**
 * Crea un elemento task nell'interfaccia
 * @param {string} taskId - ID della task
 * @param {string} taskText - Testo della task
 * @param {string|null} parentId - ID della task genitore (null se è una task principale)
 * @param {Array} subtasks - Lista delle subtask
 * @param {string} priority - Priorità della task
 * @param {boolean} completed - Se la task è completata
 * @param {string|null} completed_at - Data di completamento (null se non completata)
 * @returns {HTMLElement} - L'elemento task creato
 */
function createTaskElement(taskId, taskText, parentId = null, subtasks = [], priority = 'normal', completed = false, completed_at = null) {
    // Crea il contenitore principale della task
    const taskContainer = document.createElement('div');
    taskContainer.className = 'task-container';
    taskContainer.dataset.taskId = taskId;

    // Controlla se si tratta di una subtask
    const isSubtask = parentId !== null;

    // Determina in quale contenitore inserire la task
    const container = isSubtask
        ? document.querySelector(`.task-container[data-task-id="${parentId}"] .subtasks-container`)
        : (completed ? document.getElementById('completedTasksList') : document.getElementById('taskList'));

    if (!container) {
        console.error(`Contenitore non trovato per la task ${taskId}${isSubtask ? ` (parent: ${parentId})` : ''}`);
        return;
    }

    // Crea l'elemento task
    const taskItem = document.createElement('div');
    taskItem.className = `task-item priority-${priority}`;
    taskItem.dataset.taskId = taskId;
    if (completed) taskItem.classList.add('completed');

    // Ottieni la classe di priorità corretta in base al valore
    const priorityIcon = getPriorityIcon(priority);

    // Imposta il contenuto HTML dell'elemento task
    taskItem.innerHTML = `
        <div class="task-handle" draggable="true">
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
        <div class="task-content">
            <div class="checkbox-container">
                <input type="checkbox" class="task-checkbox" id="checkbox-${taskId}" ${completed ? 'checked' : ''}>
                <label for="checkbox-${taskId}"></label>
            </div>
            <div class="task-text" contenteditable="true" 
                spellcheck="false" 
                data-placeholder="Aggiungi una nuova task...">${taskText}</div>
            <div class="task-icons">
                <button class="task-icons-container mr-4 button-reset ${priority !== 'normal' ? 'active' : ''}" id="priority-btn-${taskId}">
                    ${priorityIcon}
                </button>
                <div class="task-icons-container mr-8 task-time-wrapper">
                    <button class="task-time button-reset" id="task-time-${taskId}">
                        <i class="far fa-clock"></i>
                    </button>
                </div>
                <button class="add-subtask-btn button-reset ${isSubtask ? 'hidden' : ''}" id="add-subtask-${taskId}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
    `;

    // Aggiungi la task al suo contenitore
    taskContainer.appendChild(taskItem);

    // Crea il contenitore per le subtask (solo per le task principali)
    if (!isSubtask) {
        const subtasksContainer = document.createElement('div');
        subtasksContainer.className = 'subtasks-container ml-30';
        taskContainer.appendChild(subtasksContainer);

        // Aggiungi le subtask se ce ne sono
        if (subtasks && subtasks.length > 0) {
            subtasks.forEach(subtask => {
                createTaskElement(subtask.id, subtask.content, taskId, null, subtask.priority, subtask.completed, subtask.completed_at);
            });
        }
    }

    // Aggiungi il contenitore task al contenitore appropriato
    container.appendChild(taskContainer);

    // Aggiungi gli event listener
    addTaskEventListeners(taskItem, taskId, isSubtask, priority);

    return taskContainer;
}

/**
 * Ottiene l'icona HTML per la priorità specificata
 * @param {string} priority - Priorità ('urgent', 'medium', 'normal')
 * @returns {string} - HTML dell'icona
 */
function getPriorityIcon(priority) {
    switch (priority) {
        case 'urgent':
            return '<i class="fas fa-flag priority-urgent-icon"></i>';
        case 'medium':
            return '<i class="fas fa-flag priority-medium-icon"></i>';
        default:
            return '<i class="far fa-flag"></i>';
    }
}

/**
 * Aggiunge gli event listener a un elemento task
 * @param {HTMLElement} taskItem - Elemento task
 * @param {string} taskId - ID della task
 * @param {boolean} isSubtask - Se è una subtask
 * @param {string} currentPriority - Priorità corrente
 */
function addTaskEventListeners(taskItem, taskId, isSubtask, currentPriority) {
    // Riferimenti agli elementi
    const taskText = taskItem.querySelector('.task-text');
    const taskCheckbox = taskItem.querySelector('.task-checkbox');
    const priorityBtn = taskItem.querySelector(`#priority-btn-${taskId}`);
    const timeBtn = taskItem.querySelector(`#task-time-${taskId}`);
    const addSubtaskBtn = taskItem.querySelector(`#add-subtask-${taskId}`);
    const taskHandle = taskItem.querySelector('.task-handle');

    // Event listener per il contenuto modificabile
    taskText.addEventListener('blur', async (e) => {
        const newText = e.target.textContent.trim();
        if (newText !== '') {
            // Aggiorna la task nel database
            try {
                await databaseService.updateTask(taskId, { content: newText });
            } catch (error) {
                console.error('Errore durante l\'aggiornamento della task:', error);
                showStatus('Errore durante l\'aggiornamento della task', 'error');
            }
        }
    });

    // Event listener per il checkbox di completamento
    taskCheckbox.addEventListener('change', async (e) => {
        const completed = e.target.checked;

        try {
            // Aggiorna lo stato di completamento
            await handleTaskCompletion(taskId, completed);

            // Aggiorna l'interfaccia
            taskItem.classList.toggle('completed', completed);

            // Sposta la task nel contenitore appropriato
            const taskContainer = taskItem.closest('.task-container');
            if (!isSubtask) {
                if (completed) {
                    // Aggiungi una data di completamento
                    const date = new Date();

                    // Aggiorna la task nel database
                    await databaseService.updateTask(taskId, {
                        completed: true,
                        completed_at: date.toISOString()
                    });

                    // Se i completati sono visibili, sposta la task nella lista dei completati
                    if (showCompletedTasks) {
                        const dateStr = formatDate(date);

                        // Cerca o crea l'intestazione della data
                        let dateHeader = document.querySelector(`.completed-date-header:contains("${dateStr}")`);
                        if (!dateHeader) {
                            dateHeader = document.createElement('div');
                            dateHeader.className = 'completed-date-header';
                            dateHeader.textContent = dateStr;
                            document.getElementById('completedTasksList').prepend(dateHeader);
                        }

                        // Sposta la task container dopo l'intestazione
                        dateHeader.after(taskContainer);
                    } else {
                        // Nascondi la task se i completati non sono visibili
                        taskContainer.style.display = 'none';
                    }
                } else {
                    // Aggiorna la task nel database
                    await databaseService.updateTask(taskId, {
                        completed: false,
                        completed_at: null
                    });

                    // Sposta la task nella lista delle attive
                    document.getElementById('taskList').appendChild(taskContainer);
                }

                // Aggiorna il contatore delle task completate
                updateCompletedCounter();
                loadTasks(); // Ricarica le task per aggiornare correttamente le viste
            } else {
                // Per le subtask, aggiorna solo lo stato
                await databaseService.updateTask(taskId, {
                    completed: completed,
                    completed_at: completed ? new Date().toISOString() : null
                });
            }
        } catch (error) {
            console.error('Errore durante l\'aggiornamento dello stato della task:', error);
            showStatus('Errore durante l\'aggiornamento dello stato della task', 'error');
            // Ripristina lo stato originale
            e.target.checked = !completed;
        }
    });

    // Event listener per il pulsante della priorità
    priorityBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Crea il menu di priorità
        const priorityMenu = createPriorityMenu(taskId, currentPriority);

        // Posiziona il menu vicino al pulsante della priorità
        const rect = priorityBtn.getBoundingClientRect();
        priorityMenu.style.top = `${rect.bottom + window.scrollY}px`;
        priorityMenu.style.left = `${rect.left + window.scrollX}px`;

        // Aggiungi il menu al documento
        document.body.appendChild(priorityMenu);

        // Aggiungi event listener per chiudere il menu quando si clicca fuori
        function closeMenu(e) {
            if (!priorityMenu.contains(e.target) && e.target !== priorityBtn) {
                priorityMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        }

        // Aggiungi un ritardo per evitare che il menu si chiuda immediatamente
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    });

    // Event listener per il pulsante del timer
    timeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        timerService.openTimerModal(taskId);
    });

    // Event listener per il pulsante di aggiunta subtask (solo per task principali)
    if (addSubtaskBtn) {
        addSubtaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addTask(taskId);
        });
    }

    // Event listener per il drag and drop
    if (taskHandle) {
        taskHandle.addEventListener('dragstart', handleDragStart);
        taskHandle.addEventListener('dragend', handleDragEnd);
    }

    // Aggiungi event listener per il drag and drop sul container
    const taskContainer = taskItem.closest('.task-container');
    taskContainer.addEventListener('dragover', handleDragOver);
    taskContainer.addEventListener('dragleave', handleDragLeave);
    taskContainer.addEventListener('drop', handleDrop);
}

/**
 * Crea un menu di priorità
 * @param {string} taskId - ID della task
 * @param {string} currentPriority - Priorità corrente
 * @returns {HTMLElement} - Elemento menu
 */
function createPriorityMenu(taskId, currentPriority) {
    const menu = document.createElement('div');
    menu.className = 'priority-menu';
    menu.innerHTML = `
        <div class="priority-item ${currentPriority === 'normal' ? 'active' : ''}" data-priority="normal">
            <i class="far fa-flag"></i> Normale
        </div>
        <div class="priority-item ${currentPriority === 'medium' ? 'active' : ''}" data-priority="medium">
            <i class="fas fa-flag priority-medium-icon"></i> Media
        </div>
        <div class="priority-item ${currentPriority === 'urgent' ? 'active' : ''}" data-priority="urgent">
            <i class="fas fa-flag priority-urgent-icon"></i> Urgente
        </div>
    `;

    // Aggiungi event listener per gli elementi del menu
    menu.querySelectorAll('.priority-item').forEach(item => {
        item.addEventListener('click', async () => {
            const newPriority = item.dataset.priority;

            try {
                // Aggiorna la priorità nel database
                await databaseService.updateTask(taskId, { priority: newPriority });

                // Aggiorna l'interfaccia
                const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
                if (taskItem) {
                    // Rimuovi le classi di priorità esistenti
                    taskItem.classList.remove('priority-normal', 'priority-medium', 'priority-urgent');
                    // Aggiungi la nuova classe di priorità
                    taskItem.classList.add(`priority-${newPriority}`);

                    // Aggiorna l'icona del pulsante
                    const priorityBtn = document.getElementById(`priority-btn-${taskId}`);
                    priorityBtn.innerHTML = getPriorityIcon(newPriority);

                    // Attiva/disattiva la classe active sul pulsante
                    if (newPriority === 'normal') {
                        priorityBtn.classList.remove('active');
                    } else {
                        priorityBtn.classList.add('active');
                    }
                }

                // Chiudi il menu
                menu.remove();

                // Applica di nuovo i filtri se sono attivi
                applyPriorityFilters();

            } catch (error) {
                console.error('Errore durante l\'aggiornamento della priorità:', error);
                showStatus('Errore durante l\'aggiornamento della priorità', 'error');
            }
        });
    });

    return menu;
}

/**
 * Gestisce il completamento di una task e le sue subtask
 * @param {string} taskId - ID della task
 * @param {boolean} completed - Nuovo stato di completamento
 * @returns {Promise<void>}
 */
async function handleTaskCompletion(taskId, completed) {
    try {
        // Se la task è una task principale, aggiorna anche le subtask
        const taskContainer = document.querySelector(`.task-container[data-task-id="${taskId}"]`);
        if (taskContainer) {
            const subtaskContainers = taskContainer.querySelectorAll('.subtasks-container .task-container');

            // Se è una task principale e viene completata, completa anche tutte le subtask
            if (completed && subtaskContainers.length > 0) {
                for (const subtaskContainer of subtaskContainers) {
                    const subtaskId = subtaskContainer.dataset.taskId;
                    const subtaskCheckbox = document.getElementById(`checkbox-${subtaskId}`);

                    if (subtaskCheckbox && !subtaskCheckbox.checked) {
                        subtaskCheckbox.checked = true;
                        const subtaskItem = subtaskCheckbox.closest('.task-item');
                        subtaskItem.classList.add('completed');

                        // Aggiorna la subtask nel database
                        await databaseService.updateTask(subtaskId, {
                            completed: true,
                            completed_at: new Date().toISOString()
                        });
                    }
                }
            }

            // Se è una subtask e viene deselezionata, deseleziona anche la task principale
            if (!completed) {
                const parentContainer = taskContainer.closest('.task-container[data-task-id]');
                if (parentContainer) {
                    const parentId = parentContainer.dataset.taskId;
                    const parentCheckbox = document.getElementById(`checkbox-${parentId}`);

                    if (parentCheckbox && parentCheckbox.checked) {
                        parentCheckbox.checked = false;
                        const parentItem = parentCheckbox.closest('.task-item');
                        parentItem.classList.remove('completed');

                        // Aggiorna la task genitore nel database
                        await databaseService.updateTask(parentId, {
                            completed: false,
                            completed_at: null
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Errore durante l\'aggiornamento delle subtask:', error);
        throw error;
    }
}

/**
 * Aggiunge una nuova task
 * @param {string|null} parentId - ID della task genitore (null se è una task principale)
 */
async function addTask(parentId = null) {
    if (!currentProjectId) {
        showStatus('Seleziona prima un progetto', 'error');
        return;
    }

    try {
        // Crea una nuova task vuota
        const taskData = {
            project_id: currentProjectId,
            content: '',
            completed: false,
            priority: 'normal',
            position: 0, // La posizione verrà calcolata in seguito
            parent_id: parentId
        };

        // Se è una subtask, imposta la parent_id
        if (parentId) {
            taskData.parent_id = parentId;
        }

        // Calcola la nuova posizione
        if (parentId) {
            // Per le subtask, calcola la posizione in base alle subtask esistenti
            const subtaskItems = document.querySelectorAll(`.task-container[data-task-id="${parentId}"] .subtasks-container .task-container`);
            taskData.position = subtaskItems.length;
        } else {
            // Per le task principali, calcola la posizione in base alle task esistenti
            const taskItems = document.querySelectorAll('#taskList > .task-container');
            taskData.position = taskItems.length;
        }

        // Salva la task nel database
        const newTaskId = await databaseService.createTask(taskData);

        // Crea l'elemento nell'interfaccia
        const taskElement = createTaskElement(newTaskId, '', parentId, [], 'normal', false);

        // Focus automatico sull'input di testo
        setTimeout(() => {
            const taskText = taskElement.querySelector('.task-text');
            if (taskText) {
                taskText.focus();
            }
        }, 100);

        // Aggiorna le statistiche
        if (!parentId) {
            const basicCount = document.getElementById('basicTasksCount');
            basicCount.textContent = (parseInt(basicCount.textContent) + 1).toString();
        }

    } catch (error) {
        console.error('Errore durante la creazione della task:', error);
        showStatus('Errore durante la creazione della task', 'error');
    }
}

/**
 * Gestisce l'inizio del drag di una task
 * @param {DragEvent} e - Evento drag
 */
function handleDragStart(e) {
    // Imposta l'effetto del drag
    e.dataTransfer.effectAllowed = 'move';

    // Ottieni l'elemento task container
    const taskItem = e.target.closest('.task-item');
    const taskContainer = taskItem.closest('.task-container');

    // Imposta la task correntemente trascinata
    draggedTask = taskContainer;

    // Aggiungi una classe per lo styling
    taskContainer.classList.add('dragging');

    // Salva l'ID della task trascinata
    e.dataTransfer.setData('text/plain', taskContainer.dataset.taskId);
}

/**
 * Gestisce la fine del drag di una task
 * @param {DragEvent} e - Evento drag
 */
function handleDragEnd(e) {
    // Rimuovi la classe di styling
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
    }

    // Resetta le variabili
    draggedTask = null;

    // Rimuovi la classe di highlight da tutti i potenziali target
    document.querySelectorAll('.task-container').forEach(container => {
        container.classList.remove('drag-over');
    });

    // Rimuovi la classe di highlight dalla posizione tra task
    document.querySelectorAll('.task-drop-indicator').forEach(indicator => {
        indicator.remove();
    });

    // Salva l'ordine delle task
    saveTaskOrder();
}

/**
 * Gestisce il drag over su una task
 * @param {DragEvent} e - Evento drag
 */
function handleDragOver(e) {
    // Previeni il comportamento predefinito per consentire il drop
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Se non c'è una task trascinata, esci
    if (!draggedTask) return;

    // Ottieni il container target
    const targetContainer = e.currentTarget;

    // Non permettere di trascinare su sé stessi
    if (targetContainer === draggedTask) return;

    // Controlla se è una subtask
    const isTargetSubtask = targetContainer.closest('.subtasks-container') !== null;
    const isDraggedSubtask = draggedTask.closest('.subtasks-container') !== null;

    // Controlla se è una task completata
    const isTargetCompleted = targetContainer.querySelector('.task-item.completed') !== null;
    const isDraggedCompleted = draggedTask.querySelector('.task-item.completed') !== null;

    // Non permettere di trascinare task completate su non completate e viceversa
    if (isTargetCompleted !== isDraggedCompleted) return;

    // Posizione del mouse
    const mouseY = e.clientY;
    const rect = targetContainer.getBoundingClientRect();
    const hasSubtasks = targetContainer.querySelector('.subtasks-container .task-container');

    // Calcola la posizione relativa del mouse rispetto al container
    const relativeMouseY = mouseY - rect.top;
    const threshold = rect.height / 3;

    // Rimuovi tutti gli indicatori esistenti
    document.querySelectorAll('.task-drop-indicator').forEach(indicator => {
        indicator.remove();
    });

    // Determina dove inserire la task
    if (relativeMouseY < threshold) {
        // Inserisci prima del target
        createDropIndicator(targetContainer, 'before');
        potentialParent = null;
    } else if (relativeMouseY > rect.height - threshold && !hasSubtasks) {
        // Inserisci dopo il target
        createDropIndicator(targetContainer, 'after');
        potentialParent = null;
    } else {
        // Annida come subtask (solo se non è già una subtask)
        if (!isDraggedSubtask && !isTargetSubtask) {
            targetContainer.classList.add('drag-over');
            potentialParent = targetContainer;

            // Cancella il timeout esistente
            if (dragTargetTimeout) {
                clearTimeout(dragTargetTimeout);
            }

            // Imposta un ritardo prima di mostrare l'opzione di annidamento
            dragTargetTimeout = setTimeout(() => {
                if (potentialParent === targetContainer) {
                    targetContainer.classList.add('drag-over-active');
                }
            }, 800);
        }
    }
}

/**
 * Crea un indicatore di drop
 * @param {HTMLElement} targetContainer - Container target
 * @param {string} position - Posizione ('before' o 'after')
 */
function createDropIndicator(targetContainer, position) {
    // Rimuovi tutti gli indicatori esistenti
    document.querySelectorAll('.task-drop-indicator').forEach(indicator => {
        indicator.remove();
    });

    // Rimuovi l'evidenziazione dai potenziali genitori
    document.querySelectorAll('.task-container').forEach(container => {
        container.classList.remove('drag-over');
        container.classList.remove('drag-over-active');
    });

    // Crea l'indicatore
    const indicator = document.createElement('div');
    indicator.className = 'task-drop-indicator';

    // Inserisci l'indicatore nella posizione corretta
    if (position === 'before') {
        targetContainer.parentNode.insertBefore(indicator, targetContainer);
    } else {
        targetContainer.parentNode.insertBefore(indicator, targetContainer.nextSibling);
    }
}

/**
 * Gestisce il drag leave su una task
 * @param {DragEvent} e - Evento drag
 */
function handleDragLeave(e) {
    // Rimuovi la classe di highlight se il mouse esce dall'elemento
    const targetContainer = e.currentTarget;

    // Determina se il mouse è uscito effettivamente dal container
    const rect = targetContainer.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    if (
        mouseX < rect.left ||
        mouseX > rect.right ||
        mouseY < rect.top ||
        mouseY > rect.bottom
    ) {
        targetContainer.classList.remove('drag-over');
        targetContainer.classList.remove('drag-over-active');

        // Cancella il timeout
        if (dragTargetTimeout && potentialParent === targetContainer) {
            clearTimeout(dragTargetTimeout);
            potentialParent = null;
        }
    }
}

/**
 * Gestisce il drop di una task
 * @param {DragEvent} e - Evento drag
 */
async function handleDrop(e) {
    e.preventDefault();

    // Ottieni l'ID della task trascinata
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    if (!draggedTaskId || !draggedTask) return;

    // Ottieni il container target
    const targetContainer = e.currentTarget;

    // Rimuovi tutti gli indicatori di drop
    document.querySelectorAll('.task-drop-indicator').forEach(indicator => {
        indicator.remove();
    });

    // Rimuovi l'evidenziazione dai potenziali genitori
    document.querySelectorAll('.task-container').forEach(container => {
        container.classList.remove('drag-over');
        container.classList.remove('drag-over-active');
    });

    try {
        // Controlla se dobbiamo rendere la task una subtask
        if (targetContainer.classList.contains('drag-over-active')) {
            // Ottieni l'ID della task target
            const targetTaskId = targetContainer.dataset.taskId;

            // Aggiorna la task nel database
            await databaseService.updateTask(draggedTaskId, { parent_id: targetTaskId });

            // Sposta il container nell'interfaccia
            const subtasksContainer = targetContainer.querySelector('.subtasks-container');
            if (subtasksContainer) {
                subtasksContainer.appendChild(draggedTask);
            }
        } else {
            // Determina dove inserire la task
            const indicatorBefore = targetContainer.previousElementSibling;
            const isBeforeIndicator = indicatorBefore && indicatorBefore.classList.contains('task-drop-indicator');

            if (isBeforeIndicator) {
                // Inserisci prima del target
                targetContainer.parentNode.insertBefore(draggedTask, targetContainer);
            } else {
                // Inserisci dopo il target
                const indicatorAfter = targetContainer.nextElementSibling;
                const isAfterIndicator = indicatorAfter && indicatorAfter.classList.contains('task-drop-indicator');

                if (isAfterIndicator) {
                    // Inserisci dopo il target
                    targetContainer.parentNode.insertBefore(draggedTask, indicatorAfter.nextElementSibling);
                }
            }

            // Aggiorna il parent_id nel database
            const isDraggedInSubtasks = draggedTask.closest('.subtasks-container') !== null;
            if (isDraggedInSubtasks) {
                // Trova la task genitore
                const parentTaskContainer = draggedTask.closest('.task-container[data-task-id]');
                if (parentTaskContainer) {
                    const parentTaskId = parentTaskContainer.dataset.taskId;
                    // Aggiorna la task nel database
                    await databaseService.updateTask(draggedTaskId, { parent_id: parentTaskId });
                }
            } else {
                // Resetta il parent_id nel database
                await databaseService.updateTask(draggedTaskId, { parent_id: null });
            }
        }

        // Salva l'ordine delle task
        saveTaskOrder();

    } catch (error) {
        console.error('Errore durante lo spostamento della task:', error);
        showStatus('Errore durante lo spostamento della task', 'error');
    }
} 