-- Add additional columns to store employee details that need to persist
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS tjenestetorget_deduction NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bytt_deduction NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sick_leave TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_skade_override NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_liv_override NUMERIC DEFAULT NULL;
  
-- Add comments for clarity
COMMENT ON COLUMN public.employees.tjenestetorget_deduction IS 'Deduction amount for Tjenestetorget';
COMMENT ON COLUMN public.employees.bytt_deduction IS 'Deduction amount for Bytt';
COMMENT ON COLUMN public.employees.other_deductions IS 'Other deduction amounts';
COMMENT ON COLUMN public.employees.base_salary IS 'Base salary amount';
COMMENT ON COLUMN public.employees.bonus IS 'Bonus amount';
COMMENT ON COLUMN public.employees.sick_leave IS 'Sick leave information';
COMMENT ON COLUMN public.employees.commission_skade_override IS 'Override for skade commission rate';
COMMENT ON COLUMN public.employees.commission_liv_override IS 'Override for liv commission rate';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(name);
