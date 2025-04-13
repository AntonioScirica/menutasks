import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("[supabaseClient] Errore: Le variabili d'ambiente SUPABASE_URL e/o SUPABASE_ANON_KEY non sono impostate correttamente.");
} else {
    console.log("[supabaseClient] Variabili d'ambiente caricate correttamente. SUPABASE_URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("[supabaseClient] Supabase client inizializzato con URL:", supabaseUrl);
