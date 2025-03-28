-- Fix ambiguous column reference in the approve_monthly_sales function

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
    -- Fix: Explicitly qualify the approval_comment parameter to avoid ambiguity
    UPDATE public.sales_data
    SET 
        approved_commission = true,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = $5, -- Using positional parameter reference instead of name
        modified_commission = commission * adjustment_factor
    WHERE 
        agent_name = target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
        AND cancel_code IS NULL
        AND (approved_commission IS NULL OR approved_commission = false);
        
    GET DIAGNOSTICS sales_updated = ROW_COUNT;
    
    -- Update the monthly approval record
    -- Fix: Explicitly qualify the approval_comment parameter to avoid ambiguity
    UPDATE public.monthly_commission_approvals
    SET 
        approved = true,
        approved_commission = approved_amount,
        approved_by = approver,
        approved_at = NOW(),
        approval_comment = $5 -- Using positional parameter reference instead of name
    WHERE 
        agent_name = target_agent
        AND month_year = target_month;
    
    RETURN sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the updated function
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;
