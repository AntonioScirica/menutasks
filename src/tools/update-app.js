// src/tools/update-app.js

const { databaseService } = require('../js/services/DatabaseService');

/**
 * Aggiorna direttamente la colonna tracked_app di una task
 * @param {number|string} taskId - ID della task da aggiornare
 * @param {string} appName - Nome dell'app da tracciare
 * @returns {Promise<Object>} - Task aggiornata
 */
async function forceUpdateTrackedApp(taskId, appName) {
    console.log(`Tentativo di aggiornamento forzato della task ${taskId} con app ${appName}`);

    await databaseService.initialize();
    const supabase = databaseService.supabase;

    // Ottieni la task
    const { data: tasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId);

    if (fetchError) throw fetchError;
    if (!tasks || tasks.length === 0) throw new Error(`Task con ID ${taskId} non trovata`);

    console.log('Task trovata:', tasks[0]);
    console.log('Valore tracked_app attuale:', tasks[0].tracked_app);

    // Esegui l'aggiornamento
    const { error: updateError } = await supabase
        .from('tasks')
        .update({ tracked_app: appName })
        .eq('id', taskId);

    if (updateError) throw updateError;
    console.log('✅ Aggiornamento eseguito, verifico...');

    // Verifica
    const { data: updatedTasks, error: checkError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId);

    if (checkError) throw checkError;
    if (!updatedTasks || updatedTasks.length === 0) throw new Error('Task non trovata dopo l\'aggiornamento');

    const updatedTask = updatedTasks[0];
    console.log('Task aggiornata:', updatedTask);
    console.log('Nuovo valore tracked_app:', updatedTask.tracked_app);

    if (updatedTask.tracked_app !== appName) {
        console.warn(`ATTENZIONE: L'aggiornamento non sembra essere stato applicato!`);
        console.warn(`Atteso: ${appName}, Attuale: ${updatedTask.tracked_app}`);
    } else {
        console.log('✅ Aggiornamento verificato con successo!');
    }

    return updatedTask;
}

window.forceUpdateTrackedApp = forceUpdateTrackedApp;

function testUpdate(taskId, appName) {
    if (!taskId || !appName) {
        console.error('Specifica un ID task e nome app validi');
        return;
    }

    return forceUpdateTrackedApp(taskId, appName)
        .then(result => {
            console.log('Test completato:', result);
            console.log(`%c Aggiornamento task ${taskId} con app ${appName}:`, 'background: #4CAF50; color: white; padding: 2px 5px;');
            console.log(`%c Risultato: ${result.tracked_app === appName ? 'SUCCESSO' : 'FALLIMENTO'}`,
                `background: ${result.tracked_app === appName ? '#4CAF50' : '#F44336'}; color: white; padding: 2px 5px;`);
            return result;
        })
        .catch(error => {
            console.error('Test fallito:', error);
            return null;
        });
}

window.testUpdateTrackedApp = testUpdate;
