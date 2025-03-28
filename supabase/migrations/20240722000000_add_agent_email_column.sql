-- Check if agent_email column already exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'monthly_commission_approvals'
        AND column_name = 'agent_email'
    ) THEN
        ALTER TABLE public.monthly_commission_approvals ADD COLUMN agent_email TEXT;

        -- Populate agent_email field from employees table
        UPDATE public.monthly_commission_approvals mca
        SET agent_email = e.email
        FROM public.employees e
        WHERE mca.agent_name = e.name
        AND mca.agent_email IS NULL;
    END IF;
END
$$;

-- Update the generate_monthly_commission_summaries function to include agent_email
CREATE OR REPLACE FUNCTION generate_monthly_commission_summaries(target_month TEXT)
RETURNS INTEGER AS $$
DECLARE
    records_added INTEGER := 0;
    agent_record RECORD;
BEGIN
    -- Clear existing unapproved records for the month
    DELETE FROM public.monthly_commission_approvals 
    WHERE month_year = target_month AND approved = false;
    
    -- Insert new records for each agent with sales in the month
    FOR agent_record IN 
        SELECT 
            agent_name, 
            e.email as agent_email,
            e.agent_company,
            e.salary_model_id,
            SUM(COALESCE(commission, 0)) as total_commission
        FROM 
            public.sales_data s
        LEFT JOIN 
            public.employees e ON s.agent_name = e.name
        WHERE 
            to_char(policy_sale_date::date, 'YYYY-MM') = target_month
            AND cancel_code IS NULL
        GROUP BY 
            agent_name, e.email, e.agent_company, e.salary_model_id
        HAVING 
            SUM(COALESCE(commission, 0)) > 0
    LOOP
        -- Insert or update summary record
        INSERT INTO public.monthly_commission_approvals
            (agent_name, agent_email, month_year, agent_company, original_commission, salary_model_id)
        VALUES
            (
                agent_record.agent_name, 
                agent_record.agent_email, 
                target_month, 
                agent_record.agent_company, 
                agent_record.total_commission,
                agent_record.salary_model_id
            )
        ON CONFLICT (agent_name, month_year) 
        DO UPDATE SET 
            original_commission = agent_record.total_commission,
            salary_model_id = agent_record.salary_model_id,
            agent_email = agent_record.agent_email,
            agent_company = agent_record.agent_company
        WHERE NOT monthly_commission_approvals.approved;
        
        records_added := records_added + 1;
    END LOOP;
    
    RETURN records_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
