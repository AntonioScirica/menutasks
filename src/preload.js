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
    }
});

// Espone le variabili d'ambiente Supabase
contextBridge.exposeInMainWorld('env', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
}); 