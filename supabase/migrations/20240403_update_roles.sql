-- Først, legg til role-kolonnen hvis den ikke finnes
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent';

-- Først, dropp den eksisterende constraint
ALTER TABLE employees
DROP CONSTRAINT IF EXISTS valid_role_check;

-- Legg til den nye constraint som tillater de riktige rollene
ALTER TABLE employees
ADD CONSTRAINT valid_role_check 
CHECK (role IN ('admin', 'manager', 'user', 'agent'));

-- Oppdater eksisterende brukere
UPDATE employees
SET role = 
  CASE 
    WHEN position ILIKE '%admin%' THEN 'admin'
    WHEN position ILIKE '%leder%' OR position ILIKE '%manager%' THEN 'manager'
    WHEN role = 'user' THEN 'agent'
    ELSE role
  END;

-- For å manuelt sette roller for spesifikke brukere:
-- UPDATE employees SET role = 'admin' WHERE email = 'admin@example.com';
-- UPDATE employees SET role = 'manager' WHERE email = 'manager@example.com'; 