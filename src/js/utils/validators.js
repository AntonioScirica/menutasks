/**
 * Verifica se una stringa è vuota
 * @param {string} str - Stringa da verificare
 * @returns {boolean} - true se la stringa è vuota o contiene solo spazi
 */
function isEmpty(str) {
    return !str || str.trim() === '';
}

/**
 * Verifica se un valore è un intero valido
 * @param {*} value - Valore da verificare
 * @returns {boolean} - true se il valore è un intero valido
 */
function isValidInteger(value) {
    if (value === undefined || value === null || value === '') return false;

    const parsed = parseInt(value);
    return !isNaN(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

/**
 * Verifica se un progetto esiste
 * @param {string} projectId - ID del progetto
 * @param {Array} projects - Lista dei progetti
 * @returns {boolean} - true se il progetto esiste
 */
function projectExists(projectId, projects) {
    if (projectId === 'all') return true;
    return projects.some(project => project.id === projectId);
}

/**
 * Verifica se un URL è valido
 * @param {string} url - URL da verificare
 * @returns {boolean} - true se l'URL è valido
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Verifica se un timer deve essere salvato in base ai cambiamenti
 * @param {string} taskId - ID della task
 * @param {number} seconds - Secondi da verificare
 * @returns {boolean} - true se il timer deve essere salvato
 */
function shouldSaveTimer(taskId, seconds) {
    // Ottieni l'ultimo stato salvato
    const lastState = timerSavedStates.get(taskId);

    if (!lastState) {
        return true; // Salva sempre se non c'è uno stato precedente
    }

    // Se sono passati più di 5 minuti dall'ultimo salvataggio, salva
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if (lastState.timestamp < fiveMinutesAgo) {
        console.log(`Forzando salvataggio del timer per task ${taskId} (ultimo salvataggio: ${new Date(lastState.timestamp).toLocaleTimeString()})`);
        return true;
    }

    // Se i secondi sono cambiati significativamente (più di 5), salva
    const secondsDiff = Math.abs(seconds - lastState.seconds);
    return secondsDiff >= 5;
} 