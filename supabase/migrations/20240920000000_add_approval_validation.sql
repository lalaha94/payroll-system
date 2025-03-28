-- Add a function to validate the approval status between tables

CREATE OR REPLACE FUNCTION validate_approval_status(
  in_agent_name TEXT, 
  in_month TEXT
) RETURNS JSONB AS $$
DECLARE
  v_status JSONB;
  v_approval RECORD;
  v_sales_count INTEGER;
  v_approved_count INTEGER;
  v_fixed INTEGER := 0;
BEGIN
  -- Get approval record
  SELECT * INTO v_approval 
  FROM public.monthly_commission_approvals
  WHERE agent_name = in_agent_name
    AND month_year = in_month;
  
  -- Count sales records
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN approved_commission THEN 1 ELSE 0 END) as approved
  INTO 
    v_sales_count, v_approved_count
  FROM public.sales_data
  WHERE agent_name = in_agent_name
    AND to_char(policy_sale_date::date, 'YYYY-MM') = in_month
    AND cancel_code IS NULL;
  
  -- If we have an approved monthly record but no approved sales, or vice versa,
  -- we need to sync them
  IF v_approval IS NOT NULL AND v_approval.approved = TRUE AND v_approval.revoked = FALSE AND v_approved_count = 0 THEN
    -- Monthly record shows approved but no sales are approved - sync sales records
    UPDATE public.sales_data
    SET 
      approved_commission = TRUE,
      approved_by = v_approval.approved_by,
      approved_at = v_approval.approved_at,
      approval_comment = COALESCE(v_approval.approval_comment, 'Auto-synced')
    WHERE 
      agent_name = in_agent_name
      AND to_char(policy_sale_date::date, 'YYYY-MM') = in_month
      AND cancel_code IS NULL;
      
    GET DIAGNOSTICS v_fixed = ROW_COUNT;
    
  ELSIF v_approved_count > 0 AND (v_approval IS NULL OR v_approval.approved = FALSE) THEN
    -- Sales are approved but monthly record isn't - create/update monthly record
    INSERT INTO public.monthly_commission_approvals (
      agent_name,
      month_year,
      approved,
      approved_commission,
      approved_by,
      approved_at,
      approval_comment
    ) VALUES (
      in_agent_name,
      in_month,
      TRUE,
      (SELECT SUM(COALESCE(modified_commission, commission)) FROM public.sales_data 
       WHERE agent_name = in_agent_name 
       AND to_char(policy_sale_date::date, 'YYYY-MM') = in_month
       AND approved_commission = TRUE),
      (SELECT approved_by FROM public.sales_data 
       WHERE agent_name = in_agent_name 
       AND to_char(policy_sale_date::date, 'YYYY-MM') = in_month
       AND approved_commission = TRUE
       LIMIT 1),
      NOW(),
      'Auto-synced from sales records'
    )
    ON CONFLICT (agent_name, month_year) DO UPDATE
    SET 
      approved = TRUE,
      approved_commission = EXCLUDED.approved_commission,
      approved_by = EXCLUDED.approved_by,
      approved_at = EXCLUDED.approved_at,
      approval_comment = EXCLUDED.approval_comment,
      revoked = FALSE;
      
    v_fixed := 1;
  END IF;
  
  -- Return status info
  v_status := jsonb_build_object(
    'agent_name', in_agent_name,
    'month', in_month,
    'monthly_approval', v_approval,
    'sales_count', v_sales_count,
    'approved_sales', v_approved_count,
    'status', CASE 
      WHEN v_approval IS NULL THEN 'no_monthly_record'
      WHEN v_approval.approved AND NOT v_approval.revoked THEN 'approved'
      WHEN v_approval.revoked THEN 'revoked'
      ELSE 'not_approved'
    END,
    'fixed', v_fixed
  );
  
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_approval_status(TEXT, TEXT) TO authenticated;
