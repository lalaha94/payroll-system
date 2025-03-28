-- Update delete policy to allow managers to delete employees from their own office

-- Drop the existing policy that only allows admins to delete
DROP POLICY IF EXISTS "Only admins can delete employees" ON public.employees;

-- Create new policy allowing both admins and office managers to delete employees
CREATE POLICY "Admins and managers can delete employees" 
ON public.employees
FOR DELETE
TO authenticated
USING (
  -- Admins can delete any employee
  EXISTS (
    SELECT 1 FROM public.employees admin
    WHERE admin.email = auth.email()
    AND admin.role = 'admin'
  )
  OR
  -- Managers can only delete employees from their own office
  EXISTS (
    SELECT 1 FROM public.employees manager
    WHERE manager.email = auth.email()
    AND manager.role = 'manager'
    AND manager.agent_company = employees.agent_company
  )
);
