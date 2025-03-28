-- Fix function parameter order issues by implementing a more robust function

-- Drop the existing functions
DROP FUNCTION IF EXISTS approve_monthly_sales(text, text, text, numeric, text);
DROP FUNCTION IF EXISTS revoke_monthly_sales_approval(text, text, text, text);

-- Create a more robust version that uses named parameters to avoid order-dependent issues
CREATE OR REPLACE FUNCTION approve_monthly_sales(
    target_agent text,     -- keep original parameter name for backward compatibility
    target_month text,     -- keep original parameter name for backward compatibility
    approver text,         -- keep original parameter name for backward compatibility
    approved_amount numeric, -- keep original parameter name for backward compatibility
    approval_comment text  -- keep original parameter name for backward compatibility
) RETURNS INTEGER AS $$
DECLARE
    v_sales_updated INTEGER := 0;
    v_original_amount NUMERIC;
    v_adjustment_factor NUMERIC;
BEGIN
    -- Get the original commission amount
    SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
    FROM public.sales_data
    WHERE agent_name = target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
    AND cancel_code IS NULL;
    
    -- Calculate adjustment factor (how much to scale each commission by)
    IF v_original_amount > 0 THEN
        v_adjustment_factor := approved_amount / v_original_amount;
    ELSE
        v_adjustment_factor := 1; -- No adjustment if original is zero
    END IF;
    
    -- Update individual sales records with clear column names to avoid ambiguity
    UPDATE public.sales_data
    SET 
        approved_commission = TRUE,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = approve_monthly_sales.approval_comment, -- fully qualify to avoid ambiguity
        modified_commission = CASE 
            WHEN commission IS NOT NULL AND commission != 0 
            THEN commission * v_adjustment_factor
            ELSE NULL
        END
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND (approved_commission IS NULL OR approved_commission = FALSE);
        
    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
    
    -- Update the monthly approval record with unambiguous column references
    UPDATE public.monthly_commission_approvals
    SET 
        approved = TRUE,
        approved_commission = approve_monthly_sales.approved_amount, -- fully qualify
        approved_by = approve_monthly_sales.approver, -- fully qualify
        approved_at = NOW(),
        approval_comment = approve_monthly_sales.approval_comment -- fully qualify
    WHERE 
        agent_name = target_agent
        AND month_year = target_month;
    
    RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more robust revoke function
CREATE OR REPLACE FUNCTION revoke_monthly_sales_approval(
    target_agent text,      -- keep original parameter name for backward compatibility 
    target_month text,      -- keep original parameter name for backward compatibility
    revoked_by text,        -- keep original parameter name for backward compatibility
    revocation_reason text  -- keep original parameter name for backward compatibility
) RETURNS INTEGER AS $$
DECLARE
    v_sales_updated INTEGER := 0;
BEGIN
    -- First check if the approval exists
    IF NOT EXISTS (
        SELECT 1 FROM public.monthly_commission_approvals 
        WHERE agent_name = target_agent
        AND month_year = target_month
        AND approved = TRUE
        AND (revoked IS NULL OR revoked = FALSE)
    ) THEN
        RAISE EXCEPTION 'Ingen godkjent provisjon funnet for % i %', target_agent, target_month;
    END IF;

    -- Revert individual sales records approval
    UPDATE public.sales_data
    SET 
        approved_commission = FALSE,
        modified_commission = NULL,
        approval_comment = CONCAT(
            COALESCE(approval_comment, ''), 
            ' [TRUKKET TILBAKE: ', 
            revoke_monthly_sales_approval.revocation_reason,  -- fully qualify
            ' av ', 
            revoke_monthly_sales_approval.revoked_by,  -- fully qualify
            ' - ', 
            NOW(), 
            ']'
        )
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND approved_commission = TRUE;
        
    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
    
    -- Mark the monthly approval as revoked with unambiguous references
    UPDATE public.monthly_commission_approvals
    SET 
        revoked = TRUE,
        revoked_by = revoke_monthly_sales_approval.revoked_by,  -- fully qualify
        revoked_at = NOW(),
        revocation_reason = revoke_monthly_sales_approval.revocation_reason  -- fully qualify
    WHERE 
        agent_name = target_agent
        AND month_year = target_month
        AND approved = TRUE;
    
    -- Return the number of affected sales records
    RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(text, text, text, text) TO authenticated;

-- Add a wrapper function to handle possible parameter order issues
CREATE OR REPLACE FUNCTION approve_monthly_commission(
    agent_name text,
    month_year text,
    approver text,
    approved_amount numeric,
    comment_text text DEFAULT NULL
) RETURNS INTEGER AS $$
BEGIN
    RETURN approve_monthly_sales(
        agent_name,   -- target_agent
        month_year,   -- target_month
        approver,     -- approver
        approved_amount, -- approved_amount
        comment_text  -- approval_comment
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION approve_monthly_commission(text, text, text, numeric, text) TO authenticated;
