-- Add role column to employees table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.employees ADD COLUMN role text DEFAULT 'user';
    END IF;
END
$$;

-- Update existing employees table with default role
UPDATE public.employees
SET role = 'user'
WHERE role IS NULL;

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);

-- Create RLS policy for managing employee roles
DROP POLICY IF EXISTS "Admins can manage employee roles" ON public.employees;
CREATE POLICY "Admins can manage employee roles" ON public.employees
    USING (true)
    WITH CHECK (
        (SELECT is_admin FROM get_auth_user_info() WHERE is_admin = true)
        OR
        (SELECT role FROM get_auth_user_info() WHERE role = 'admin')
    );

COMMENT ON COLUMN public.employees.role IS 'User role such as user, manager, or admin';
