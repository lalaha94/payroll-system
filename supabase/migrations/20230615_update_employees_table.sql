-- 1. Rename start_date to hire_date to match application code
ALTER TABLE public.employees RENAME COLUMN start_date TO hire_date;

-- 2. Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_agent_company ON public.employees(agent_company);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_salary_model_id ON public.employees(salary_model_id);

-- 3. Add comments for clarity
COMMENT ON COLUMN public.employees.hire_date IS 'Date when the employee was hired';
COMMENT ON COLUMN public.employees.apply_five_percent_deduction IS 'Whether to apply 5% deduction to commission calculation';

-- 4. Make sure the UI can filter employees with agent_company IS NULL
ALTER TABLE public.employees ALTER COLUMN agent_company SET DEFAULT NULL;
