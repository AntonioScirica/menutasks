const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class AppTracker {
    constructor() {
        this.trackingData = {};
        this.dataFilePath = path.join(app.getPath('userData'), 'app-tracking-data.json');
        this.updateInterval = null;
        this.foregroundApp = null;
        this.lastRunningAppsLog = null;
        this.logTimestamp = null;
    }

    // Carica dati esistenti
    loadTrackingData() {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                this.trackingData = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf8'));
                console.log('Dati di tracciamento caricati');
            }
        } catch (error) {
            console.error('Errore nel caricamento dei dati:', error);
        }
    }

    // Salva i dati 
    saveTrackingData() {
        try {
            fs.writeFileSync(this.dataFilePath, JSON.stringify(this.trackingData), 'utf8');
        } catch (error) {
            console.error('Errore nel salvare i dati:', error);
        }
    }

    // Ottieni app in esecuzione
    getRunningApps() {
        return new Promise((resolve, reject) => {
            const script = 'tell application "System Events" to get name of every process where background only is false';

            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Errore nell\'ottenere le app in esecuzione:', error);
                    // Restituisce un array vuoto invece di rejettare
                    resolve([]);
                    return;
                }

                // Assicuriamo che lo stdout sia una stringa non vuota
                if (!stdout || !stdout.trim()) {
                    console.warn('Nessuna app in esecuzione trovata');
                    resolve([]);
                    return;
                }

                // Splitta il risultato e pulisci gli spazi
                const apps = stdout.trim().split(', ').map(app => app.trim()).filter(app => app);

                // Riduciamo la frequenza dei log - solo una volta ogni 5 minuti o al primo avvio
                const now = Date.now();
                if (!this.lastRunningAppsLog || now - this.lastRunningAppsLog > 300000) {
                    console.log(`App in esecuzione trovate: ${apps.length}`);
                    this.lastRunningAppsLog = now;
                }

                resolve(apps);
            });
        });
    }

    // Ottieni l'app in primo piano
    getForegroundApp() {
        return new Promise((resolve, reject) => {
            const script = 'tell application "System Events" to get name of first process whose frontmost is true';

            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Errore nell\'ottenere l\'app in primo piano:', error);
                    resolve(null);
                    return;
                }

                const foregroundApp = stdout.trim();

                // Log solo quando cambia l'app in primo piano
                if (this.foregroundApp !== foregroundApp) {
                    // Si può anche limitare ulteriormente il log per essere più sintetico
                    if (!this.logTimestamp || Date.now() - this.logTimestamp > 10000) {  // Max un log ogni 10 secondi
                        console.log(`App in primo piano cambiata: ${foregroundApp}`);
                        this.logTimestamp = Date.now();
                    }
                }

                this.foregroundApp = foregroundApp;
                resolve(foregroundApp);
            });
        });
    }

    // Aggiorna il tracking
    async updateAppTracking() {
        try {
            const runningApps = await this.getRunningApps();
            const currentTime = new Date().getTime();

            // Aggiorna app in esecuzione
            runningApps.forEach(appName => {
                if (!this.trackingData[appName]) {
                    this.trackingData[appName] = {
                        firstSeen: currentTime,
                        lastSeen: currentTime,
                        totalRunningTime: 0,
                        isRunning: true,
                        lastStartTime: currentTime
                    };
                } else if (!this.trackingData[appName].isRunning) {
                    this.trackingData[appName].isRunning = true;
                    this.trackingData[appName].lastStartTime = currentTime;
                    this.trackingData[appName].lastSeen = currentTime;
                } else {
                    this.trackingData[appName].lastSeen = currentTime;
                }
            });

            // Controlla app chiuse
            Object.keys(this.trackingData).forEach(appName => {
                if (this.trackingData[appName].isRunning && !runningApps.includes(appName)) {
                    const runningTime = currentTime - this.trackingData[appName].lastStartTime;
                    this.trackingData[appName].totalRunningTime += runningTime;
                    this.trackingData[appName].isRunning = false;
                }
            });

            this.saveTrackingData();

        } catch (error) {
            console.error('Errore nell\'aggiornamento del tracciamento:', error);
        }
    }

    // Inizia il tracking
    startTracking(intervalMs = 30000) {
        this.loadTrackingData();
        this.updateInterval = setInterval(() => this.updateAppTracking(), intervalMs);
        console.log('Tracciamento app avviato');
        return this;
    }

    // Ferma il tracking
    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('Tracciamento app fermato');
        }
    }

    // Ottieni statistiche
    getStats() {
        const stats = {};
        const currentTime = new Date().getTime();

        Object.keys(this.trackingData).forEach(appName => {
            const appData = this.trackingData[appName];
            let totalTime = appData.totalRunningTime;

            if (appData.isRunning) {
                totalTime += (currentTime - appData.lastStartTime);
            }

            stats[appName] = {
                totalRunningTime: totalTime,
                isRunning: appData.isRunning,
                formattedTime: this.formatTime(totalTime)
            };
        });

        return stats;
    }

    // Formatta il tempo
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
}

module.exports = AppTracker; 