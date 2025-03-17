const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
require('electron-reload')(__dirname);

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
        width: 600,
        height: 400,
        borderRadius: 24,
        resizable: true,
        transparent: true,
        backgroundColor: '#00000000',
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

    // Registra la shortcut Option+L
    globalShortcut.register('Alt+L', () => {
        if (mb.window.isVisible()) {
            mb.hideWindow();
        } else {
            mb.showWindow();
        }
    });
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
            y: windowBounds.y + 12,  // Spostamento di soli 32px verso il basso
            width: windowBounds.width,
            height: windowBounds.height
        });

        // Rendi la finestra visibile con un piccolo delay
        setTimeout(() => {
            mb.window.setOpacity(1);
            // Invia l'evento per il focus
            mb.window.webContents.send('focus-input');
        }, 100);

        // Aggiungi l'event listener per il mouseleave
        let closeTimeout;

        // Funzione per gestire il mouseleave
        const handleMouseLeave = () => {
            closeTimeout = setTimeout(() => {
                mb.hideWindow();
            }, 200);
        };

        // Funzione per gestire il mouseenter
        const handleMouseEnter = () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
            }
        };

        // Aggiungi gli event listener alla finestra
        mb.window.on('blur', handleMouseLeave);
        mb.window.on('focus', handleMouseEnter);

        // Aggiungi anche gli event listener al contenuto web
        mb.window.webContents.on('mouse-leave', handleMouseLeave);
        mb.window.webContents.on('mouse-enter', handleMouseEnter);

        console.log('Finestra riposizionata e mostrata');
    }
});

// Gestisce l'evento di chiusura dell'app
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Rimuovi le shortcut quando l'app viene chiusa
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
}); 