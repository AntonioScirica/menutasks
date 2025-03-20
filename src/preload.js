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
    }
});

// Espone le variabili d'ambiente Supabase
contextBridge.exposeInMainWorld('env', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
}); 