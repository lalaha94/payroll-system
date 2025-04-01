-- Drop all existing functions to avoid conflicts
DROP FUNCTION IF EXISTS approve_monthly_sales(TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS approve_monthly_commission(TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS create_monthly_approval(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS validate_approval_status(TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_monthly_commission_summaries(TEXT);
DROP FUNCTION IF EXISTS is_commission_approved(TEXT, TEXT);

-- 1. Recreate approve_monthly_sales
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
    -- Hent original provisjon
    SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
    FROM public.sales_data
    WHERE agent_name = p_target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
    AND cancel_code IS NULL;

    -- Beregn justeringsfaktor
    IF v_original_amount > 0 THEN
        v_adjustment_factor := p_approved_amount / v_original_amount;
    ELSE
        v_adjustment_factor := 1;
    END IF;

    -- Oppdater kun hvis det er nødvendig
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
        AND cancel_code IS NULL
        AND (approved_commission IS DISTINCT FROM TRUE OR modified_commission IS DISTINCT FROM commission * v_adjustment_factor);

    GET DIAGNOSTICS v_sales_updated = ROW_COUNT;

    -- Sett inn eller oppdater godkjenningsposten
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

-- 2. Recreate approve_monthly_commission
CREATE OR REPLACE FUNCTION approve_monthly_commission(
    p_agent_name TEXT,
    p_month_year TEXT,
    p_approver_email TEXT,
    p_amount NUMERIC,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_sales_updated INTEGER;
BEGIN
    -- Call approve_monthly_sales
    v_sales_updated := approve_monthly_sales(
        p_agent_name, 
        p_month_year, 
        p_approver_email, 
        p_amount, 
        p_comment
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Commission approved successfully',
        'affected_sales', v_sales_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate create_monthly_approval
CREATE OR REPLACE FUNCTION create_monthly_approval(
    p_agent_name TEXT,
    p_month_year TEXT,
    p_original_commission NUMERIC,
    p_approved_commission NUMERIC,
    p_approver_email TEXT,
    p_comment TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
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
        p_agent_name, 
        p_month_year, 
        p_original_commission, 
        p_approved_commission, 
        p_approver_email, 
        p_comment, 
        TRUE, 
        NOW(), 
        FALSE
    )
    ON CONFLICT (agent_name, month_year) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate validate_approval_status
CREATE OR REPLACE FUNCTION validate_approval_status(
    p_agent_name TEXT,
    p_month_year TEXT
) RETURNS VOID AS $$
DECLARE
    v_sales_count INTEGER;
BEGIN
    -- Sjekk antall salg
    SELECT COUNT(*) INTO v_sales_count
    FROM public.sales_data
    WHERE agent_name = p_agent_name
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_month_year
    AND cancel_code IS NULL;

    -- Opprett godkjenning hvis det finnes salg
    IF v_sales_count > 0 THEN
        INSERT INTO public.monthly_commission_approvals (
            agent_name, 
            month_year, 
            approved, 
            approved_at
        ) VALUES (
            p_agent_name, 
            p_month_year, 
            FALSE, 
            NULL
        )
        ON CONFLICT (agent_name, month_year) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate generate_monthly_commission_summaries
CREATE OR REPLACE FUNCTION generate_monthly_commission_summaries(
    p_month_year TEXT
) RETURNS VOID AS $$
BEGIN
    -- Slett kun ikke-godkjente poster
    DELETE FROM public.monthly_commission_approvals
    WHERE month_year = p_month_year
    AND approved = FALSE;

    -- Sett inn nye poster for agenter med salg
    INSERT INTO public.monthly_commission_approvals (
        agent_name, 
        month_year, 
        approved, 
        approved_at
    )
    SELECT DISTINCT agent_name, p_month_year, FALSE, NULL
    FROM public.sales_data
    WHERE to_char(policy_sale_date::date, 'YYYY-MM') = p_month_year
    AND cancel_code IS NULL
    ON CONFLICT (agent_name, month_year) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recreate is_commission_approved
CREATE OR REPLACE FUNCTION is_commission_approved(
    p_agent_name TEXT,
    p_month_year TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_approved BOOLEAN;
BEGIN
    SELECT approved INTO v_is_approved
    FROM public.monthly_commission_approvals
    WHERE agent_name = p_agent_name
    AND month_year = p_month_year;

    RETURN COALESCE(v_is_approved, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
