// Questo file simula l'oggetto `window` e `window.electronAPI`
global.window = {
    electronAPI: {
        getPath: () => '/mocked/path',
        getForegroundApp: async () => 'MockedApp'
    },
    activeTimers: {},

    // Per evitare errori nei listener
    addEventListener: () => { },
    removeEventListener: () => { }
};

// Aggiungo elettronAPI globale per evitare l'errore "Cannot read properties of undefined (reading 'getPath')"
global.electronAPI = {
    getPath: () => '/mocked/path',
    getForegroundApp: async () => 'MockedApp'
};

// Mock dell'oggetto navigator del browser
global.navigator = {
    onLine: true
};

// Mock dell'oggetto document del browser
global.document = {
    hidden: false,
    addEventListener: () => { }
};

// Mock dell'intero modulo electron
const Module = require('module');
const originalRequire = Module.prototype.require;

// Sostituisci il modulo electron con un mock
Module.prototype.require = function (name) {
    if (name === 'electron') {
        return {
            app: {
                getPath: (pathName) => {
                    console.log(`Mock: app.getPath('${pathName}') chiamato`);
                    if (pathName === 'userData') {
                        return '/tmp/mocked-user-data';
                    }
                    return '/mocked/path';
                },
                on: () => { }
            }
        };
    }

    return originalRequire.apply(this, arguments);
};

// Mock di startTaskTimer e stopTaskTimer per evitare errori
global.window.startTaskTimer = () => { };
global.window.stopTaskTimer = () => { };
