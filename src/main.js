const { app, BrowserWindow, ipcMain, globalShortcut, powerSaveBlocker, powerMonitor } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
require('electron-reload')(__dirname);
require('dotenv').config();

// Importa il modulo utils.js per la normalizzazione dei nomi delle app
const { normalizeAppName } = require('./js/utils');

// Importa il tracker delle app
const AppTracker = require('./app-tracker.js');

// Variabile per memorizzare l'ID del blocco di risparmio energetico
let powerSaveBlockerId = null;

// Stato dei timer prima della sospensione o del blocco
let pausedTimerState = false;

// Inizializza il tracker delle app
const appTracker = new AppTracker();

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

    // Avvia il tracker delle app
    appTracker.startTracking();

    // Configura i listener per gli eventi di powerMonitor
    powerMonitor.on('suspend', () => {
        if (mb.window) {
            console.log('Sistema in standby: richiesta pausa dei timer');
            pausedTimerState = true;
            mb.window.webContents.send('power-suspend');
        }
    });

    powerMonitor.on('resume', () => {
        if (mb.window) {
            console.log('Sistema riattivato: richiesta ripresa dei timer');
            if (pausedTimerState) {
                mb.window.webContents.send('power-resume');
                pausedTimerState = false;
            }
        }
    });

    powerMonitor.on('lock-screen', () => {
        if (mb.window) {
            console.log('Schermo bloccato: richiesta pausa dei timer');
            pausedTimerState = true;
            mb.window.webContents.send('screen-locked');
        }
    });

    powerMonitor.on('unlock-screen', () => {
        if (mb.window) {
            console.log('Schermo sbloccato: richiesta ripresa dei timer');
            if (pausedTimerState) {
                mb.window.webContents.send('screen-unlocked');
                pausedTimerState = false;
            }
        }
    });
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

// Handler per ottenere le app attualmente in esecuzione
ipcMain.handle('getActiveApps', async (event) => {
    try {
        const runningApps = await appTracker.getRunningApps();
        console.log('App attive ottenute:', runningApps.length);
        return runningApps;
    } catch (error) {
        console.error('Errore nell\'ottenere le app attive:', error);
        return [];
    }
});

// Handler per ottenere l'app in primo piano
ipcMain.handle('getForegroundApp', async (event) => {
    try {
        const foregroundApp = await appTracker.getForegroundApp();
        console.log('App in primo piano:', foregroundApp);

        // Se non è stato possibile ottenere l'app in primo piano tramite AppleScript,
        // verifica se la finestra dell'app è in primo piano
        if (!foregroundApp && mb.window && mb.window.isFocused()) {
            console.log('Fallback: l\'app in primo piano è l\'app stessa');
            return 'Menubar App'; // Nome dell'app corrente
        }

        return foregroundApp;
    } catch (error) {
        console.error('Errore nell\'ottenere l\'app in primo piano:', error);
        return null;
    }
});

// Handler per controllare se il PC è attivo
ipcMain.handle('isSystemActive', (event) => {
    // In Electron non c'è un modo diretto per verificare lo stato del sistema
    // Utilizziamo una variabile di stato che viene aggiornata dagli eventi di powerMonitor
    return !pausedTimerState; // Se non ci sono eventi di sospensione o blocco, il sistema è attivo
});

