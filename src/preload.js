const { contextBridge, ipcRenderer } = require('electron');

// Espone funzionalità specifiche dal processo principale al processo di rendering
contextBridge.exposeInMainWorld('electronAPI', {
    // Funzione per mostrare un alert
    showAlert: () => {
        alert('Hai cliccato il pulsante!');
    },
    // Funzione per gestire il focus sull'input
    onFocusInput: (callback) => {
        ipcRenderer.on('focus-input', callback);
    },
    // API per prevenire la sospensione dell'app
    preventAppSuspension: (reason) => {
        return ipcRenderer.invoke('preventAppSuspension', reason);
    },
    // API per rilasciare il blocco di sospensione dell'app
    releaseAppSuspension: () => {
        return ipcRenderer.invoke('releaseAppSuspension');
    },
    // API per ottenere lo stato corrente del blocco di sospensione
    getAppSuspensionStatus: () => {
        return ipcRenderer.invoke('getAppSuspensionStatus');
    },
    // Event listeners per gli eventi di alimentazione e schermo
    onPowerSuspend: (callback) => {
        ipcRenderer.on('power-suspend', callback);
    },
    onPowerResume: (callback) => {
        ipcRenderer.on('power-resume', callback);
    },
    onScreenLock: (callback) => {
        ipcRenderer.on('screen-locked', callback);
    },
    onScreenUnlock: (callback) => {
        ipcRenderer.on('screen-unlocked', callback);
    },
    // API per controllo diretto dei timer
    pauseAllTimers: () => {
        return ipcRenderer.invoke('pauseAllTimers');
    },
    resumeAllTimers: () => {
        return ipcRenderer.invoke('resumeAllTimers');
    },
    // Funzione per inviare messaggi di log al processo principale
    logMessage: (message) => {
        return ipcRenderer.invoke('logMessage', message);
    },
    // API per ottenere le app attive
    getActiveApps: () => {
        return ipcRenderer.invoke('getActiveApps');
    },
    // API per ottenere l'app in primo piano
    getForegroundApp: () => {
        return ipcRenderer.invoke('getForegroundApp');
    },
    // API per verificare se il sistema è attivo
    isSystemActive: () => {
        return ipcRenderer.invoke('isSystemActive');
    },
    // Funzione per verificare se un'app specifica è attiva in primo piano
    isAppActive: (appName) => {
        return ipcRenderer.invoke('isAppActive', appName);
    }
});

// Espone le variabili d'ambiente Supabase
contextBridge.exposeInMainWorld('env', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
});

// Espone funzioni per il tracciamento delle app
contextBridge.exposeInMainWorld('appTracker', {
    // Ottieni la lista delle app in esecuzione con i relativi tempi
    getRunningApps: () => {
        return ipcRenderer.invoke('get-app-stats');
    },

    // Forza un aggiornamento dei dati
    refreshApps: () => {
        return ipcRenderer.invoke('refresh-app-stats');
    }
}); 