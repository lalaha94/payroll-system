CREATE TABLE IF NOT EXISTS public.logs (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX logs_table_name_idx ON public.logs (table_name);
CREATE INDEX logs_operation_idx ON public.logs (operation);
CREATE INDEX logs_created_at_idx ON public.logs (created_at);

-- Add appropriate permissions
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.logs TO postgres, anon, authenticated, service_role;
