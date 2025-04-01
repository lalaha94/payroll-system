-- Reset all existing commission approval functions
DROP FUNCTION IF EXISTS approve_monthly_sales;
DROP FUNCTION IF EXISTS revoke_monthly_sales_approval;

-- Create a more robust version of approve_monthly_sales
CREATE OR REPLACE FUNCTION approve_monthly_sales(
    p_target_agent TEXT, 
    p_target_month TEXT, 
    p_approver TEXT, 
    p_approved_amount NUMERIC, 
    p_approval_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_error TEXT;
    v_agent_company TEXT;
    v_original_commission NUMERIC := 0;
    v_sales_count INTEGER := 0;
    v_approvals_count INTEGER := 0;
BEGIN
    -- Input validation
    IF p_target_agent IS NULL OR p_target_month IS NULL OR p_approver IS NULL OR p_approved_amount IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Missing required parameters',
            'details', json_build_object(
                'agent', p_target_agent,
                'month', p_target_month,
                'approver', p_approver,
                'amount', p_approved_amount
            )
        );
    END IF;

    -- Get agent company for record keeping
    BEGIN
        SELECT agent_company INTO v_agent_company 
        FROM employees 
        WHERE name = p_target_agent 
        LIMIT 1;
        
        -- If no company found, use a default
        IF v_agent_company IS NULL THEN
            -- Try to determine company from approver
            SELECT agent_company INTO v_agent_company
            FROM employees
            WHERE email = p_approver
            LIMIT 1;
            
            -- If still no company, use a placeholder
            IF v_agent_company IS NULL THEN
                v_agent_company := 'Unknown';
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_agent_company := 'Unknown';
    END;

    -- Get sales data for target month to calculate original commission
    SELECT 
        COUNT(*),
        COALESCE(SUM(commission), 0)
    INTO 
        v_sales_count,
        v_original_commission
    FROM 
        sales_data
    WHERE 
        agent_name = p_target_agent
        AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
        AND (cancel_code IS NULL OR cancel_code = '');

    -- Log the data for debugging
    RAISE NOTICE 'Approval request for agent: %, month: %, approver: %, amount: %',
        p_target_agent, p_target_month, p_approver, p_approved_amount;
    RAISE NOTICE 'Agent company: %, original commission: %, sales count: %',
        v_agent_company, v_original_commission, v_sales_count;

    -- Insert or update the approval record
    INSERT INTO monthly_commission_approvals (
        agent_name,
        month_year,
        agent_company,
        original_commission,
        approved_commission,
        approved_by,
        approval_comment,
        approved,
        approved_at,
        revoked,
        revoked_by,
        revoked_at,
        revocation_reason
    ) 
    VALUES (
        p_target_agent,
        p_target_month,
        v_agent_company,
        v_original_commission,
        p_approved_amount,
        p_approver,
        p_approval_comment,
        TRUE,
        NOW(),
        FALSE,
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (agent_name, month_year) 
    DO UPDATE SET
        agent_company = EXCLUDED.agent_company,
        original_commission = EXCLUDED.original_commission,
        approved_commission = EXCLUDED.approved_commission,
        approved_by = EXCLUDED.approved_by,
        approval_comment = EXCLUDED.approval_comment,
        approved = TRUE,
        approved_at = NOW(),
        revoked = FALSE,
        revoked_by = NULL,
        revoked_at = NULL,
        revocation_reason = NULL;

    GET DIAGNOSTICS v_approvals_count = ROW_COUNT;

    -- Build result object with detailed information
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Approved commission for ' || p_target_agent || ' for month ' || p_target_month,
        'details', jsonb_build_object(
            'agent', p_target_agent,
            'month', p_target_month,
            'approver', p_approver,
            'agent_company', v_agent_company,
            'original_commission', v_original_commission,
            'approved_amount', p_approved_amount,
            'sales_count', v_sales_count,
            'approvals_updated', v_approvals_count
        )
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'details', jsonb_build_object(
            'agent', p_target_agent,
            'month', p_target_month,
            'approver', p_approver,
            'amount', p_approved_amount
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a similarly robust revocation function
CREATE OR REPLACE FUNCTION revoke_monthly_sales_approval(
    p_target_agent TEXT, 
    p_target_month TEXT, 
    p_revoked_by TEXT, 
    p_revocation_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_error TEXT;
    v_approvals_count INTEGER := 0;
    v_approval_record_exists BOOLEAN := FALSE;
BEGIN
    -- Input validation
    IF p_target_agent IS NULL OR p_target_month IS NULL OR p_revoked_by IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Missing required parameters',
            'details', jsonb_build_object(
                'agent', p_target_agent,
                'month', p_target_month,
                'revoked_by', p_revoked_by
            )
        );
    END IF;

    -- Check if approval record exists
    SELECT EXISTS(
        SELECT 1 
        FROM monthly_commission_approvals 
        WHERE agent_name = p_target_agent 
          AND month_year = p_target_month
          AND approved = TRUE
          AND (revoked IS NULL OR revoked = FALSE)
    ) INTO v_approval_record_exists;

    IF NOT v_approval_record_exists THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No valid approval record found to revoke',
            'details', jsonb_build_object(
                'agent', p_target_agent,
                'month', p_target_month
            )
        );
    END IF;

    -- Log the revocation request
    RAISE NOTICE 'Revocation request for agent: %, month: %, revoked by: %',
        p_target_agent, p_target_month, p_revoked_by;

    -- Update the approval record to mark as revoked
    UPDATE monthly_commission_approvals
    SET 
        revoked = TRUE,
        revoked_by = p_revoked_by,
        revoked_at = NOW(),
        revocation_reason = p_revocation_reason
    WHERE 
        agent_name = p_target_agent
        AND month_year = p_target_month
        AND approved = TRUE
        AND (revoked IS NULL OR revoked = FALSE);

    GET DIAGNOSTICS v_approvals_count = ROW_COUNT;

    -- Build result object
    v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Revoked approval for ' || p_target_agent || ' for month ' || p_target_month,
        'details', jsonb_build_object(
            'agent', p_target_agent,
            'month', p_target_month,
            'revoked_by', p_revoked_by,
            'approvals_updated', v_approvals_count
        )
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', v_error,
        'details', jsonb_build_object(
            'agent', p_target_agent,
            'month', p_target_month,
            'revoked_by', p_revoked_by
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION approve_monthly_sales(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_monthly_sales_approval(TEXT, TEXT, TEXT, TEXT) TO authenticated;
