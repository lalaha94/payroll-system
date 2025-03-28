-- First, drop both functions completely to avoid parameter name errors
DROP FUNCTION IF EXISTS approve_monthly_sales(text, text, text, numeric, text);
DROP FUNCTION IF EXISTS revoke_monthly_sales_approval(text, text, text, text);

-- Now recreate both functions with proper parameter naming
CREATE OR REPLACE FUNCTION approve_monthly_sales(
    p_target_agent TEXT, 
    p_target_month TEXT, 
    p_approver TEXT, 
    p_approved_amount NUMERIC, 
    p_approval_comment TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_sales_updated INTEGER := 0;
    v_original_amount NUMERIC;
    v_adjustment_factor NUMERIC;
BEGIN
    -- Get the original commission amount
    SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
    FROM public.sales_data
    WHERE agent_name = p_target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
    AND cancel_code IS NULL;
    
    -- Calculate adjustment factor (how much to scale each commission by)
    IF v_original_amount > 0 THEN
        v_adjustment_factor := p_approved_amount / v_original_amount;
    ELSE
        v_adjustment_factor := 1; -- No adjustment if original is zero
    END IF;
    
    -- Update individual sales records
    UPDATE public.sales_data
    SET 
        approved_commission = TRUE,
        approved_by = p_approver,
        approved_at = NOW(),
        approval_comment = p_approval_comment,
        modified_commission = CASE 
            WHEN commission IS NOT NULL AND commission != 0 
            THEN commission * v_adjustment_factor
            ELSE NULL
        END
    WHERE 
        agent_name = p_target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
        AND cancel_code IS NULL
        AND (approved_commission IS NULL OR approved_commission = FALSE);
        
    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
    
    -- Update the monthly approval record
    UPDATE public.monthly_commission_approvals
    SET 
        approved = TRUE,
        approved_commission = p_approved_amount,
        approved_by = p_approver,
        approved_at = NOW(),
        approval_comment = p_approval_comment
    WHERE 
        agent_name = p_target_agent
        AND month_year = p_target_month;
    
    RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Similarly, rewrite the revoke function with the same pattern
CREATE OR REPLACE FUNCTION revoke_monthly_sales_approval(
    p_target_agent TEXT, 
    p_target_month TEXT, 
    p_revoked_by TEXT, 
    p_revocation_reason TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_sales_updated INTEGER := 0;
BEGIN
    -- First check if the approval exists
    IF NOT EXISTS (
        SELECT 1 FROM public.monthly_commission_approvals 
        WHERE agent_name = p_target_agent
        AND month_year = p_target_month
        AND approved = TRUE
        AND (revoked IS NULL OR revoked = FALSE)
    ) THEN
        RAISE EXCEPTION 'Ingen godkjent provisjon funnet for % i %', p_target_agent, p_target_month;
    END IF;

    -- Revert individual sales records approval
    UPDATE public.sales_data
    SET 
        approved_commission = FALSE,
        modified_commission = NULL,
        approval_comment = CONCAT(
            COALESCE(approval_comment, ''), 
            ' [TRUKKET TILBAKE: ', 
            p_revocation_reason, 
            ' av ', 
            p_revoked_by, 
            ' - ', 
            NOW(), 
            ']'
        )
    WHERE 
        agent_name = p_target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
        AND cancel_code IS NULL
        AND approved_commission = TRUE;
        
    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
    
    -- Mark the monthly approval as revoked
    UPDATE public.monthly_commission_approvals
    SET 
        revoked = TRUE,
        revoked_by = p_revoked_by,
        revoked_at = NOW(),
        revocation_reason = p_revocation_reason
    WHERE 
        agent_name = p_target_agent
        AND month_year = p_target_month
        AND approved = TRUE;
    
    -- Return the number of affected sales records
    RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(text, text, text, text) TO authenticated;
