-- Update roles to default to 'user' for employees

-- Modify role column to have a default value of 'user'
ALTER TABLE public.employees 
ALTER COLUMN role SET DEFAULT 'user';

-- Update any NULL roles to 'user'
UPDATE public.employees
SET role = 'user'
WHERE role IS NULL OR role = '';

-- Ensure only admin can promote to manager
CREATE OR REPLACE FUNCTION check_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if we're changing to a more privileged role (manager or admin)
  IF (NEW.role IN ('manager', 'admin')) THEN
    -- Only permit this if the current user is an admin
    IF NOT EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email = auth.email() 
      AND (
        raw_user_meta_data->>'role' = 'admin' 
        OR raw_user_meta_data->>'is_admin' = 'true'
      )
    ) THEN
      RAISE EXCEPTION 'Only administrators can promote users to manager or admin';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add the trigger to enforce role promotion rules
DROP TRIGGER IF EXISTS enforce_role_promotion ON public.employees;
CREATE TRIGGER enforce_role_promotion
BEFORE UPDATE OF role OR INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION check_role_change();

-- Create a helper function to manually set role (only for admins)
CREATE OR REPLACE FUNCTION set_employee_role(
  employee_id INTEGER,
  new_role TEXT,
  sync_to_auth BOOLEAN DEFAULT true
)
RETURNS BOOLEAN AS $$
DECLARE
  employee_email TEXT;
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = auth.email() 
    AND (
      raw_user_meta_data->>'role' = 'admin' 
      OR raw_user_meta_data->>'is_admin' = 'true'
    )
  ) THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
    RETURN FALSE;
  END IF;

  -- Check if new_role is valid
  IF new_role NOT IN ('admin', 'manager', 'user') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, manager, or user', new_role;
    RETURN FALSE;
  END IF;
  
  -- Get employee email
  SELECT email INTO employee_email FROM public.employees WHERE id = employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee with ID % not found', employee_id;
    RETURN FALSE;
  END IF;

  -- Update role in employees table
  UPDATE public.employees SET role = new_role WHERE id = employee_id;
  
  -- Sync to auth metadata if requested
  IF sync_to_auth AND employee_email IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', new_role)
    WHERE email = employee_email;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION set_employee_role(INTEGER, TEXT, BOOLEAN) TO authenticated;
