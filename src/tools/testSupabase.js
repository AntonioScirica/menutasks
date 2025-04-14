const dotenv = require('dotenv');
dotenv.config();

const { initializeSupabaseOnly } = require('../js/services/DatabaseService.js');

(async () => {
    try {
        const supabase = await initializeSupabaseOnly();

        const { data, error } = await supabase.from('projects').select('*').limit(1);
        if (error) throw error;

        console.log('✅ Supabase connesso. Progetto esempio:', data[0] || 'nessuno');
    } catch (err) {
        console.error('❌ Test fallito:', err.message);
    }
})();
