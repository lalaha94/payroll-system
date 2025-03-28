-- Update RLS policies to allow managers to manage employees in their office

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Managers can view employees in their office" ON public.employees;
DROP POLICY IF EXISTS "Managers can edit employees in their office" ON public.employees;
DROP POLICY IF EXISTS "Managers can insert employees in their office" ON public.employees;

-- Create policy for managers to see employees in their office
CREATE POLICY "Managers can view employees in their office" 
ON public.employees
FOR SELECT
TO authenticated
USING (
  (
    -- User is a manager and employee belongs to their office
    EXISTS (
      SELECT 1 FROM public.employees manager
      WHERE manager.email = auth.email()
      AND manager.role = 'manager'
      AND manager.agent_company = employees.agent_company
    )
  ) OR
  -- User is admin (full access)
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  ) OR
  -- User is viewing their own record
  email = auth.email()
);

-- Create policy for managers to edit employees in their office
CREATE POLICY "Managers can edit employees in their office" 
ON public.employees
FOR UPDATE
TO authenticated
USING (
  (
    -- User is a manager and employee belongs to their office
    EXISTS (
      SELECT 1 FROM public.employees manager
      WHERE manager.email = auth.email()
      AND manager.role = 'manager'
      AND manager.agent_company = employees.agent_company
    )
  ) OR
  -- User is admin (full access)
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  )
) 
WITH CHECK (
  (
    -- User is a manager and employee belongs to their office
    -- and they are not trying to change the office
    EXISTS (
      SELECT 1 FROM public.employees manager
      WHERE manager.email = auth.email()
      AND manager.role = 'manager'
      AND manager.agent_company = employees.agent_company
    )
  ) OR
  -- User is admin (full access)
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  )
);

-- Create policy for managers to add new employees to their office
CREATE POLICY "Managers can insert employees in their office" 
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- User is a manager and new employee is assigned to their office
    EXISTS (
      SELECT 1 FROM public.employees manager
      WHERE manager.email = auth.email()
      AND manager.role = 'manager'
      AND manager.agent_company = employees.agent_company
    )
  ) OR
  -- User is admin (full access)
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  )
);

-- Prevent managers from deleting employees
DROP POLICY IF EXISTS "Only admins can delete employees" ON public.employees;
CREATE POLICY "Only admins can delete employees" 
ON public.employees
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  )
);
