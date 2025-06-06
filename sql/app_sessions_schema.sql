-- Schema per la tabella app_sessions in Supabase
CREATE TABLE public.app_sessions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms BIGINT NOT NULL,
    total_paused_time_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT session_id_unique UNIQUE (session_id)
);

-- Indici per migliorare performance
CREATE INDEX idx_app_sessions_task_id ON public.app_sessions(task_id);
CREATE INDEX idx_app_sessions_app_name ON public.app_sessions(app_name);
CREATE INDEX idx_app_sessions_start_time ON public.app_sessions(start_time);

-- Permessi RLS (Row Level Security)
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

-- Policy di lettura/scrittura per utenti autenticati
CREATE POLICY "App sessions are viewable by authenticated users" 
ON public.app_sessions FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "App sessions are insertable by authenticated users" 
ON public.app_sessions FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "App sessions are updatable by authenticated users" 
ON public.app_sessions FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Commenti sulla tabella e colonne
COMMENT ON TABLE public.app_sessions IS 'Memorizza le sessioni di utilizzo delle applicazioni per il tracciamento del tempo';
COMMENT ON COLUMN public.app_sessions.session_id IS 'ID univoco generato dal client per la sessione';
COMMENT ON COLUMN public.app_sessions.app_name IS 'Nome dell''applicazione tracciata';
COMMENT ON COLUMN public.app_sessions.task_id IS 'ID della task associata alla sessione';
COMMENT ON COLUMN public.app_sessions.start_time IS 'Timestamp di inizio della sessione';
COMMENT ON COLUMN public.app_sessions.end_time IS 'Timestamp di fine della sessione';
COMMENT ON COLUMN public.app_sessions.duration_ms IS 'Durata effettiva della sessione in millisecondi (escluse pause)';
COMMENT ON COLUMN public.app_sessions.total_paused_time_ms IS 'Tempo totale di pausa durante la sessione in millisecondi'; 