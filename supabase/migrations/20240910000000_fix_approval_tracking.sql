-- Fix the issue with approval tracking and function returning 0 approved sales

-- Debug function to inspect monthly approvals
CREATE OR REPLACE FUNCTION debug_monthly_approvals(p_agent_name TEXT, p_month TEXT)
RETURNS TABLE (
  agent_name TEXT,
  month_year TEXT,
  approved BOOLEAN,
  sales_count BIGINT,
  approved_sales_count BIGINT
) AS $$
BEGIN
  RETURN QUERY 
    SELECT 
      mca.agent_name,
      mca.month_year,
      mca.approved,
      COUNT(s.id) AS sales_count,
      SUM(CASE WHEN s.approved_commission THEN 1 ELSE 0 END)::BIGINT AS approved_sales_count
    FROM 
      public.monthly_commission_approvals mca
    LEFT JOIN 
      public.sales_data s ON 
        mca.agent_name = s.agent_name AND
        mca.month_year = to_char(s.policy_sale_date::date, 'YYYY-MM')
    WHERE 
      mca.agent_name = p_agent_name AND
      mca.month_year = p_month AND
      s.cancel_code IS NULL
    GROUP BY 
      mca.agent_name, mca.month_year, mca.approved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improved function to approve monthly sales with better tracking
CREATE OR REPLACE FUNCTION approve_monthly_sales(
  target_agent TEXT, 
  target_month TEXT, 
  approver TEXT, 
  approved_amount NUMERIC, 
  approval_comment TEXT
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
  WHERE agent_name = target_agent
    AND month_year = target_month
    AND approved = TRUE
    AND (revoked IS NULL OR revoked = FALSE);
    
  -- If already approved, raise exception
  IF v_existing_approval THEN
    RAISE EXCEPTION 'Provisjonen er allerede godkjent for % i %', target_agent, target_month;
  END IF;

  -- Get the original commission amount
  SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
  FROM public.sales_data
  WHERE agent_name = target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
    AND cancel_code IS NULL;
  
  IF v_original_amount IS NULL OR v_original_amount = 0 THEN
    RAISE EXCEPTION 'Ingen provisjon funnet for % i %', target_agent, target_month;
  END IF;
  
  -- Calculate adjustment factor (how much to scale each commission by)
  v_adjustment_factor := approved_amount / NULLIF(v_original_amount, 0);
  
  -- Update individual sales records
  UPDATE public.sales_data
  SET 
    approved_commission = TRUE,
    approved_by = approver,
    approved_at = NOW(),
    approval_comment = approval_comment,
    modified_commission = CASE 
      WHEN commission IS NOT NULL AND commission != 0 
      THEN commission * v_adjustment_factor
      ELSE NULL
    END
  WHERE 
    agent_name = target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = target_month
    AND cancel_code IS NULL
    AND (approved_commission IS NOT TRUE); -- Changed from IS NULL OR FALSE to NOT TRUE
    
  GET DIAGNOSTICS v_sales_updated = ROW_COUNT;
  
  -- Update the monthly approval record using UPSERT pattern
  INSERT INTO public.monthly_commission_approvals (
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
    target_agent,
    target_month,
    v_original_amount,
    approved_amount,
    approver,
    approval_comment,
    TRUE,
    NOW(),
    FALSE,
    (SELECT agent_company FROM public.employees WHERE name = target_agent LIMIT 1)
  )
  ON CONFLICT (agent_name, month_year) DO UPDATE 
  SET 
    approved = TRUE,
    approved_commission = approved_amount,
    approved_by = approver,
    approved_at = NOW(),
    approval_comment = approval_comment,
    revoked = FALSE,
    revoked_by = NULL,
    revoked_at = NULL,
    revocation_reason = NULL;
  
  RETURN v_sales_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set permissions
GRANT EXECUTE ON FUNCTION debug_monthly_approvals(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_monthly_sales(text, text, text, numeric, text) TO authenticated;
