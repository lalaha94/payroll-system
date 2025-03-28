-- Fix ambiguous column reference in the revoke_monthly_sales_approval function

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
        approval_comment = CONCAT(approval_comment, ' [TRUKKET TILBAKE: ', $4, ' av ', $3, ' - ', NOW(), ']')
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND approved_commission = true;
        
    GET DIAGNOSTICS sales_updated = ROW_COUNT;
    
    -- Mark the monthly approval as revoked - use positional parameters to avoid ambiguity
    UPDATE public.monthly_commission_approvals
    SET 
        revoked = true,
        revoked_by = $3,         -- Use positional parameter instead of name
        revoked_at = NOW(),
        revocation_reason = $4   -- Use positional parameter instead of name
    WHERE 
        agent_name = target_agent
        AND month_year = target_month
        AND approved = true;
    
    -- Return the number of affected sales records
    RETURN sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the updated function
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(text, text, text, text) TO authenticated;
