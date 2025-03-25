/**
 * app.js - Entry point principale dell'applicazione
 * 
 * Inizializza tutti i servizi e componenti
 */

// Variabili globali
let currentProjectId = null;
let currentEditingTaskId = null;
let projectToDelete = null;
let currentPriority = 'normal';
let showCompletedTasks = false;
let activePriorityFilters = {
    urgent: false,
    medium: false,
    basic: false
};

// Variabili per la gestione delle impostazioni delle task
let savedTaskDays = 0;
let savedTaskHours = 0;
let savedTaskMinutes = 0;
let timeSettingsSaved = false;
let isDailyEnabled = false;
let currentTaskDescription = '';
let isTaskCreated = false;
let timerSeconds = 0;
let timerInterval = null;
let timerSaveInterval = null;

/**
 * Inizializza l'applicazione
 */
async function initializeApp() {
    console.log('Inizializzazione dell\'applicazione...');

    try {
        // Inizializza i servizi
        await databaseService.initialize();
        timerService.initialize();
        syncService.initialize();

        // Inizializza l'interfaccia utente
        initUI();

        // Carica i dati iniziali
        await loadProjects();

        // Assicuriamoci che la classe has-text sia impostata correttamente all'avvio
        const taskInput = document.getElementById('taskInput');
        const taskInputContainer = taskInput && taskInput.closest('.task-input-container');

        if (taskInput && taskInputContainer) {
            if (taskInput.value.trim() !== '') {
                taskInputContainer.classList.add('has-text');
            } else {
                taskInputContainer.classList.remove('has-text');
            }
        }

        console.log('Applicazione inizializzata con successo');
    } catch (error) {
        console.error('Errore durante l\'inizializzazione dell\'applicazione:', error);
        showStatus('Errore di inizializzazione', 'error');
    }
}

/**
 * Inizializza l'interfaccia utente
 */
function initUI() {
    console.log('Inizializzazione dell\'interfaccia utente...');

    // Inizializza le icone Lucide
    lucide.createIcons();

    // Aggiungi i gestori di eventi
    addEventListeners();

    // Assicurati che la vista delle task completate sia disattivata all'avvio
    showCompletedTasks = false;
    document.getElementById('completedTasksList').style.display = 'none';
    document.getElementById('taskList').style.display = 'flex';
    document.getElementById('completedTasksButton').classList.remove('active');

    // Inizializza il selettore di priorità
    initPrioritySelector();

    // Imposta timer per controllo task giornaliere a mezzanotte
    scheduleNextDayCheck();

    // Controlla ogni minuto se è passata mezzanotte
    checkMidnightInterval = setInterval(checkIfMidnightPassed, 60000);

    console.log('Interfaccia utente inizializzata');
}

/**
 * Aggiunge tutti i gestori di eventi necessari
 */
