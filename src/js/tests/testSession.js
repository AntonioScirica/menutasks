// src/tools/testSession.js
require('./mocks/setupMockElectronAPI.js'); // <-- questa DEVE essere in cima



const dotenv = require('dotenv');
dotenv.config();

const { databaseService } = require('../services/DatabaseService.js');
const SessionManager = require('../services/SessionManager.js');

(async () => {
    try {
        await databaseService.initialize({ skipIndexedDB: true });

        const supabase = databaseService.supabase;
        const sessionManager = new SessionManager(supabase);
        console.log('✅ SessionManager inizializzato');

        const { data, error } = await supabase.from('tasks').select('*').limit(1);
        if (error) throw error;

        console.log('✅ Query riuscita. Primo task:', data[0] || 'Nessun task');

        // Termina il processo dopo il completamento del test
        console.log('✅ Test completato con successo');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test fallito:', err.message);
        process.exit(1);
    }
})();
