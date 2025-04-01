CREATE TABLE IF NOT EXISTS public.commission_corrections (
    id BIGSERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    month_year TEXT NOT NULL, -- Format: YYYY-MM
    correction_details JSONB NOT NULL,
    manager TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_agent_month 
ON public.commission_corrections (agent_name, month_year);
