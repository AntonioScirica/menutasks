/**
 * Componente per la gestione dell'UI dei timer
 */

/**
 * Calcola un timestamp in minuti a partire dai valori di giorni, ore e minuti
 * @returns {number|null} - Timestamp in minuti o null
 */
function calcolaTimestamp() {
    let giorni, ore, minuti;

    if (timeSettingsSaved) {
        // Usa i valori memorizzati se il bottone Salva è stato premuto
        giorni = savedTaskDays;
        ore = savedTaskHours;
        minuti = savedTaskMinutes;
        console.log('Usando valori tempo salvati:', { giorni, ore, minuti });

        // Reset del flag dopo l'uso
        timeSettingsSaved = false;
    } else {
        // Fallback: leggi direttamente dagli input
        const dayInput = document.getElementById('taskDays');
        const hourInput = document.getElementById('taskHours');
        const minuteInput = document.getElementById('taskMinutes');

        if (!dayInput || !hourInput || !minuteInput) {
            console.error('Elementi di input tempo non trovati!');
            return null;
        }

        giorni = parseInt(dayInput.value) || 0;
        ore = parseInt(hourInput.value) || 0;
        minuti = parseInt(minuteInput.value) || 0;

        console.log('Usando valori tempo diretti dagli input:', { giorni, ore, minuti });
    }

    // Se tutti i valori sono zero, non impostare una scadenza
    if (giorni === 0 && ore === 0 && minuti === 0) {
        console.log('Nessuna scadenza impostata');
        return null;
    }

    // Converti tutto in minuti totali
    const minutiTotali = (giorni * 24 * 60) + (ore * 60) + minuti;

    console.log('Minuti totali calcolati:', minutiTotali);

    // Salviamo il valore numerico dei minuti totali
    return minutiTotali;
}

/**
 * Resetta tutte le impostazioni delle task
 */
function resetTaskSettings() {
    // Resetta il timer
    document.getElementById('timerToggle').checked = false;
    document.getElementById('timerLabel').style.display = 'inline';
    document.getElementById('timerDisplay').style.display = 'none';

    // Resetta la sezione del tempo
    const timeSection = document.getElementById('timeSettingsRow');
    if (timeSection) {
        timeSection.classList.remove('time-disabled');
    }

    // Resetta gli input di tempo
    document.getElementById('taskDays').value = '';
    document.getElementById('taskHours').value = '';
    document.getElementById('taskMinutes').value = '';

    // Resetta il toggle giornaliero
    document.getElementById('dailyToggle').checked = false;

    // Resetta la descrizione
    document.getElementById('taskDescription').value = '';
    document.getElementById('descriptionRow').style.display = 'none';
    document.getElementById('addDescriptionRow').style.display = 'flex';

    // Resetta le variabili globali
    savedTaskDays = 0;
    savedTaskHours = 0;
    savedTaskMinutes = 0;
    timeSettingsSaved = false;
    isDailyEnabled = false;
    currentTaskDescription = '';

    // Ferma il timer visuale
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    timerSeconds = 0;
}

/**
 * Inizializza il selettore di priorità
 */
function initPrioritySelector() {
    const taskInput = document.getElementById('taskInput');
    const prioritySelector = document.querySelector('.priority-selector');
    const priorityOptions = document.querySelectorAll('.priority-option');

    if (!taskInput || !prioritySelector || !priorityOptions.length) {
        console.error('Elementi del selettore priorità non trovati');
        return;
    }

    // Mostra il selettore quando l'input ha del testo
    taskInput.addEventListener('input', function () {
        if (this.value.trim() !== '') {
            prioritySelector.classList.add('visible');
        } else {
            prioritySelector.classList.remove('visible');
        }
    });

    // Gestisce la selezione della priorità
    priorityOptions.forEach(option => {
        option.addEventListener('click', function () {
            const priority = this.dataset.priority;
            setPriority(priority);

            // Rimuovi le classi attive dalle altre opzioni
            priorityOptions.forEach(opt => opt.classList.remove('active'));

            // Aggiungi la classe attiva all'opzione selezionata
            this.classList.add('active');
        });
    });

    // Imposta la priorità iniziale
    setPriority('normal');
}

/**
 * Imposta la priorità corrente
 * @param {string} priority - Priorità da impostare ('urgent', 'medium', 'normal')
 */
function setPriority(priority) {
    currentPriority = priority;

    // Aggiorna l'aspetto visuale
    const priorityOptions = document.querySelectorAll('.priority-option');
    priorityOptions.forEach(option => {
        if (option.dataset.priority === priority) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
} 