-- Fix the security context for functions that need to bypass RLS

-- First, update functions to use SECURITY DEFINER to bypass RLS
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
            e.salary_model_id,
            SUM(COALESCE(commission, 0)) as total_commission
        FROM 
            public.sales_data s
        LEFT JOIN 
            public.employees e ON s.agent_name = e.name
        WHERE 
            to_char(policy_sale_date::date, 'YYYY-MM') = target_month
            AND cancel_code IS NULL
        GROUP BY 
            agent_name, e.email, e.agent_company, e.salary_model_id
        HAVING 
            SUM(COALESCE(commission, 0)) > 0
    LOOP
        -- Insert or update summary record
        INSERT INTO public.monthly_commission_approvals
            (agent_name, agent_email, month_year, agent_company, original_commission, salary_model_id)
        VALUES
            (
                agent_record.agent_name, 
                agent_record.agent_email, 
                target_month, 
                agent_record.agent_company, 
                agent_record.total_commission,
                agent_record.salary_model_id
            )
        ON CONFLICT (agent_name, month_year) 
        DO UPDATE SET 
            original_commission = agent_record.total_commission,
            salary_model_id = agent_record.salary_model_id,
            agent_email = agent_record.agent_email,
            agent_company = agent_record.agent_company
        WHERE NOT monthly_commission_approvals.approved;
        
        records_added := records_added + 1;
    END LOOP;
    
    RETURN records_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the approve_monthly_sales function
CREATE OR REPLACE FUNCTION approve_monthly_sales(target_agent TEXT, target_month TEXT, approver TEXT, approved_amount NUMERIC, approval_comment TEXT)
RETURNS INTEGER AS $$
DECLARE
    sales_updated INTEGER := 0;
    original_amount NUMERIC;
    adjustment_factor NUMERIC;
BEGIN
    -- Get the original commission amount
    SELECT SUM(COALESCE(commission, 0)) INTO original_amount
    FROM public.sales_data
    WHERE agent_name = target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
    AND cancel_code IS NULL;
    
    -- Calculate adjustment factor (how much to scale each commission by)
    IF original_amount > 0 THEN
        adjustment_factor := approved_amount / original_amount;
    ELSE
        adjustment_factor := 1; -- No adjustment if original is zero
    END IF;
    
    -- Update individual sales records
    UPDATE public.sales_data
    SET 
        approved_commission = true,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = approval_comment,
        modified_commission = commission * adjustment_factor
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix RLS policies to ensure proper access
DROP POLICY IF EXISTS "Managers can insert approvals" ON public.monthly_commission_approvals;
CREATE POLICY "Managers can insert approvals" ON public.monthly_commission_approvals
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.email = auth.email()
        AND (e.role = 'manager' OR e.role = 'admin')
    )
);

-- Allow admins full access to monthly approvals
DROP POLICY IF EXISTS "Admins have full access to monthly approvals" ON public.monthly_commission_approvals;
CREATE POLICY "Admins have full access to monthly approvals" ON public.monthly_commission_approvals
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.email = auth.email()
        AND e.role = 'admin'
    )
);

-- Grant function execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION generate_monthly_commission_summaries(text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;

-- Update the insert policy to be more permissive for testing
DROP POLICY IF EXISTS "Allow all inserts on monthly approvals for testing" ON public.monthly_commission_approvals;
CREATE POLICY "Allow all inserts on monthly approvals for testing" ON public.monthly_commission_approvals
FOR INSERT TO authenticated
WITH CHECK (true);
