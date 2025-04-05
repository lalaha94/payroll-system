-- Legg til nye kolonner i monthly_commission_approvals
ALTER TABLE monthly_commission_approvals
ADD COLUMN IF NOT EXISTS manager_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS manager_approved_by TEXT,
ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_approved_by TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- Oppdater eksisterende godkjenninger
UPDATE monthly_commission_approvals
SET 
  manager_approved = approved,
  manager_approved_at = approved_at,
  manager_approved_by = approved_by,
  admin_approved = approved,
  admin_approved_at = approved_at,
  admin_approved_by = approved_by,
  approval_status = CASE 
    WHEN approved = true THEN 'approved'
    ELSE 'pending'
  END
WHERE approved = true;

-- Oppdater employees tabellen
UPDATE employees
SET role = 
  CASE 
    WHEN position ILIKE '%admin%' OR email = 'roar@salespayroll.no' THEN 'admin'
    WHEN position ILIKE '%leder%' OR position ILIKE '%manager%' THEN 'manager'
    ELSE 'agent'
  END;

-- Sett spesifikke roller
UPDATE employees SET role = 'admin' WHERE email = 'roar@salespayroll.no';

-- Vis oppdaterte roller
SELECT name, email, position, role FROM employees ORDER BY role; 