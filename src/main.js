const { app, BrowserWindow, ipcMain } = require('electron');
const { menubar } = require('menubar');
const path = require('path');

// Gestisce il comportamento quando l'app è pronta
if (process.platform === 'darwin') {
    app.dock.hide(); // Nasconde l'icona nel dock di macOS
}

// Definisci il percorso dell'icona
let iconPath;
try {
    // Controlla se l'icona personalizzata esiste
    const fs = require('fs');
    const customIconPath = path.resolve(__dirname, 'assets/IconTemplate.png');

    if (fs.existsSync(customIconPath)) {
        iconPath = customIconPath;
    } else {
        // Utilizza un'icona di default
        iconPath = path.join(__dirname, '../node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns');
    }
} catch (error) {
    console.error('Errore nel caricamento dell\'icona:', error);
    // Utilizza un'icona di default come fallback
    iconPath = path.join(__dirname, '../node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns');
}

// Crea l'applicazione menubar
const mb = menubar({
    index: `file://${path.resolve(__dirname, 'index.html')}`,
    icon: iconPath,
    browserWindow: {
        width: 400,
        height: 500,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        // Nascondi la finestra inizialmente
        opacity: 0
    },
    showOnAllWorkspaces: true,
    showDockIcon: false,
    tooltip: 'Task Manager',
    preloadWindow: true
});

mb.on('ready', () => {
    console.log('L\'applicazione è pronta!');
});

// Intercetta l'evento prima che la finestra venga mostrata
mb.on('show', () => {
    // Assicuriamoci che la finestra sia invisibile
    if (mb.window) {
        mb.window.setOpacity(0);
    }
});

// Posiziona la finestra quando viene mostrata
mb.on('after-show', () => {
    if (mb.window) {
        // Ottieni le dimensioni dello schermo
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();

        // Ottieni la posizione attuale
        const windowBounds = mb.window.getBounds();

        // Sposta la finestra leggermente in basso
        mb.window.setBounds({
            x: windowBounds.x,
            y: windowBounds.y + 32,  // Spostamento di soli 32px verso il basso
            width: windowBounds.width,
            height: windowBounds.height
        });

        // Rendi la finestra visibile con una piccola transizione
        setTimeout(() => {
            mb.window.setOpacity(1);
        }, 50);

        console.log('Finestra riposizionata e mostrata');
    }
});

// Gestisce l'evento di chiusura dell'app
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
}); 