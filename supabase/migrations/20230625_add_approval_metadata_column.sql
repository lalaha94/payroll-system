-- Add the 'approval_metadata' column to store additional approval details
ALTER TABLE public.monthly_commission_approvals
ADD COLUMN IF NOT EXISTS approval_metadata JSONB DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.monthly_commission_approvals.approval_metadata IS 'Stores additional metadata for approvals, such as timestamps or comments.';
