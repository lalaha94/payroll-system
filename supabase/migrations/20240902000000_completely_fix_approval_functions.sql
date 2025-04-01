-- Completely rewrite the approve_monthly_sales function to avoid any ambiguous column references

-- Ensure the function handles updates and inserts correctly
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
    -- Calculate the original commission amount
    SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
    FROM public.sales_data
    WHERE agent_name = p_target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
    AND cancel_code IS NULL;

    -- Calculate adjustment factor
    IF v_original_amount > 0 THEN
        v_adjustment_factor := p_approved_amount / v_original_amount;
    ELSE
        v_adjustment_factor := 1;
    END IF;

    -- Update sales data
    UPDATE public.sales_data
    SET 
        approved_commission = TRUE,
        approved_by = p_approver,
        approved_at = NOW(),
        approval_comment = p_approval_comment,
        modified_commission = commission * v_adjustment_factor
    WHERE 
        agent_name = p_target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
        AND cancel_code IS NULL;

    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;

    -- Insert or update the monthly approval record
    INSERT INTO public.monthly_commission_approvals (
        agent_name, 
        month_year, 
        original_commission, 
        approved_commission, 
        approved_by, 
        approval_comment, 
        approved, 
        approved_at, 
        revoked
    ) VALUES (
        p_target_agent, 
        p_target_month, 
        v_original_amount, 
        p_approved_amount, 
        p_approver, 
        p_approval_comment, 
        TRUE, 
        NOW(), 
        FALSE
    )
    ON CONFLICT (agent_name, month_year) DO UPDATE
    SET 
        approved_commission = p_approved_amount,
        approved_by = p_approver,
        approved_at = NOW(),
        approval_comment = p_approval_comment,
        revoked = FALSE;

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
GRANT EXECUTE ON FUNCTION approve_monthly_sales(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(TEXT, TEXT, TEXT, TEXT) TO authenticated;
