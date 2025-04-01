CREATE TABLE IF NOT EXISTS public.monthly_commission_approvals (
    id BIGSERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    month_year TEXT NOT NULL, -- Format: YYYY-MM
    approved BOOLEAN DEFAULT false,
    approved_commission NUMERIC,
    approved_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_approvals_agent_month 
ON public.monthly_commission_approvals (agent_name, month_year);
