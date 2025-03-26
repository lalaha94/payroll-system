-- Create a table to track salary model history
CREATE TABLE IF NOT EXISTS public.salary_step_history (
    id BIGSERIAL PRIMARY KEY,
    salary_model_id INTEGER REFERENCES public.salary_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    commission_liv NUMERIC,
    commission_skade NUMERIC,
    base_salary NUMERIC,
    bonus_enabled BOOLEAN DEFAULT false,
    bonus_threshold NUMERIC,
    bonus_percentage_liv NUMERIC,
    bonus_percentage_skade NUMERIC,
    changed_by TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    previous_values JSONB,
    operation TEXT NOT NULL
);

-- Add indexes for better performance
CREATE INDEX salary_step_history_model_id_idx ON public.salary_step_history (salary_model_id);
CREATE INDEX salary_step_history_changed_at_idx ON public.salary_step_history (changed_at);

-- Add appropriate permissions
ALTER TABLE public.salary_step_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.salary_step_history TO postgres, service_role;
GRANT SELECT, INSERT ON public.salary_step_history TO authenticated;
GRANT USAGE ON SEQUENCE public.salary_step_history_id_seq TO authenticated;

-- RLS policy to allow authenticated users to view and insert history records
CREATE POLICY "Users can view salary history" 
    ON public.salary_step_history 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Users can insert salary history" 
    ON public.salary_step_history 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
