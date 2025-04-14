require('./mocks/setupMockElectronAPI.js'); // Mock dell’ambiente Electron

const dotenv = require('dotenv');
dotenv.config();

const { initSessionManager } = require('../services/sessionIntegration');
const { databaseService } = require('../services/DatabaseService');


(async () => {
    try {
        console.log('🧪 Avvio test sessionIntegration');

        // Inizializza il DatabaseService con Supabase (senza IndexedDB)
        await databaseService.initialize({ skipIndexedDB: true });

        // Inizializza il SessionManager tramite sessionIntegration
        const sessionManager = await initSessionManager();

        if (!sessionManager) throw new Error('SessionManager non inizializzato');

        console.log('✅ SessionManager inizializzato con successo');

        const supabase = databaseService.supabase;
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('id, assigned_to')
            .eq('completed', false)
            .limit(1);

        if (error) throw error;

        const task = tasks[0];
        if (!task) throw new Error('⚠️ Nessuna task trovata nel database');

        console.log(`📝 Avvio sessione simulata per app: ${task.assigned_to}`);

        // Simula sessione manuale
        sessionManager.startSession(task.assigned_to, task.id);

        const current = sessionManager.getCurrentSession();
        if (current) {
            console.log('✅ Sessione corrente:', current);
        } else {
            throw new Error('❌ Nessuna sessione attiva dopo startSession');
        }

        // Termina la sessione
        sessionManager.endSession();
        console.log('✅ Sessione terminata correttamente');

        process.exit(0);
    } catch (err) {
        console.error('❌ Test fallito:', err.message);
        process.exit(1);
    }
})();
