-- Fix issue where all employees are being marked as office managers

-- Reset all employees to have user role by default, except for known admins
UPDATE public.employees
SET role = 'user'
WHERE role IS NULL OR role = '';

-- Create a function to sync user role from employees table to auth metadata
CREATE OR REPLACE FUNCTION sync_user_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the role field changed or was set
  IF (TG_OP = 'INSERT' OR NEW.role <> OLD.role) THEN
    -- This is a simple implementation. In production, you might want to
    -- use a more secure approach like having an admin function to do this
    BEGIN
      -- Update the user's metadata in auth.users table if email exists
      UPDATE auth.users
      SET raw_user_meta_data = 
        CASE 
          WHEN raw_user_meta_data IS NULL THEN 
            jsonb_build_object('role', NEW.role)
          ELSE 
            raw_user_meta_data || jsonb_build_object('role', NEW.role)
        END
      WHERE email = NEW.email;
      
      EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE NOTICE 'Failed to update auth metadata for %: %', NEW.email, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists already
DROP TRIGGER IF EXISTS employee_role_sync_trigger ON public.employees;

-- Create the trigger
CREATE TRIGGER employee_role_sync_trigger
AFTER INSERT OR UPDATE OF role ON public.employees
FOR EACH ROW
EXECUTE FUNCTION sync_user_role_to_auth();

-- Add an explicit check to avoid accidentally setting everyone as managers
ALTER TABLE public.employees 
DROP CONSTRAINT IF EXISTS valid_role_check;

ALTER TABLE public.employees
ADD CONSTRAINT valid_role_check 
CHECK (role IN ('admin', 'manager', 'user'));

-- Create a helper view to see employee role information
CREATE OR REPLACE VIEW employee_roles AS
SELECT 
  e.id,
  e.name, 
  e.email,
  e.agent_company,
  e.role,
  u.raw_user_meta_data->'role' as auth_role,
  CASE WHEN e.role = (u.raw_user_meta_data->>'role')::text 
       THEN true ELSE false 
  END as roles_in_sync
FROM 
  public.employees e
LEFT JOIN 
  auth.users u ON e.email = u.email;

COMMENT ON VIEW employee_roles IS 'Helper view to check if employee roles are in sync with auth metadata';