// Handler per controllo diretto dei timer
ipcMain.handle('pauseAllTimers', async (event) => {
    console.log('Richiesta di pausa di tutti i timer ricevuta dal main process');
    try {
        // Esegui l'iniezione di codice nel renderer per interagire direttamente con timerService
        await mb.window.webContents.executeJavaScript(`
            (function() {
                console.log('Esecuzione pauseAllTimers via main process');
                if (typeof saveAllTimersState === 'function') {
                    saveAllTimersState();
                    console.log('Stato timer salvato');
                }
                
                // Tenta di accedere a timerService tramite metodi diversi
                let timersFound = false;
                
                // Metodo 1: tramite window.timerService
                if (typeof window.timerService !== 'undefined') {
                    console.log('timerService trovato come proprietà window');
                    const allTimers = window.timerService.getAllTimers();
                    const activeTimerCount = Object.keys(allTimers).length;
                    console.log(\`\${activeTimerCount} timer attivi trovati\`);
                    
                    // Salva lo stato di tutti i timer attivi
                    for (const taskId in allTimers) {
                        const timer = allTimers[taskId];
                        if (timer.running) {
                            window.timerService.pauseTimer(taskId);
                            console.log(\`Timer \${taskId} messo in pausa\`);
                        }
                    }
                    timersFound = true;
                }
                
                // Metodo 2: tramite activeTimers globale
                if (typeof window.activeTimers !== 'undefined' && !timersFound) {
                    console.log('activeTimers trovato come proprietà window');
                    window.activeTimers.forEach((timer, taskId) => {
                        if (timer.isRunning) {
                            // Ferma il timer
                            clearInterval(timer.interval);
                            clearInterval(timer.saveInterval);
                            timer.isRunning = false;
                            console.log(\`Timer \${taskId} messo in pausa via activeTimers\`);
                        }
                    });
                    timersFound = true;
                }
                
                // Metodo 3: tramite variabili globali
                if (typeof activeTimers !== 'undefined' && !timersFound) {
                    console.log('activeTimers trovato come variabile globale');
                    activeTimers.forEach((timer, taskId) => {
                        if (timer.isRunning) {
                            // Ferma il timer
                            clearInterval(timer.interval);
                            clearInterval(timer.saveInterval);
                            timer.isRunning = false;
                            console.log(\`Timer \${taskId} messo in pausa via variabile activeTimers\`);
                        }
                    });
                    timersFound = true;
                }
                
                return timersFound ? 'Timer pausati con successo' : 'Nessun timer trovato';
            })();
        `);

        return { success: true, message: 'Comando di pausa timer inviato' };
    } catch (error) {
        console.error('Errore nell\'esecuzione della pausa timer:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('resumeAllTimers', async (event) => {
    console.log('Richiesta di ripresa di tutti i timer ricevuta dal main process');
    try {
        // Esegui l'iniezione di codice nel renderer per interagire direttamente con timerService
        await mb.window.webContents.executeJavaScript(`
            (function() {
                console.log('Esecuzione resumeAllTimers via main process');
                
                // Tenta di accedere a timerService tramite metodi diversi
                let timersFound = false;
                
                // Metodo 1: tramite window.timerService
                if (typeof window.timerService !== 'undefined') {
                    console.log('timerService trovato come proprietà window');
                    const allTimers = window.timerService.getAllTimers();
                    const timerCount = Object.keys(allTimers).length;
                    console.log(\`\${timerCount} timer trovati\`);
                    
                    // Riprendi tutti i timer pausati
                    for (const taskId in allTimers) {
                        const timer = allTimers[taskId];
                        if (!timer.running && !timer.completed) {
                            window.timerService.resumeTimer(taskId);
                            console.log(\`Timer \${taskId} ripreso\`);
                        }
                    }
                    timersFound = true;
                }
                
                // Metodo 2: tramite activeTimers globale
                if (typeof window.activeTimers !== 'undefined' && !timersFound) {
                    console.log('activeTimers trovato come proprietà window');
                    window.activeTimers.forEach((timer, taskId) => {
                        if (!timer.isRunning) {
                            // Riavvia il timer
                            timer.lastUpdateTimestamp = Date.now();
                            timer.isRunning = true;
                            timer.interval = setInterval(() => { /* logica del timer */ }, 1000);
                            timer.saveInterval = setInterval(() => { /* logica di salvataggio */ }, 300000);
                            console.log(\`Timer \${taskId} ripreso via activeTimers\`);
                        }
                    });
                    timersFound = true;
                }
                
                // Metodo 3: tramite variabili globali
                if (typeof activeTimers !== 'undefined' && !timersFound) {
                    console.log('activeTimers trovato come variabile globale');
                    activeTimers.forEach((timer, taskId) => {
                        if (!timer.isRunning) {
                            // Riavvia il timer
                            timer.lastUpdateTimestamp = Date.now();
                            timer.isRunning = true;
                            timer.interval = setInterval(() => { /* logica del timer */ }, 1000);
                            timer.saveInterval = setInterval(() => { /* logica di salvataggio */ }, 300000);
                            console.log(\`Timer \${taskId} ripreso via variabile activeTimers\`);
                        }
                    });
                    timersFound = true;
                }
                
                if (typeof synchronizeAllTimers === 'function') {
                    synchronizeAllTimers();
                    console.log('Timer sincronizzati dopo ripresa');
                }
                
                return timersFound ? 'Timer ripresi con successo' : 'Nessun timer trovato';
            })();
        `);

        return { success: true, message: 'Comando di ripresa timer inviato' };
    } catch (error) {
        console.error('Errore nell\'esecuzione della ripresa timer:', error);
        return { success: false, error: error.message };
    }
});

// Handler per i messaggi di log
ipcMain.handle('logMessage', (event, message) => {
    console.log(message);
    return { success: true };
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

// Configura gli handler IPC per il tracker delle app
ipcMain.handle('get-app-stats', () => {
    return appTracker.getStats();
});

ipcMain.handle('refresh-app-stats', async () => {
    await appTracker.updateAppTracking();
    return appTracker.getStats();
});

// Handler per verificare se una specifica app è attiva in primo piano
ipcMain.handle('isAppActive', async (event, appName) => {
    try {
        if (!appName) return false;

        const foregroundApp = await appTracker.getForegroundApp();

        // Verifica che foregroundApp sia una stringa valida
        if (!foregroundApp || typeof foregroundApp !== 'string') {
            return false;
        }

        const isActive = normalizeAppName(foregroundApp).includes(normalizeAppName(appName));

        // Inizializza il registro degli stati se non esiste
        if (!appTracker.activeAppStates) {
            appTracker.activeAppStates = new Map();
        }

        // Log solo quando lo stato cambia, e limita la frequenza
        const now = Date.now();
        const lastStateChange = appTracker.activeAppStates.get(appName);
        const stateChanged = lastStateChange?.isActive !== isActive;
        const shouldLog = stateChanged &&
            (!lastStateChange?.timestamp || now - lastStateChange.timestamp > 10000);

        if (shouldLog) {
            console.log(`App ${appName}: stato cambiato a ${isActive ? 'attivo' : 'inattivo'}`);
            appTracker.activeAppStates.set(appName, { isActive, timestamp: now });
        }

        return isActive;
    } catch (error) {
        console.error('Errore nel verificare se l\'app è attiva:', error);
        return false;
    }
});

// Quando l'app sta per chiudersi, ferma il tracking
app.on('will-quit', () => {
    // Rimuovi tutte le shortcuts registrate
    globalShortcut.unregisterAll();

    // Ferma il tracker delle app
    appTracker.stopTracking();

    // Rimuovi il blocco di risparmio energetico se attivo
    if (powerSaveBlockerId !== null) {
        releaseAppSuspension();
    }
}); 