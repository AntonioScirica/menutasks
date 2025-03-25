/**
 * Componente per la gestione dei progetti
 */

/**
 * Seleziona un progetto
 * @param {string} projectId - ID del progetto
 * @param {string} projectName - Nome del progetto
 */
async function selectProject(projectId) {
    console.log(`Selezionando il progetto con ID: ${projectId}`);

    if (!projectId) {
        console.warn('Nessun ID progetto fornito');

        // Se non viene fornito un ID, prova a caricare l'ultimo progetto dal localStorage
        const lastProjectJSON = localStorage.getItem('lastSelectedProject');
        console.log('Ultimo progetto nel localStorage:', lastProjectJSON);

        if (lastProjectJSON) {
            try {
                const lastProject = JSON.parse(lastProjectJSON);
                console.log('Ultimo progetto analizzato:', lastProject);

                // Verifica che il timestamp non sia più vecchio di 12 ore
                const now = new Date().getTime();
                const lastSelectTime = lastProject.timestamp || 0;
                const twelveHoursInMs = 12 * 60 * 60 * 1000;

                if (now - lastSelectTime < twelveHoursInMs) {
                    projectId = lastProject.id;
                    console.log(`Ripristino dell'ultimo progetto selezionato: ${projectId}`);
                } else {
                    console.log('Timestamp troppo vecchio, non ripristino il progetto');
                }
            } catch (error) {
                console.error('Errore nel ripristino del progetto:', error);
            }
        }

        // Se ancora non abbiamo un ID valido, seleziona il primo progetto disponibile
        if (!projectId) {
            console.log('Nessun ultimo progetto valido, tentativo di selezionare il primo progetto');
            const projects = await databaseService.getAllProjects();
            if (projects && projects.length > 0) {
                projectId = projects[0].id;
                console.log(`Selezionato il primo progetto disponibile: ${projectId}`);
            } else {
                console.warn('Nessun progetto disponibile');
                return;
            }
        }
    }

    // Aggiorna l'UI per mostrare il progetto selezionato
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === projectId.toString()) {
            item.classList.add('active');
        }
    });

    // Carica i dettagli del progetto dal database
    try {
        const project = await databaseService.getProject(projectId);
        if (project) {
            console.log('Progetto caricato con successo:', project);

            // Aggiorna l'UI con i dettagli del progetto
            document.getElementById('currentProjectName').textContent = project.name;
            const projectContainer = document.querySelector('.projects-container');
            if (projectContainer) {
                projectContainer.dataset.currentProjectId = projectId;
            }

            // Nascondi il menu dei progetti dopo la selezione
            const projectsContent = document.querySelector('.projects-content');
            if (projectsContent) {
                projectsContent.classList.remove('active');
                projectsContent.classList.remove('visible');
            }

            // Salva il progetto selezionato nel localStorage con timestamp
            const projectToSave = {
                id: projectId,
                name: project.name,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('lastSelectedProject', JSON.stringify(projectToSave));
            console.log('Progetto salvato nel localStorage:', projectToSave);

            // Verifica che il progetto sia stato effettivamente salvato
            const savedProject = localStorage.getItem('lastSelectedProject');
            console.log('Verifica salvataggio nel localStorage:', savedProject);

            // Carica i task associati al progetto
            const tasks = await databaseService.getTasksByProject(projectId);
            console.log(`Caricati ${tasks.length} task per il progetto`);
            renderTasks(tasks);

            return project;
        } else {
            console.error(`Progetto con ID ${projectId} non trovato nel database`);
        }
    } catch (error) {
        console.error('Errore nella selezione del progetto:', error);
    }
}

/**
 * Crea un elemento progetto nell'interfaccia
 * @param {string} projectId - ID del progetto
 * @param {string} projectName - Nome del progetto
 */
function createProjectElement(projectId, projectName) {
    const projectsList = document.getElementById('projectsList');

    const projectElement = document.createElement('div');
    projectElement.className = 'project-item';
    projectElement.id = 'project-' + projectId;
    projectElement.dataset.projectId = projectId;

    projectElement.innerHTML = `
        <div class="project-content">${projectName}</div>
        <div class="project-actions">
            <button class="project-action-btn delete-project" data-project-id="${projectId}">
                <i data-lucide="trash-2" class="icon-trash"></i>
            </button>
        </div>
    `;

    // Aggiunge l'evento di click
    projectElement.addEventListener('click', (e) => {
        // Ignora se è stato cliccato il pulsante di eliminazione
        if (!e.target.closest('.project-action-btn')) {
            selectProject(projectId, projectName);
        }
    });

    // Aggiunge l'evento per eliminare il progetto
    const deleteButton = projectElement.querySelector('.delete-project');
    if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            promptDeleteProject(projectId);
        });
    }

    // Aggiunge il progetto alla lista
    projectsList.appendChild(projectElement);

    // Inizializza le icone Lucide nel nuovo elemento
    lucide.createIcons({
        elementRoot: projectElement
    });
}

/**
 * Mostra il prompt per la conferma dell'eliminazione di un progetto
 * @param {string} projectId - ID del progetto
 */
async function promptDeleteProject(projectId) {
    projectToDelete = projectId;

    // Controlla se il progetto ha task
    try {
        const { data, error } = await databaseService.supabase
            .from('tasks')
            .select('id')
            .eq('project_id', projectId);

        if (error) throw error;

        // Se ci sono task, mostra il popup di conferma
        if (data && data.length > 0) {
            document.getElementById('confirmDeletePopup').style.display = 'flex';
        } else {
            // Se non ci sono task, elimina direttamente
            confirmDeleteProject();
        }
    } catch (error) {
        console.error('Errore nel controllo delle task:', error);
        showStatus('Errore nel controllo delle task', 'error');
    }
}

/**
 * Conferma l'eliminazione di un progetto
 */
async function confirmDeleteProject() {
    if (!projectToDelete) return;

    try {
        await databaseService.deleteProject(projectToDelete);

        // Chiudi il popup
        closeConfirmPopup();

        // Ricarica i progetti
        await loadProjects();

        showStatus('Progetto eliminato', 'success');
    } catch (error) {
        console.error('Errore nell\'eliminazione del progetto:', error);
        showStatus('Errore nell\'eliminazione del progetto', 'error');
    } finally {
        projectToDelete = null;
    }
}

/**
 * Chiude il popup di conferma
 */
function closeConfirmPopup() {
    document.getElementById('confirmDeletePopup').style.display = 'none';
    projectToDelete = null;
}

/**
 * Mostra/nasconde l'input per l'aggiunta di un progetto
 */
function toggleProjectInput() {
    const projectInputGroup = document.getElementById('projectInputGroup');

    if (projectInputGroup.style.display === 'flex') {
        projectInputGroup.style.display = 'none';
    } else {
        projectInputGroup.style.display = 'flex';
        document.getElementById('projectInput').focus();
    }
}

/**
 * Aggiunge un nuovo progetto
 */
async function addProject() {
    const projectInput = document.getElementById('projectInput');
    const projectName = projectInput.value.trim();

    if (projectName === '') {
        showStatus('Nome progetto vuoto', 'error');
        return;
    }

    try {
        // Crea il progetto
        await databaseService.createProject(projectName);

        // Pulisci l'input
        projectInput.value = '';

        // Nascondi l'input
        toggleProjectInput();

        // Ricarica i progetti
        await loadProjects();

        showStatus('Progetto creato', 'success');
    } catch (error) {
        console.error('Errore nella creazione del progetto:', error);
        showStatus('Errore nella creazione del progetto', 'error');
    }
} 