// Il file renderer.js può essere vuoto o contenere altre funzionalità necessarie 

// Gestisce il focus automatico sull'input
function focusTaskInput() {
    const taskInput = document.getElementById('taskInput');
    if (taskInput) {
        taskInput.focus();
        taskInput.select();
    }
}

// Focus iniziale quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    focusTaskInput();
});

// Focus quando la finestra viene mostrata
window.electronAPI.onFocusInput(() => {
    focusTaskInput();
}); 