-- Disable RLS temporarily to fix the policy
ALTER TABLE monthly_commission_approvals DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies for this table
DROP POLICY IF EXISTS "Allow managers to read their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to insert their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to update their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to delete their office approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow admins full access" ON monthly_commission_approvals;

-- Create a function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get current user email
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text AS $$
BEGIN
  RETURN coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'email', ''),
    (nullif(current_setting('request.jwt.claims', true)::json->>'email', ''))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if the user is an office manager for a specific company
CREATE OR REPLACE FUNCTION public.is_office_manager_for_company(company_name text)
RETURNS boolean AS $$
DECLARE
  user_email text;
  is_manager boolean;
BEGIN
  -- Get current user email
  user_email := public.get_current_user_email();
  
  IF user_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is a manager or admin for this company
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

-- Create a function to check if the user is an admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
DECLARE
  user_email text;
  is_admin boolean;
BEGIN
  -- Get current user email
  user_email := public.get_current_user_email();
  
  IF user_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is an admin
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE 
      email = user_email 
      AND role = 'admin'
  ) INTO is_admin;
  
  RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable RLS
ALTER TABLE monthly_commission_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies that work
CREATE POLICY "Allow read access to monthly approvals" 
ON monthly_commission_approvals FOR SELECT
USING (true); -- Everyone can read, we'll filter by company in the app

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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_commission_approvals TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_manager_for_company(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
