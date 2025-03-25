/**
 * Formatta un numero di secondi in formato HH:MM:SS
 * @param {number} seconds - Numero di secondi da formattare
 * @returns {string} - Stringa formattata
 */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}

/**
 * Formatta una data in un formato leggibile
 * @param {string} dateStr - La data da formattare in formato ISO
 * @returns {string} - Data formattata
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Data sconosciuta';

    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Formatta la data
    if (date.toDateString() === today.toDateString()) {
        return 'Oggi';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ieri';
    } else {
        return date.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
}

/**
 * Calcola un'anteprima della durata basata su giorni, ore e minuti
 * @param {number} giorni - Giorni
 * @param {number} ore - Ore
 * @param {number} minuti - Minuti
 * @returns {string} - Anteprima formattata
 */
function calcolaAnteprima(giorni, ore, minuti) {
    if (giorni === 0 && ore === 0 && minuti === 0) {
        return "Nessuna";
    }

    // Formato semplice: "2g 10h 30m"
    let anteprima = '';

    if (giorni > 0) {
        anteprima += `${giorni}g `;
    }

    if (ore > 0) {
        anteprima += `${ore}h `;
    }

    if (minuti > 0) {
        anteprima += `${minuti}m`;
    }

    return anteprima.trim();
}

/**
 * Formatta il tempo totale per il display
 * @param {number} totalMinutes - Totale minuti da formattare
 * @returns {string} - Stringa formattata
 */
function formatTotalTime(totalMinutes) {
    // Converti minuti in giorni, ore e minuti
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    // Formatta il testo mostrando solo le unità necessarie
    let timeText = '';

    if (days > 0) {
        timeText += `${days}d `;
    }

    if (hours > 0) {
        timeText += `${hours}h `;
    }

    // Mostra sempre i minuti, anche se sono zero
    timeText += `${mins}m`;

    return timeText;
} 