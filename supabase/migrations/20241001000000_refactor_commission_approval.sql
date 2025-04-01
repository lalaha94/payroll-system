-- 1. Fjern eksisterende funksjoner og policies som skal erstattes
DROP FUNCTION IF EXISTS approve_monthly_sales(TEXT, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS revoke_monthly_sales_approval(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.is_authenticated();
DROP FUNCTION IF EXISTS public.get_current_user_email();
DROP FUNCTION IF EXISTS public.is_office_manager_for_company(TEXT);
DROP FUNCTION IF EXISTS public.is_admin_user();

DROP POLICY IF EXISTS "Allow managers to read their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to insert their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to update their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to delete their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow admins full access" ON monthly_commission_approvals;

-- 2. Oppdater tabeller og indekser
ALTER TABLE public.sales_data
ADD COLUMN IF NOT EXISTS approved_commission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_comment TEXT,
ADD COLUMN IF NOT EXISTS modified_commission NUMERIC,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_sales_data_approved_commission ON public.sales_data(approved_commission);

ALTER TABLE public.monthly_commission_approvals 
ADD CONSTRAINT unique_agent_month_approval UNIQUE (agent_name, month_year);

CREATE INDEX IF NOT EXISTS idx_monthly_commission_approvals_agent_month 
ON public.monthly_commission_approvals (agent_name, month_year);

CREATE INDEX IF NOT EXISTS idx_monthly_commission_approvals_approved 
ON public.monthly_commission_approvals (approved, revoked);

-- 3. Opprett nye funksjoner
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text AS $$
BEGIN
  RETURN coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'email', ''),
    (nullif(current_setting('request.jwt.claims', true)::json->>'email', ''))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_office_manager_for_company(company_name text)
RETURNS boolean AS $$
DECLARE
  user_email text;
  is_manager boolean;
BEGIN
  user_email := public.get_current_user_email();
  IF user_email IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE 
      email = user_email 
      AND agent_company = company_name
      AND (role = 'manager' OR role = 'admin')
  ) INTO is_manager;
  RETURN is_manager;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
DECLARE
  user_email text;
  is_admin boolean;
BEGIN
  user_email := public.get_current_user_email();
  IF user_email IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE 
      email = user_email 
      AND role = 'admin'
  ) INTO is_admin;
  RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    SELECT SUM(COALESCE(commission, 0)) INTO v_original_amount
    FROM public.sales_data
    WHERE agent_name = p_target_agent
    AND to_char(policy_sale_date::date, 'YYYY-MM') = p_target_month
    AND cancel_code IS NULL;

    IF v_original_amount > 0 THEN
        v_adjustment_factor := p_approved_amount / v_original_amount;
    ELSE
        v_adjustment_factor := 1;
    END IF;

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

-- 4. Opprett nye policies
ALTER TABLE monthly_commission_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to monthly approvals" 
ON monthly_commission_approvals FOR SELECT
USING (true);

CREATE POLICY "Allow managers to insert approvals" 
ON monthly_commission_approvals FOR INSERT
WITH CHECK (
  public.is_authenticated() AND 
  (public.is_office_manager_for_company(agent_company) OR public.is_admin_user())
);

CREATE POLICY "Allow managers to update approvals" 
ON monthly_commission_approvals FOR UPDATE
USING (
  public.is_authenticated() AND 
  (public.is_office_manager_for_company(agent_company) OR public.is_admin_user())
);

CREATE POLICY "Allow managers to delete approvals" 
ON monthly_commission_approvals FOR DELETE
USING (
  public.is_authenticated() AND 
  (public.is_office_manager_for_company(agent_company) OR public.is_admin_user())
);

-- 5. Gi nødvendige tillatelser
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_commission_approvals TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_manager_for_company(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION approve_monthly_sales(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
