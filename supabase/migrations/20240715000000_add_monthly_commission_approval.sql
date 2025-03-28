-- Create a table for monthly commission approvals

CREATE TABLE IF NOT EXISTS public.monthly_commission_approvals (
    id BIGSERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    agent_email TEXT,
    month_year TEXT NOT NULL, -- Format: YYYY-MM
    agent_company TEXT,
    original_commission NUMERIC NOT NULL,
    approved_commission NUMERIC,
    approval_comment TEXT,
    approved BOOLEAN DEFAULT false,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_approvals_agent_month 
ON public.monthly_commission_approvals(agent_name, month_year);

CREATE INDEX IF NOT EXISTS idx_monthly_approvals_approved 
ON public.monthly_commission_approvals(approved);

-- Add RLS policies
ALTER TABLE public.monthly_commission_approvals ENABLE ROW LEVEL SECURITY;

-- Allow managers to view approvals for their office
CREATE POLICY "Managers can view approvals for their office"
ON public.monthly_commission_approvals FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = monthly_commission_approvals.agent_name
    )
    OR
    auth.email() = monthly_commission_approvals.agent_email
);

-- Allow managers to update approvals for their office
CREATE POLICY "Managers can update approvals for their office"
ON public.monthly_commission_approvals FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = monthly_commission_approvals.agent_name
    )
);

-- Allow managers to insert approvals
CREATE POLICY "Managers can insert approvals"
ON public.monthly_commission_approvals FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.email = auth.email()
        AND e.role = 'manager'
    )
);

-- Add a function to generate monthly commission summaries
CREATE OR REPLACE FUNCTION generate_monthly_commission_summaries(target_month TEXT)
RETURNS INTEGER AS $$
DECLARE
    records_added INTEGER := 0;
    agent_record RECORD;
BEGIN
    -- Clear existing unapproved records for the month
    DELETE FROM public.monthly_commission_approvals 
    WHERE month_year = target_month AND approved = false;
    
    -- Insert new records for each agent with sales in the month
    FOR agent_record IN 
        SELECT 
            agent_name, 
            e.email as agent_email,
            e.agent_company,
            SUM(COALESCE(commission, 0)) as total_commission
        FROM 
            public.sales_data s
        LEFT JOIN 
            public.employees e ON s.agent_name = e.name
        WHERE 
            to_char(policy_sale_date::date, 'YYYY-MM') = target_month
            AND cancel_code IS NULL
        GROUP BY 
            agent_name, e.email, e.agent_company
        HAVING 
            SUM(COALESCE(commission, 0)) > 0
    LOOP
        -- Insert summary record if it doesn't exist already
        INSERT INTO public.monthly_commission_approvals
            (agent_name, agent_email, month_year, agent_company, original_commission)
        VALUES
            (agent_record.agent_name, agent_record.agent_email, target_month, agent_record.agent_company, agent_record.total_commission)
        ON CONFLICT (agent_name, month_year) DO NOTHING;
        
        records_added := records_added + 1;
    END LOOP;
    
    RETURN records_added;
END;
$$ LANGUAGE plpgsql;

-- Add a function to mark all sales as approved for an agent and month
CREATE OR REPLACE FUNCTION approve_monthly_sales(target_agent TEXT, target_month TEXT, approver TEXT, approved_amount NUMERIC, approval_comment TEXT)
RETURNS INTEGER AS $$
DECLARE
    sales_updated INTEGER := 0;
BEGIN
    -- Update individual sales records
    UPDATE public.sales_data
    SET 
        approved_commission = true,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = approval_comment,
        modified_commission = CASE 
            WHEN commission IS NULL OR commission = 0 THEN NULL
            ELSE (commission * approved_amount / (SELECT SUM(COALESCE(commission, 0)) FROM public.sales_data 
                                                  WHERE agent_name = target_agent 
                                                  AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
                                                  AND cancel_code IS NULL))
            END
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND (approved_commission IS NULL OR approved_commission = false);
        
    GET DIAGNOSTICS sales_updated = ROW_COUNT;
    
    -- Update the monthly approval record
    UPDATE public.monthly_commission_approvals
    SET 
        approved = true,
        approved_commission = approved_amount,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = approval_comment
    WHERE 
        agent_name = target_agent
        AND month_year = target_month;
    
    RETURN sales_updated;
END;
$$ LANGUAGE plpgsql;
