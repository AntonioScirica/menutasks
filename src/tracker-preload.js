const { contextBridge, ipcRenderer } = require('electron');

// Espone funzioni sicure al renderer process
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