DROP FUNCTION IF EXISTS approve_monthly_sales;

CREATE FUNCTION approve_monthly_sales(
  p_target_agent TEXT,
  p_target_month TEXT,
  p_approver TEXT,
  p_approved_amount NUMERIC,
  p_approval_comment TEXT DEFAULT NULL
)
RETURNS SETOF monthly_commission_approvals
LANGUAGE plpgsql
AS $$
DECLARE
  v_record monthly_commission_approvals;
BEGIN
  -- Validate input parameters
  IF p_target_agent IS NULL OR p_target_month IS NULL OR p_approver IS NULL OR p_approved_amount IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters: agent, month, approver, or amount.';
  END IF;

  -- Update the approval record
  UPDATE monthly_commission_approvals
  SET
    approved = true,
    approved_by = p_approver,
    approved_commission = p_approved_amount,
    approval_comment = COALESCE(p_approval_comment, ''),
    approved_at = NOW(),
    revoked = false,
    revoked_at = NULL,
    revocation_reason = NULL
  WHERE agent_name = p_target_agent
    AND month_year = p_target_month
  RETURNING * INTO v_record;

  -- If no record was updated, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching record found for agent % and month %.', p_target_agent, p_target_month;
  END IF;

  -- Return the updated record
  RETURN NEXT v_record;
END;
$$;
