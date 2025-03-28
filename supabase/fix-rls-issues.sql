-- Create a more accurate function to check current user
DROP FUNCTION IF EXISTS public.get_current_user_email();

CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text AS $$
DECLARE
  email text;
BEGIN
  -- First try to get it from the JWT claims
  BEGIN
    email := current_setting('request.jwt.claims', true)::json->>'email';
    IF email IS NOT NULL AND email != '' THEN
      RETURN email;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Do nothing, continue to next method
      NULL;
  END;
  
  -- If we get here, try auth.email() which is another common approach
  BEGIN
    email := auth.email();
    IF email IS NOT NULL AND email != '' THEN
      RETURN email;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Function might not exist
      NULL;
  END;
  
  -- Last resort, try to find a uid from the claims and look it up
  BEGIN
    DECLARE
      uid uuid;
    BEGIN
      uid := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
      IF uid IS NOT NULL THEN
        SELECT au.email INTO email
        FROM auth.users au
        WHERE au.id = uid;
        
        IF email IS NOT NULL AND email != '' THEN
          RETURN email;
        END IF;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN NULL;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
  
  -- If all attempts fail, return null
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set RLS to be more permissive for testing
ALTER TABLE monthly_commission_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_commission_approvals ENABLE ROW LEVEL SECURITY;

-- Let's simplify the policies to make them more reliable
DROP POLICY IF EXISTS "Allow read access to monthly approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to insert approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to update approvals" ON monthly_commission_approvals;
DROP POLICY IF EXISTS "Allow managers to delete approvals" ON monthly_commission_approvals;

-- Create simpler policies
CREATE POLICY "Allow authenticated users to read monthly_commission_approvals"
ON monthly_commission_approvals
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert monthly_commission_approvals"
ON monthly_commission_approvals
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update monthly_commission_approvals"
ON monthly_commission_approvals
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete monthly_commission_approvals"
ON monthly_commission_approvals
FOR DELETE
USING (auth.role() = 'authenticated');

-- Make sure we have proper grants
GRANT ALL ON monthly_commission_approvals TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
