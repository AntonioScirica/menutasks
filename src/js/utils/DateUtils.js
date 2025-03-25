/**
 * Utility per la gestione delle date
 */

/**
 * Formatta una data nel formato "DD Mese YYYY"
 * @param {string|Date} date - Data da formattare
 * @returns {string} - Data formattata
 */
function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida
    if (isNaN(d.getTime())) {
        return 'Data non valida';
    }

    // Lista dei mesi in italiano
    const mesi = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    // Ottieni giorno, mese e anno
    const giorno = d.getDate();
    const mese = mesi[d.getMonth()];
    const anno = d.getFullYear();

    // Formatta la data
    return `${giorno} ${mese} ${anno}`;
}

/**
 * Formatta una data nel formato "DD/MM/YYYY"
 * @param {string|Date} date - Data da formattare
 * @returns {string} - Data formattata
 */
function formatShortDate(date) {
    const d = date instanceof Date ? date : new Date(date);

    // Controlla se la data è valida
    if (isNaN(d.getTime())) {
        return 'Data non valida';
    }

    // Ottieni giorno, mese e anno
    const giorno = d.getDate().toString().padStart(2, '0');
    const mese = (d.getMonth() + 1).toString().padStart(2, '0');
    const anno = d.getFullYear();

    // Formatta la data
    return `${giorno}/${mese}/${anno}`;
}

/**
 * Formatta il tempo totale in minuti in una stringa più leggibile
 * @param {number} minutes - Minuti totali
 * @returns {string} - Tempo formattato
 */
function formatTotalTime(minutes) {
    if (minutes === 0) return '0m';

    const ore = Math.floor(minutes / 60);
    const minuti = minutes % 60;

    if (ore > 0 && minuti > 0) {
        return `${ore}h ${minuti}m`;
    } else if (ore > 0) {
        return `${ore}h`;
    } else {
        return `${minuti}m`;
    }
}

/**
 * Controlla se due date sono lo stesso giorno
 * @param {Date} date1 - Prima data
 * @param {Date} date2 - Seconda data
 * @returns {boolean} - true se sono lo stesso giorno
 */
function isSameDay(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Controlla se una data è oggi
 * @param {string|Date} date - Data da controllare
 * @returns {boolean} - true se è oggi
 */
function isToday(date) {
    const d = date instanceof Date ? date : new Date(date);
    return isSameDay(d, new Date());
}

/**
 * Ottiene l'inizio della giornata
 * @param {Date} date - Data 
 * @returns {Date} - Data all'inizio della giornata
 */
function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Ottiene la fine della giornata
 * @param {Date} date - Data
 * @returns {Date} - Data alla fine della giornata
 */
function endOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Ottiene l'inizio della settimana (lunedì)
 * @param {Date} date - Data
 * @returns {Date} - Data all'inizio della settimana
 */
function startOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // aggiusta quando domenica è 0
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Ottiene la fine della settimana (domenica)
 * @param {Date} date - Data
 * @returns {Date} - Data alla fine della settimana
 */
function endOfWeek(date) {
    const result = startOfWeek(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Ottiene l'inizio del mese
 * @param {Date} date - Data
 * @returns {Date} - Data all'inizio del mese
 */
function startOfMonth(date) {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Ottiene la fine del mese
 * @param {Date} date - Data
 * @returns {Date} - Data alla fine del mese
 */
function endOfMonth(date) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Controlla se una task giornaliera deve essere resettata
 * @returns {Promise<boolean>} - true se almeno una task è stata resettata
 */
async function checkDailyTasksForReset() {
    try {
        // Carica le task giornaliere che devono essere resettate
        const tasksToReset = await databaseService.loadDailyTasksToReset();

        if (tasksToReset.length === 0) {
            return false;
        }

        // Resetta le task
        await databaseService.resetDailyTasks(tasksToReset);

        console.log(`${tasksToReset.length} task giornaliere resettate`);
        return true;
    } catch (error) {
        console.error('Errore durante il reset delle task giornaliere:', error);
        return false;
    }
}

// Esporta le funzioni
export {
    formatDate,
    formatShortDate,
    formatTotalTime,
    isSameDay,
    isToday,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    checkDailyTasksForReset
}; 