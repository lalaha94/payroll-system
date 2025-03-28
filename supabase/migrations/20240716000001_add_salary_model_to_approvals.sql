-- Add salary_model_id column to monthly_commission_approvals table
ALTER TABLE public.monthly_commission_approvals
ADD COLUMN IF NOT EXISTS salary_model_id INTEGER;

-- Update existing records to match employees table
UPDATE public.monthly_commission_approvals mca
SET salary_model_id = e.salary_model_id
FROM public.employees e
WHERE mca.agent_name = e.name
AND mca.salary_model_id IS NULL;