function addEventListeners() {
    // Popup delle impostazioni task
    const settingsIcon = document.getElementById('taskSettingsIcon');
    const taskSettingsPopup = document.getElementById('taskSettingsPopup');

    if (settingsIcon && taskSettingsPopup) {
        settingsIcon.addEventListener('click', function (event) {
            event.stopPropagation();
            taskSettingsPopup.classList.toggle('visible');
        });

        // Impedisci che i click all'interno del popup propaghino
        taskSettingsPopup.addEventListener('click', function (event) {
            event.stopPropagation();
        });
    }

    // Chiudi popup quando si clicca altrove
    document.addEventListener('click', function () {
        if (taskSettingsPopup) {
            taskSettingsPopup.classList.remove('visible');
        }
    });

    // Gestione descrizione task
    document.getElementById('addDescriptionRow').addEventListener('click', function () {
        document.getElementById('addDescriptionRow').style.display = 'none';
        document.getElementById('descriptionRow').style.display = 'flex';
        document.getElementById('taskDescription').focus();
    });

    document.getElementById('closeDescriptionBtn').addEventListener('click', function () {
        document.getElementById('descriptionRow').style.display = 'none';
        document.getElementById('addDescriptionRow').style.display = 'flex';
    });

    // Event listener per il bottone Salva impostazioni
    const saveTimeButton = document.getElementById('saveTimeSettings');
    if (saveTimeButton) {
        saveTimeButton.addEventListener('click', saveTaskSettings);
    }

    // Gestione del toggle del timer
    document.getElementById('timerToggle').addEventListener('change', function (event) {
        const timerLabel = document.getElementById('timerLabel');
        const timerDisplay = document.getElementById('timerDisplay');
        const timeSection = document.getElementById('timeSettingsRow');

        if (this.checked) {
            // Timer attivato visivamente
            timerLabel.style.display = 'none';
            timerDisplay.style.display = 'inline';
            timerDisplay.textContent = '00:00:00';

            // Disabilita la sezione del tempo
            if (timeSection) {
                timeSection.classList.add('time-disabled');
            }

            // NON avviamo il timer visuale, mostriamo solo il contatore statico 00:00:00
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            // Reset dei secondi visualizzati a zero
            timerSeconds = 0;
        } else {
            // Timer disattivato
            timerLabel.style.display = 'inline';
            timerDisplay.style.display = 'none';

            // Riabilita la sezione del tempo
            if (timeSection) {
                timeSection.classList.remove('time-disabled');
            }

            // Ferma il timer visuale se era in esecuzione
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            // Ferma il salvataggio periodico se esiste
            if (timerSaveInterval) {
                clearInterval(timerSaveInterval);
                timerSaveInterval = null;
            }

            timerSeconds = 0;
        }
    });

    // Gestione progetti
    const projectsTrigger = document.querySelector('.projects-trigger');
    if (projectsTrigger) {
        console.log('Menu progetti: Inizializzazione...', { trigger: projectsTrigger });

        // Rimuovi eventuali listener precedenti
        const newProjectsTrigger = projectsTrigger.cloneNode(true);
        projectsTrigger.parentNode.replaceChild(newProjectsTrigger, projectsTrigger);
        console.log('Menu progetti: Event listener rimossi e trigger clonato');

        // Assicurati che il menu progetti sia inizialmente chiuso
        const projectsContent = document.querySelector('.projects-content');
        if (projectsContent) {
            projectsContent.classList.remove('visible');
            projectsContent.classList.remove('active');
            console.log('Menu progetti: Stato iniziale impostato (menu chiuso)');
        } else {
            console.error('Menu progetti: Elemento .projects-content non trovato nel DOM!');
        }

        // Aggiungi l'event listener con debug
        newProjectsTrigger.addEventListener('click', function (event) {
            event.stopPropagation();
            console.log('Menu progetti: Click sul trigger rilevato');

            const projectsContent = document.querySelector('.projects-content');
            if (projectsContent) {
                const wasActive = projectsContent.classList.contains('active');
                projectsContent.classList.toggle('active');

                // Forza il aggiornamento dello stile per assicurarsi che il menu sia visibile
                if (!wasActive) {
                    // Se stiamo aprendo il menu, forza il ricalcolo dello stile
                    projectsContent.style.display = 'block';
                    // Aggiungi anche la classe visible come backup
                    projectsContent.classList.add('visible');
                    console.log('Menu progetti: Aperto con display e classe visibile forzati');
                } else {
                    console.log('Menu progetti: Chiuso');
                }
            } else {
                console.error('Menu progetti: Elemento .projects-content non trovato al click!');
            }
        });

        // Chiudi il menu quando si clicca altrove con debug
        document.addEventListener('click', function (event) {
            const projectsContent = document.querySelector('.projects-content');
            if (projectsContent && !event.target.closest('.projects-container')) {
                if (projectsContent.classList.contains('active')) {
                    console.log('Menu progetti: Chiusura per click esterno');
                    projectsContent.classList.remove('active');
                    projectsContent.classList.remove('visible');
                }
            }
        });

        // Aggiungi un secondo trigger per aprire il menu quando si fa doppio click sul nome del progetto
        const currentProjectNameElem = document.getElementById('currentProjectName');
        if (currentProjectNameElem) {
            currentProjectNameElem.addEventListener('dblclick', function (event) {
                event.stopPropagation();
                console.log('Menu progetti: Doppio click sul nome del progetto');

                const projectsContent = document.querySelector('.projects-content');
                if (projectsContent) {
                    projectsContent.classList.add('active');
                    projectsContent.classList.add('visible');
                    projectsContent.style.display = 'block';
                    console.log('Menu progetti: Aperto da doppio click sul nome');
                }
            });
        }
    }

    // Altri gestori di eventi
    document.getElementById('addProjectButton').addEventListener('click', toggleProjectInput);
    document.querySelector('.add-project-menu-button').addEventListener('click', toggleProjectInput);
    document.getElementById('completedTasksButton').addEventListener('click', toggleCompletedTasks);
    document.getElementById('urgentFilter').addEventListener('click', () => togglePriorityFilter('urgent'));
    document.getElementById('mediumFilter').addEventListener('click', () => togglePriorityFilter('medium'));
    document.getElementById('basicFilter').addEventListener('click', () => togglePriorityFilter('basic'));

    // Gestore dell'input per i task
    const taskInput = document.getElementById('taskInput');
    const taskInputContainer = document.querySelector('.task-input-container');

    if (taskInput && taskInputContainer) {
        // Assicurati che lo stato iniziale sia corretto
        taskInputContainer.classList.remove('has-text');
        taskInput.value = '';

        // Aggiungi l'event listener per l'input
        taskInput.addEventListener('input', function () {
            const hasText = this.value.trim() !== '';
            console.log(`Input task: "${this.value}" - hasText: ${hasText}`);

            if (hasText) {
                taskInputContainer.classList.add('has-text');
            } else {
                taskInputContainer.classList.remove('has-text');
            }
        });

        // Aggiungi l'event listener per il tasto Enter
        taskInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && this.value.trim() !== '') {
                e.preventDefault();
                console.log('Tasto Enter premuto, chiamo addTask()');
                addTask();
            }
        });
    }

    // Gestore per il pulsante di aggiunta task
    const addTaskButton = document.querySelector('.task-input-plus-icon');
    if (addTaskButton) {
        addTaskButton.addEventListener('click', function () {
            if (taskInput && taskInput.value.trim() !== '') {
                console.log('Click su pulsante aggiungi, chiamo addTask()');
                addTask();
            } else {
                console.log('Click su pulsante aggiungi ma input vuoto');
            }
        });
    }

    document.getElementById('projectInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addProject();
        }
    });
}

