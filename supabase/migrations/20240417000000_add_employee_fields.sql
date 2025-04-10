-- Add additional columns for the extended employee information
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS mentor TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ny',
  ADD COLUMN IF NOT EXISTS personal_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS work_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS private_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS higher_education BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS business_insurance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS f2100_access TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS access_package TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tff BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS property_register BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cv_reference BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS population_register BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS police_certificate BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_training BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gos_ais BOOLEAN DEFAULT FALSE;
  
-- Add comments for clarity
COMMENT ON COLUMN public.employees.mentor IS 'Mentor or responsible advisor for the employee';
COMMENT ON COLUMN public.employees.signature IS 'Signature identifier';
COMMENT ON COLUMN public.employees.status IS 'Employee status (e.g., New, Active)';
COMMENT ON COLUMN public.employees.personal_id IS 'National ID number';
COMMENT ON COLUMN public.employees.end_date IS 'Employment end date';
COMMENT ON COLUMN public.employees.work_phone IS 'Work phone number';
COMMENT ON COLUMN public.employees.private_phone IS 'Private phone number';
COMMENT ON COLUMN public.employees.higher_education IS 'Has general university admissions certification or higher';
COMMENT ON COLUMN public.employees.business_insurance IS 'Has business insurance';
COMMENT ON COLUMN public.employees.f2100_access IS 'Access level in F2100 system';
COMMENT ON COLUMN public.employees.access_package IS 'Ordered access package';
COMMENT ON COLUMN public.employees.tff IS 'TFF status';
COMMENT ON COLUMN public.employees.property_register IS 'Property register access';
COMMENT ON COLUMN public.employees.cv_reference IS 'Has CV/references/recommendation';
COMMENT ON COLUMN public.employees.population_register IS 'Population register access';
COMMENT ON COLUMN public.employees.police_certificate IS 'Has police certificate';
COMMENT ON COLUMN public.employees.basic_training IS 'Completed basic training';
COMMENT ON COLUMN public.employees.gos_ais IS 'GOS/AIS status';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_personal_id ON public.employees(personal_id); 