-- First, drop existing functions to avoid parameter naming conflicts
DROP FUNCTION IF EXISTS approve_agent_commission(text, text, text, numeric, text);
DROP FUNCTION IF EXISTS is_commission_approved(text, text);

-- Create a new, more robust function with parameters that match our React code
CREATE OR REPLACE FUNCTION approve_agent_commission(
  p_agent_name text,
  p_month_year text,
  p_approver_email text,
  p_amount numeric,
  p_comment_text text DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_agent_company TEXT;
  v_sales_count INTEGER := 0;
  v_original_amount NUMERIC := 0;
  v_adjustment_factor NUMERIC := 1;
  v_error_message TEXT;
  v_agent_exists BOOLEAN := FALSE;
  v_existing_approval BOOLEAN := FALSE;
BEGIN
  -- Validate inputs
  IF p_agent_name IS NULL OR p_month_year IS NULL OR p_approver_email IS NULL OR p_amount IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Missing required parameters',
      'affected_sales', 0
    );
  END IF;

  -- First, check if agent actually exists
  SELECT EXISTS(
    SELECT 1 FROM public.employees WHERE name = p_agent_name
  ) INTO v_agent_exists;
  
  IF NOT v_agent_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Agent does not exist: ' || p_agent_name,
      'affected_sales', 0
    );
  END IF;
  
  -- Get the agent's company
  SELECT agent_company INTO v_agent_company
  FROM public.employees
  WHERE name = p_agent_name
  LIMIT 1;
  
  -- Check if there's an existing approval that has not been revoked
  BEGIN
    SELECT approved INTO v_existing_approval
    FROM public.monthly_commission_approvals
    WHERE agent_name = p_agent_name
      AND month_year = p_month_year
      AND approved = TRUE
      AND (revoked IS NULL OR revoked = FALSE);
      
    IF v_existing_approval THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Commission already approved for ' || p_agent_name || ' in ' || p_month_year,
        'affected_sales', 0
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue if the query fails (likely because the table doesn't exist or record doesn't exist)
    v_existing_approval := FALSE;
  END;

  -- Get the total original commission amount and count eligible sales
  SELECT 
    COUNT(*),
    COALESCE(SUM(commission), 0)
  INTO
    v_sales_count,
    v_original_amount
  FROM public.sales_data
  WHERE 
    agent_name = p_agent_name
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_month_year
    AND cancel_code IS NULL;
  
  -- Validate that sales exist
  IF v_sales_count = 0 OR v_original_amount = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'No eligible sales found for ' || p_agent_name || ' in ' || p_month_year,
      'affected_sales', 0
    );
  END IF;
  
  -- Calculate adjustment factor
  IF v_original_amount > 0 THEN
    v_adjustment_factor := p_amount / v_original_amount;
  END IF;
  
  -- Start a transaction to ensure consistency
  BEGIN
    -- Update individual sales records with explicit, unambiguous statements
    UPDATE public.sales_data
    SET 
      approved_commission = TRUE,
      approved_by = p_approver_email,
      approved_at = NOW(),
      approval_comment = p_comment_text,
      modified_commission = commission * v_adjustment_factor
    WHERE 
      agent_name = p_agent_name
      AND to_char(policy_sale_date::date, 'YYYY-MM') = p_month_year
      AND cancel_code IS NULL;
    
    -- Create or update the monthly approval record
    INSERT INTO public.monthly_commission_approvals (
      agent_name,
      month_year,
      agent_company,
      original_commission,
      approved_commission,
      approved_by,
      approval_comment,
      approved,
      approved_at,
      revoked
    ) VALUES (
      p_agent_name,
      p_month_year,
      v_agent_company,
      v_original_amount,
      p_amount,
      p_approver_email,
      p_comment_text,
      TRUE,
      NOW(),
      FALSE
    )
    ON CONFLICT (agent_name, month_year) DO UPDATE
    SET 
      agent_company = v_agent_company,
      original_commission = v_original_amount,
      approved_commission = p_amount,
      approved_by = p_approver_email,
      approval_comment = p_comment_text,
      approved = TRUE,
      approved_at = NOW(),
      revoked = FALSE,
      revoked_by = NULL,
      revoked_at = NULL,
      revocation_reason = NULL;
    
    -- Build the success result
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', 'Successfully approved commission for ' || p_agent_name || ' in ' || p_month_year,
      'affected_sales', v_sales_count,
      'original_amount', v_original_amount,
      'approved_amount', p_amount
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Handle any errors during the transaction
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Error during approval: ' || v_error_message,
      'affected_sales', 0
    );
  END;
  
  -- Return the success result
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION approve_agent_commission(text, text, text, numeric, text) TO authenticated;

-- Create a utility function to check if agent is already approved
CREATE OR REPLACE FUNCTION is_commission_approved(
  p_agent_name text,
  p_month_year text
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_approved BOOLEAN := FALSE;
BEGIN
  SELECT 
    CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END INTO v_is_approved
  FROM 
    public.monthly_commission_approvals
  WHERE 
    agent_name = p_agent_name
    AND month_year = p_month_year
    AND approved = TRUE
    AND (revoked IS NULL OR revoked = FALSE);
    
  RETURN v_is_approved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION is_commission_approved(text, text) TO authenticated;