/**
 * Salva le impostazioni della task
 */
async function saveTaskSettings(event) {
    event.stopPropagation();

    // Salva i valori di input in variabili globali
    savedTaskDays = parseInt(document.getElementById('taskDays').value) || 0;
    savedTaskHours = parseInt(document.getElementById('taskHours').value) || 0;
    savedTaskMinutes = parseInt(document.getElementById('taskMinutes').value) || 0;
    isDailyEnabled = document.getElementById('dailyToggle').checked;
    currentTaskDescription = document.getElementById('taskDescription').value.trim();

    // Assicurati che ci sia almeno un valore per evitare di salvare 0/0/0
    const hasSomeTime = savedTaskDays > 0 || savedTaskHours > 0 || savedTaskMinutes > 0;

    // Aggiorna lo stato della UI per la descrizione
    const addDescriptionRow = document.getElementById('addDescriptionRow');
    const descriptionRow = document.getElementById('descriptionRow');

    // Se la descrizione è vuota, mostra "Aggiungi descrizione"
    if (currentTaskDescription === '') {
        descriptionRow.style.display = 'none';
        addDescriptionRow.style.display = 'flex';
    }

    // Se il task è in modifica, aggiorna direttamente la task
    if (currentEditingTaskId !== null) {
        try {
            // Prepara l'oggetto per l'aggiornamento
            const updateData = {
                is_daily: isDailyEnabled,
                description: currentTaskDescription
            };

            // Aggiorna il time_end_task solo se è stato impostato un tempo
            if (hasSomeTime) {
                const tempistica = calcolaTimestamp();
                if (tempistica) {
                    updateData.time_end_task = tempistica;
                }
            }

            // Aggiorna lo stato e il valore del timer
            const timerEnabled = document.getElementById('timerToggle').checked;
            updateData.timer_enabled = timerEnabled;

            // Aggiorna la task nel database
            await databaseService.updateTask(currentEditingTaskId, updateData);

            showStatus('Impostazioni salvate', 'success');
        } catch (error) {
            console.error('Errore durante l\'aggiornamento delle impostazioni:', error);
            showStatus('Errore durante il salvataggio', 'error');
        }
    }

    // Segnala che le impostazioni sono state salvate
    timeSettingsSaved = hasSomeTime;

    // Chiudi il popup
    document.getElementById('taskSettingsPopup').classList.remove('visible');

    // Riporta il focus sull'input delle task
    focusTaskInput();

    // Mostra il messaggio di conferma
    showStatus('Impostazioni salvate', 'success');

    // Ripristina il selettore di priorità se c'è testo nell'input
    const taskInput = document.getElementById('taskInput');
    const prioritySelector = document.querySelector('.priority-selector');
    if (taskInput && taskInput.value.trim() !== '' && prioritySelector) {
        // Riattiva il selettore di priorità
        setTimeout(() => {
            prioritySelector.classList.add('visible');
        }, 100);
    }
}

