-- Legg til nye kolonner for to-trinns godkjenning
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

-- Legg til en sjekk for å sikre at admin ikke kan godkjenne før kontorleder
ALTER TABLE monthly_commission_approvals
ADD CONSTRAINT manager_approval_required 
CHECK (
  (admin_approved = false) OR 
  (admin_approved = true AND manager_approved = true)
); 