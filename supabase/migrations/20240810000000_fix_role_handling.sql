-- Fix issues with role handling and ensure correct default values

-- Set default role for employees to 'user'
ALTER TABLE public.employees 
ALTER COLUMN role SET DEFAULT 'user';

-- Reset all employee roles to 'user' except for explicitly marked managers and admins
UPDATE public.employees
SET role = 'user'
WHERE role IS NULL OR role = '' OR role NOT IN ('admin', 'manager', 'user');

-- Update auth metadata for employees
CREATE OR REPLACE FUNCTION update_employee_role_in_auth()
RETURNS VOID AS $$
DECLARE
  employee_record RECORD;
BEGIN
  -- Get all employees
  FOR employee_record IN SELECT id, email, role FROM public.employees
  LOOP
    -- Update auth metadata for each employee if email exists
    IF employee_record.email IS NOT NULL THEN
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', employee_record.role)
      WHERE email = employee_record.email;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function for diagnoting and fixing role issues
CREATE OR REPLACE FUNCTION fix_employee_roles()
RETURNS TABLE(
  employee_id INTEGER,
  employee_name TEXT,
  employee_email TEXT,
  old_role TEXT,
  new_role TEXT,
  auth_updated BOOLEAN
) AS $$
DECLARE
  rec RECORD;
  updated BOOLEAN;
BEGIN
  FOR rec IN 
    SELECT e.id, e.name, e.email, e.role as old_role, 
           COALESCE(e.role, 'user') as new_role
    FROM public.employees e
    WHERE e.role IS NULL OR e.role = ''
  LOOP
    -- Update the role in employees table
    UPDATE public.employees 
    SET role = 'user' 
    WHERE id = rec.id;
    
    -- Try to update auth metadata
    BEGIN
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'user')
      WHERE email = rec.email;
      
      GET DIAGNOSTICS updated = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      updated := FALSE;
    END;
    
    employee_id := rec.id;
    employee_name := rec.name;
    employee_email := rec.email;
    old_role := rec.old_role;
    new_role := 'user';
    auth_updated := updated;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_employee_role_in_auth() TO postgres;
GRANT EXECUTE ON FUNCTION fix_employee_roles() TO postgres;
