# Electron Menu Bar App

Un'applicazione che vive nella barra dei menu di macOS creata con Electron. Questo progetto fornisce un template per sviluppare applicazioni che risiedono nella barra dei menu invece di occupare spazio nel dock.

![Screenshot dell'applicazione](src/assets/screenshot.png)

## Caratteristiche

- Si posiziona nella barra dei menu di macOS
- Si apre con un semplice click sull'icona nella barra dei menu
- Interfaccia elegante per gestire task
- Supporta la riposizionamento automatico della finestra
- Ottimizzato per macOS con icone template

## Requisiti

- Node.js (consigliato v14 o superiore)
- npm o yarn

## Installazione

```bash
# Clona il repository
git clone https://github.com/AntonioScirica/barTasks.git

# Naviga nella directory del progetto
cd electron-menubar-app

# Installa le dipendenze
npm install
```

## Utilizzo

```bash
# Avvia l'applicazione in modalità sviluppo
npm start

# Costruisci l'applicazione per la distribuzione
npm run build
```

## Struttura del Progetto

```
electron-menubar-app/
├── src/                  # Codice sorgente
│   ├── assets/           # Icone e risorse
│   ├── index.html        # Interfaccia utente
│   ├── main.js           # Processo principale Electron
│   ├── preload.js        # Script di precaricamento
│   └── styles.css        # Stili CSS
├── package.json          # Configurazione npm
└── README.md             # Documentazione
```

## Nota sull'icona

Il file `IconTemplate.png` nella cartella `src/assets` deve essere un'immagine PNG che segue le linee guida per le icone template di macOS:
- Dovrebbe essere in bianco e nero (solo pixel bianchi o trasparenti)
- La dimensione consigliata è 22x22 pixel

## Contribuire

Contributi e suggerimenti sono benvenuti! Per favore apri una issue o una pull request per contribuire.

## Licenza

ISC 