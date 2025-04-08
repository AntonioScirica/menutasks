// Gestione dell'interfaccia utente per il tracciamento delle app

document.addEventListener('DOMContentLoaded', () => {
    // Verifica che l'API appTracker sia disponibile
    if (!window.appTracker) {
        console.error('appTracker API non disponibile. Assicurati che tracker-preload.js sia caricato correttamente.');
        return;
    }

    // Se questa riga è decommentata, inizializza il tracker UI nella barra laterale
    // initAppTrackerUI();

    // Invece, iniziamo solo il monitoraggio senza visualizzazione
    startTrackingOnly();
});

// Funzione per avviare solo il monitoraggio senza visualizzazione UI
function startTrackingOnly() {
    // Aggiorna periodicamente i dati sul backend senza visualizzarli
    setInterval(() => {
        window.appTracker.refreshApps()
            .catch(error => {
                console.error('Errore nell\'aggiornamento dei dati di tracciamento:', error);
            });
    }, 60000); // Ogni minuto

    // Aggiorna subito i dati
    window.appTracker.refreshApps()
        .catch(error => {
            console.error('Errore nell\'aggiornamento iniziale dei dati di tracciamento:', error);
        });

    console.log('Monitoraggio app avviato (senza UI)');
}

// Inizializza l'interfaccia utente del tracker
function initAppTrackerUI() {
    // Seleziona il container della barra laterale
    const sidebar = document.querySelector('.info-container');

    if (!sidebar) {
        console.error('Container della barra laterale non trovato');
        return;
    }

    // Crea il container per il tracker delle app
    const trackerContainer = document.createElement('div');
    trackerContainer.className = 'app-tracker-container';

    // Aggiungi l'intestazione
    const trackerTitle = document.createElement('h3');
    trackerTitle.className = 'info-header app-tracker-title';
    trackerTitle.innerHTML = `
    <i data-lucide="monitor"></i>
    APP ATTIVE
  `;

    // Crea il container per le statistiche delle app
    const appStatsContainer = document.createElement('div');
    appStatsContainer.id = 'app-stats-container';

    // Aggiungi l'informazione sull'ultimo aggiornamento
    const refreshInfo = document.createElement('div');
    refreshInfo.className = 'app-tracker-refresh';
    refreshInfo.innerHTML = `Ultimo aggiornamento: <span id="last-update-time">mai</span>
    <button id="refresh-button" class="app-tracker-refresh-button">Aggiorna</button>`;

    // Aggiungi gli elementi al container
    trackerContainer.appendChild(trackerTitle);
    trackerContainer.appendChild(appStatsContainer);
    trackerContainer.appendChild(refreshInfo);

    // Aggiungi il container alla barra laterale
    sidebar.appendChild(trackerContainer);

    // Inizializza l'icona con Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Aggiungi gli event listener
    document.getElementById('refresh-button').addEventListener('click', () => {
        refreshAppStats(true);
    });

    // Carica i dati iniziali
    refreshAppStats();

    // Imposta l'intervallo di aggiornamento (ogni 30 secondi)
    setInterval(() => refreshAppStats(), 30000);
}

// Aggiorna le statistiche delle app
function refreshAppStats(forceRefresh = false) {
    // Mostra un messaggio di caricamento
    const appStatsContainer = document.getElementById('app-stats-container');
    if (forceRefresh && appStatsContainer) {
        appStatsContainer.innerHTML = '<div class="app-stat-item"><span>Caricamento...</span></div>';
    }

    // Chiama l'API per ottenere le statistiche
    const apiCall = forceRefresh
        ? window.appTracker.refreshApps()
        : window.appTracker.getRunningApps();

    apiCall.then(stats => {
        // Aggiorna l'ora dell'ultimo aggiornamento
        const lastUpdateElement = document.getElementById('last-update-time');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleTimeString();
        }

        // Aggiorna il container con i dati
        if (appStatsContainer) {
            displayAppStats(stats);
        }
    }).catch(error => {
        console.error('Errore nel recupero delle statistiche:', error);
        if (appStatsContainer) {
            appStatsContainer.innerHTML = `<div class="app-stat-item">
                <span>Errore nel caricamento dei dati: ${error.message}</span>
            </div>`;
        }
    });
}

// Visualizza le statistiche delle app
function displayAppStats(stats) {
    const container = document.getElementById('app-stats-container');
    if (!container) return;

    container.innerHTML = '';

    // Ottieni solo le app in esecuzione o recentemente chiuse
    const activeApps = Object.entries(stats)
        .filter(([_, appData]) => appData.isRunning)
        .sort((a, b) => a[0].localeCompare(b[0])); // Ordina per nome

    // Mostra un messaggio se non ci sono app attive
    if (activeApps.length === 0) {
        container.innerHTML = '<div class="app-stat-item"><span>Nessuna app attiva rilevata</span></div>';
        return;
    }

    // Crea un elemento per ogni app
    activeApps.forEach(([appName, appData]) => {
        const appElement = document.createElement('div');
        appElement.className = 'app-stat-item';

        const statusClass = appData.isRunning ? 'running' : 'closed';

        appElement.innerHTML = `
      <div class="app-name-container">
        <div class="app-icon">
          <i data-lucide="app-window"></i>
        </div>
        <div class="app-name">${appName}</div>
      </div>
      <div class="app-time">
        <span class="app-status ${statusClass}"></span>
        ${appData.formattedTime}
      </div>
    `;

        container.appendChild(appElement);
    });

    // Inizializza nuovamente le icone
    if (window.lucide) {
        lucide.createIcons();
    }
} 