import { supabase } from '../supabaseClient';

/**
 * Godkjenner en provisjon for en agent og logger korreksjoner hvis aktuelt.
 */
export const handleApprovalAndLogCorrection = async (agent, month, commissionData, correctionData, manager) => {
  try {
    await approveMonthlySales(
      agent,
      month,
      manager,
      parseFloat(commissionData.totalCommission),
      correctionData?.comment || ""
    );

    // Logg korreksjon
    if (correctionData) {
      const correctionLog = {
        agent_name: agent,
        month_year: month,
        correction_details: JSON.stringify(correctionData),
        manager: manager,
        timestamp: new Date(),
      };

      const { error: correctionError } = await supabase
        .from('commission_corrections')
        .insert(correctionLog);

      if (correctionError) throw correctionError;
    }
  } catch (err) {
    console.error('Feil under godkjenning og logging:', err.message);
    throw err;
  }
};

/**
 * Henter godkjente salg for admin-dashbordet.
 */
export const fetchApprovedSales = async () => {
  try {
    const { data, error } = await supabase
      .from('monthly_commission_approvals')
      .select('*')
      .eq('approved', true);

    if (error) throw error;

    return data;
  } catch (err) {
    console.error('Feil ved henting av godkjente salg:', err.message);
    return [];
  }
};

/**
 * Godkjenner månedlig salg for en agent.
 */
export const approveMonthlySales = async (agent, month, approver, approvedAmount, comment) => {
  try {
    if (!approver) {
      throw new Error("Godkjenner-ID mangler");
    }
    
    // Prøv først med RPC-funksjonen
    const { data, error } = await supabase.rpc('approve_monthly_sales', {
      p_target_agent: agent,
      p_target_month: month,
      p_approver: approver,
      p_approved_amount: approvedAmount,
      p_approval_comment: comment || null,
    });

    if (error) {
      console.error("Feil i RPC-kall:", error.message);
      throw error;
    }

    // Hvis RPC feiler, prøv direkte innsetting som backup
    if (!data) {
      const approvalData = {
        agent_name: agent,
        month_year: month,
        original_commission: approvedAmount,
        approved_commission: approvedAmount,
        approved_by: approver,
        approval_comment: comment || "",
        approved: true,
        approved_at: new Date().toISOString(),
        revoked: false
      };
      
      const { error: insertError } = await supabase
        .from('monthly_commission_approvals')
        .upsert([approvalData], { 
          onConflict: 'agent_name,month_year', 
          returning: 'minimal' 
        });
      
      if (insertError) {
        console.error("Feil ved direkte innsetting:", insertError.message);
        throw insertError;
      }
    }

    return data;
  } catch (err) {
    console.error('Feil ved godkjenning av månedlig salg:', err.message);
    throw err;
  }
};
