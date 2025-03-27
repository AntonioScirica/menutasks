// Funzioni per gestire la persistenza dei progetti

// Salva l'ultimo progetto selezionato sia in localStorage che in IndexedDB
async function saveLastSelectedProject(projectId, projectName) {
    const projectData = {
        id: projectId,
        name: projectName,
        timestamp: new Date().toISOString()
    };

    // Salva in localStorage
    try {
        localStorage.setItem('lastSelectedProject', JSON.stringify(projectData));
        console.log(`Progetto "${projectName}" (ID: ${projectId}) salvato in localStorage`);
    } catch (error) {
        console.error('Errore nel salvare in localStorage:', error);
    }

    // Salva in IndexedDB per maggiore sicurezza
    try {
        await saveLastProjectToIndexedDB(projectData);
        console.log(`Progetto "${projectName}" (ID: ${projectId}) salvato in IndexedDB`);
    } catch (error) {
        console.error('Errore nel salvare in IndexedDB:', error);
    }

    return projectData;
}

// Recupera l'ultimo progetto selezionato da localStorage o IndexedDB
async function getLastSelectedProject() {
    let lastProject = null;

    // Prima prova localStorage
    try {
        const lastProjectJson = localStorage.getItem('lastSelectedProject');
        if (lastProjectJson) {
            lastProject = JSON.parse(lastProjectJson);
            console.log(`Ultimo progetto trovato in localStorage: "${lastProject.name}" (ID: ${lastProject.id})`);
            return lastProject;
        }
    } catch (error) {
        console.error('Errore nel recuperare da localStorage:', error);
    }

    // Se non è stato trovato in localStorage, prova IndexedDB
    try {
        lastProject = await getLastProjectFromIndexedDB();
        if (lastProject) {
            console.log(`Ultimo progetto recuperato da IndexedDB: "${lastProject.name}" (ID: ${lastProject.id})`);

            // Aggiorna anche localStorage per il prossimo avvio
            localStorage.setItem('lastSelectedProject', JSON.stringify(lastProject));

            return lastProject;
        }
    } catch (error) {
        console.error('Errore nel recuperare da IndexedDB:', error);
    }

    return null;
}

// Funzione per selezionare l'ultimo progetto utilizzato
async function loadAndSelectLastProject(projectsData) {
    console.log('Ripristino ultimo progetto selezionato...');

    // Recupera l'ultimo progetto
    const lastProject = await getLastSelectedProject();

    if (!lastProject) {
        console.log('Nessun ultimo progetto trovato, seleziono il primo disponibile');
        if (projectsData && projectsData.length > 0) {
            console.log(`Seleziono il primo progetto: "${projectsData[0].name}"`);
            selectProject(projectsData[0].id, projectsData[0].name);
            return projectsData[0];
        }
        return null;
    }

    // Verifica che il progetto esista ancora
    const isValid = lastProject.id === 'all' ||
        projectsData.some(project => project.id.toString() === lastProject.id.toString());

    if (isValid) {
        console.log(`Seleziono l'ultimo progetto: "${lastProject.name}" (ID: ${lastProject.id})`);
        selectProject(lastProject.id, lastProject.name);
        return lastProject;
    } else {
        console.warn(`Ultimo progetto non più valido: "${lastProject.name}" (ID: ${lastProject.id})`);
        // Seleziona il primo progetto disponibile
        if (projectsData && projectsData.length > 0) {
            console.log(`Seleziono il primo progetto: "${projectsData[0].name}"`);
            selectProject(projectsData[0].id, projectsData[0].name);
            return projectsData[0];
        }
    }

    return null;
} 