/**
 * Carica i progetti dal database e li mostra nell'interfaccia
 */
async function loadProjects() {
    console.log('Caricamento progetti iniziato');
    try {
        // Recupera i progetti dal database
        const projects = await databaseService.getAllProjects();
        console.log(`Trovati ${projects.length} progetti nel database`);

        // Trova il contenitore dei progetti e svuotalo
        const projectsListContainer = document.getElementById('projectsList');
        if (!projectsListContainer) {
            console.error('Contenitore progetti non trovato nel DOM');
            return;
        }
        projectsListContainer.innerHTML = '';

        // Carica i progetti nell'interfaccia
        for (const project of projects) {
            const projectItem = document.createElement('div');
            projectItem.classList.add('project-item');
            projectItem.dataset.id = project.id;
            projectItem.id = 'project-' + project.id;

            projectItem.innerHTML = `
                <span class="project-name">${project.name}</span>
                <div class="project-actions">
                    <button class="btn-edit" data-id="${project.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" data-id="${project.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Aggiungi event listener per selezionare il progetto
            projectItem.addEventListener('click', async function (event) {
                if (!event.target.closest('.project-actions')) {
                    console.log(`Click su progetto: ${project.name} (${project.id})`);
                    await selectProject(project.id);
                }
            });

            projectsListContainer.appendChild(projectItem);
        }

        // Tenta di ripristinare l'ultimo progetto selezionato, se presente
        console.log('Tentativo di ripristino ultimo progetto selezionato');
        const lastProjectJSON = localStorage.getItem('lastSelectedProject');

        if (lastProjectJSON) {
            try {
                console.log('Trovato ultimo progetto nel localStorage:', lastProjectJSON);
                const lastProject = JSON.parse(lastProjectJSON);

                // Verifica che il progetto esista ancora nella lista
                const projectExists = projects.some(p => p.id === lastProject.id);

                if (projectExists) {
                    console.log(`Ripristino ultimo progetto: ${lastProject.name} (${lastProject.id})`);
                    // Utilizziamo un breve timeout per assicurarci che il DOM sia completamente caricato
                    setTimeout(() => {
                        selectProject(lastProject.id);
                    }, 100);
                } else {
                    console.warn(`L'ultimo progetto (${lastProject.id}) non esiste più, seleziono il primo progetto`);
                    if (projects.length > 0) {
                        setTimeout(() => {
                            selectProject(projects[0].id);
                        }, 100);
                    }
                }
            } catch (error) {
                console.error('Errore nel parsing dell\'ultimo progetto:', error);
                // Seleziona il primo progetto come fallback
                if (projects.length > 0) {
                    setTimeout(() => {
                        selectProject(projects[0].id);
                    }, 100);
                }
            }
        } else {
            console.log('Nessun ultimo progetto trovato, seleziono il primo progetto');
            // Se non c'è un ultimo progetto, seleziona il primo
            if (projects.length > 0) {
                setTimeout(() => {
                    selectProject(projects[0].id);
                }, 100);
            }
        }

        console.log('Caricamento progetti completato');
    } catch (error) {
        console.error('Errore nel caricamento dei progetti:', error);
    }
}

/**
 * Esegue l'inizializzazione al caricamento del DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
}); 