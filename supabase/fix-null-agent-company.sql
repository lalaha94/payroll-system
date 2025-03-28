-- Enhanced script to fix null agent_company values in monthly_commission_approvals

-- First, examine all records with null agent_company
SELECT 
  id, 
  agent_name, 
  month_year, 
  agent_company, 
  approved, 
  revoked 
FROM 
  monthly_commission_approvals
WHERE 
  agent_company IS NULL;

-- Update records with null agent_company based on employee records
UPDATE 
  monthly_commission_approvals mca
SET
  agent_company = e.agent_company
FROM
  employees e
WHERE
  mca.agent_name = e.name
  AND mca.agent_company IS NULL;

-- Check if we still have any null values after the update
SELECT 
  id, 
  agent_name, 
  month_year, 
  agent_company, 
  approved, 
  revoked 
FROM 
  monthly_commission_approvals
WHERE 
  agent_company IS NULL;

-- If we still have null values for specific agents like Tobias Magnussen,
-- manually update them with the correct company
UPDATE monthly_commission_approvals
SET agent_company = 'DS Kristiansand'
WHERE agent_name = 'Tobias Magnussen'
AND agent_company IS NULL;

-- For any other remaining null values, set a default company if appropriate
-- or delete them if they're invalid records
UPDATE monthly_commission_approvals
SET agent_company = 'Unknown Company'
WHERE agent_company IS NULL;

-- Final verification that all nulls are fixed
SELECT 
  id, 
  agent_name, 
  month_year, 
  agent_company, 
  approved, 
  revoked 
FROM 
  monthly_commission_approvals
WHERE 
  agent_company IS NULL;
