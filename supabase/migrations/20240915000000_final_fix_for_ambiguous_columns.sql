-- Final definitive fix for the ambiguous column references in approve_monthly_sales

-- Drop existing version of the function so we can replace it
DROP FUNCTION IF EXISTS approve_monthly_sales(text, text, text, numeric, text);

-- Create a completely rewritten version with no ambiguity
CREATE OR REPLACE FUNCTION approve_monthly_sales(
  in_target_agent TEXT, 
  in_target_month TEXT, 
  in_approver TEXT, 
  in_approved_amount NUMERIC, 
  in_approval_comment TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_sales_updated INTEGER := 0;
  v_original_amount NUMERIC;
  v_adjustment_factor NUMERIC;
  v_existing_approval BOOLEAN := FALSE;
BEGIN
  -- First check if there's an existing approval that was not revoked
  SELECT approved INTO v_existing_approval
  FROM public.monthly_commission_approvals
  WHERE agent_name = in_target_agent
    AND month_year = in_target_month
    AND approved = TRUE
    AND (revoked IS NULL OR revoked = FALSE);
    
  -- If already approved, raise exception
  IF v_existing_approval THEN
    RAISE EXCEPTION 'Provisjonen er allerede godkjent for % i %', in_target_agent, in_target_month;
  END IF;

  -- Get the original commission amount
  SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
  FROM public.sales_data
  WHERE agent_name = in_target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = in_target_month
    AND cancel_code IS NULL;
  
  IF v_original_amount IS NULL OR v_original_amount = 0 THEN
    RAISE EXCEPTION 'Ingen provisjon funnet for % i %', in_target_agent, in_target_month;
  END IF;
  
  -- Calculate adjustment factor (how much to scale each commission by)
  v_adjustment_factor := in_approved_amount / NULLIF(v_original_amount, 0);
  
  -- Execute the sales update directly with values to avoid column name conflicts
  EXECUTE 'UPDATE public.sales_data
    SET 
      approved_commission = TRUE,
      approved_by = $1,
      approved_at = NOW(),
      approval_comment = $2,
      modified_commission = CASE 
        WHEN commission IS NOT NULL AND commission != 0 
        THEN commission * $3
        ELSE NULL
      END
    WHERE 
      agent_name = $4
      AND to_char(policy_sale_date::date, ''YYYY-MM'') = $5
      AND cancel_code IS NULL
      AND (approved_commission IS NOT TRUE)'
  USING in_approver, in_approval_comment, v_adjustment_factor, in_target_agent, in_target_month;
  
  GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
  
  -- Execute the monthly approval update directly with values
  EXECUTE 'INSERT INTO public.monthly_commission_approvals (
      agent_name, 
      month_year, 
      original_commission,
      approved_commission,
      approved_by,
      approval_comment,
      approved,
      approved_at,
      revoked,
      agent_company
    ) VALUES (
      $1, $2, $3, $4, $5, $6, TRUE, NOW(), FALSE,
      (SELECT agent_company FROM public.employees WHERE name = $1 LIMIT 1)
    )
    ON CONFLICT (agent_name, month_year) DO UPDATE 
    SET 
      approved = TRUE,
      approved_commission = $4,
      approved_by = $5,
      approved_at = NOW(),
      approval_comment = $6,
      revoked = FALSE,
      revoked_by = NULL,
      revoked_at = NULL,
      revocation_reason = NULL'
  USING in_target_agent, in_target_month, v_original_amount, in_approved_amount, in_approver, in_approval_comment;
  
  RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;

-- Create a simple version that calls the main function but is more intuitive to use
CREATE OR REPLACE FUNCTION approve_commission(
  agent_name text,
  month text,
  approver text,
  amount numeric,
  comment text DEFAULT NULL
) RETURNS INTEGER AS $$
BEGIN
  RETURN approve_monthly_sales(agent_name, month, approver, amount, comment);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the wrapper function
GRANT EXECUTE ON FUNCTION approve_commission(text, text, text, numeric, text) TO authenticated;
