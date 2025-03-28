-- Add revocation function and capability for monthly commission approvals

-- Add revocation fields to monthly_commission_approvals table
ALTER TABLE public.monthly_commission_approvals 
ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS revoked_by TEXT,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_approvals_revoked ON public.monthly_commission_approvals(revoked);

-- Create a function to revoke monthly sales approval
CREATE OR REPLACE FUNCTION revoke_monthly_sales_approval(
    target_agent TEXT, 
    target_month TEXT, 
    revoked_by TEXT, 
    revocation_reason TEXT)
RETURNS INTEGER AS $$
DECLARE
    sales_updated INTEGER := 0;
BEGIN
    -- First check if the approval exists
    IF NOT EXISTS (
        SELECT 1 FROM public.monthly_commission_approvals 
        WHERE agent_name = target_agent
        AND month_year = target_month
        AND approved = true
        AND (revoked IS NULL OR revoked = false)
    ) THEN
        RAISE EXCEPTION 'Ingen godkjent provisjon funnet for % i %', target_agent, target_month;
    END IF;

    -- Revert individual sales records approval
    UPDATE public.sales_data
    SET 
        approved_commission = false,
        modified_commission = NULL,
        approval_comment = CONCAT(approval_comment, ' [TRUKKET TILBAKE: ', revocation_reason, ' av ', revoked_by, ' - ', NOW(), ']')
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND approved_commission = true;
        
    GET DIAGNOSTICS sales_updated = ROW_COUNT;
    
    -- Mark the monthly approval as revoked
    UPDATE public.monthly_commission_approvals
    SET 
        revoked = true,
        revoked_by = revoked_by,
        revoked_at = NOW(),
        revocation_reason = revocation_reason
    WHERE 
        agent_name = target_agent
        AND month_year = target_month
        AND approved = true;
    
    -- Return the number of affected sales records
    RETURN sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(text, text, text, text) TO authenticated;

-- Update the approvals table RLS to handle revocations
DROP POLICY IF EXISTS "Managers can revoke approvals for their office" ON public.monthly_commission_approvals;
CREATE POLICY "Managers can revoke approvals for their office" ON public.monthly_commission_approvals
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.employees e2 ON e.agent_company = e2.agent_company
        WHERE e.email = auth.email()
        AND e.role = 'manager'
        AND e2.name = monthly_commission_approvals.agent_name
    )
);
