const { app, BrowserWindow, ipcMain, globalShortcut, powerSaveBlocker } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
require('electron-reload')(__dirname);
require('dotenv').config();

// Variabile per memorizzare l'ID del blocco di risparmio energetico
let powerSaveBlockerId = null;

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
        height: 500,
        borderRadius: 24,
        resizable: true,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false // Disattiva il throttling in background
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

    // Attiva il blocco di risparmio energetico all'avvio per i timer
    preventAppSuspension();
});

// Funzione per prevenire la sospensione dell'app
function preventAppSuspension(reason = 'timer_active') {
    if (powerSaveBlockerId === null) {
        // Usa powerSaveBlocker.start per mantenere il sistema attivo
        // 'prevent-app-suspension' impedisce che l'app vada in sospensione ma permette lo spegnimento dello schermo
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
        console.log(`Blocco risparmio energetico attivato (ID: ${powerSaveBlockerId}). Motivo: ${reason}`);
    } else {
        console.log(`Blocco risparmio energetico già attivo (ID: ${powerSaveBlockerId})`);
    }
    return powerSaveBlockerId;
}

// Funzione per rimuovere il blocco di risparmio energetico
function releaseAppSuspension() {
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        console.log(`Blocco risparmio energetico rimosso (ID: ${powerSaveBlockerId})`);
        powerSaveBlockerId = null;
    }
}

// Gestisci richieste IPC dal renderer
ipcMain.handle('preventAppSuspension', (event, reason) => {
    return preventAppSuspension(reason);
});

ipcMain.handle('releaseAppSuspension', (event) => {
    releaseAppSuspension();
    return true;
});

ipcMain.handle('getAppSuspensionStatus', (event) => {
    return {
        active: powerSaveBlockerId !== null,
        id: powerSaveBlockerId
    };
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

// Rimuovi le shortcut e il blocco risparmio energetico quando l'app viene chiusa
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    releaseAppSuspension();
}); 