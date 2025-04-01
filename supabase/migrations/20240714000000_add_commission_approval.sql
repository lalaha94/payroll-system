-- Add columns for commission approval process

-- Add approval status to sales_data
ALTER TABLE public.sales_data
ADD COLUMN IF NOT EXISTS approved_commission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_comment TEXT,
ADD COLUMN IF NOT EXISTS modified_commission NUMERIC,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster filtering of approved/unapproved commissions
CREATE INDEX IF NOT EXISTS idx_sales_data_approved_commission ON public.sales_data(approved_commission);

-- Add a table to track approval history
CREATE TABLE IF NOT EXISTS public.commission_approval_history (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT REFERENCES public.sales_data(id),
    agent_name TEXT NOT NULL,
    original_commission NUMERIC,
    modified_commission NUMERIC,
    approved BOOLEAN NOT NULL,
    comment TEXT,
    approved_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.commission_approval_history ENABLE ROW LEVEL SECURITY;

-- Allow managers to see approval history for their office
CREATE POLICY "Managers can view approval history for their office"
ON public.commission_approval_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = agent_name
    )
);

-- Allow managers to insert approval history
CREATE POLICY "Managers can insert approval history"
ON public.commission_approval_history FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees
        WHERE email = auth.email()
        AND role = 'manager'
    )
);

-- Add policies for sales_data approvals
CREATE POLICY "Managers can approve commissions for their office"
ON public.sales_data FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = sales_data.agent_name
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = sales_data.agent_name
    )
);

-- Add unique constraint to prevent duplicate approvals for the same agent and month
ALTER TABLE public.monthly_commission_approvals 
ADD CONSTRAINT unique_agent_month_approval UNIQUE (agent_name, month_year);

-- Ensure indexes exist for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_commission_approvals_agent_month 
ON public.monthly_commission_approvals (agent_name, month_year);

CREATE INDEX IF NOT EXISTS idx_monthly_commission_approvals_approved 
ON public.monthly_commission_approvals (approved, revoked);
