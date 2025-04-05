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
 * Sjekker om en månedlig godkjenning allerede eksisterer
 */
export const checkMonthlyApprovalExists = async (agent, month) => {
  try {
    console.log(`Sjekker om godkjenning eksisterer for ${agent}, måned ${month}`);
    
    const { data, error } = await supabase
      .from('monthly_commission_approvals')
      .select('*')
      .eq('agent_name', agent)
      .eq('month_year', month);
      
    if (error) {
      console.error('Feil ved sjekk av eksisterende godkjenning:', error.message);
      console.error('Detaljer:', error.details || 'Ingen detaljer');
      console.error('Hint:', error.hint || 'Ingen hint');
      return { exists: false, error: error };
    }
    
    console.log(`Fant ${data?.length || 0} eksisterende godkjenninger`);
    
    return { 
      exists: data && data.length > 0, 
      data: data 
    };
  } catch (err) {
    console.error('Uventet feil ved sjekk av eksisterende godkjenning:', err.message);
    return { exists: false, error: err };
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
    
    console.log(`Forsøker å godkjenne månedlig salg for ${agent}, måned ${month}, godkjenner: ${approver}, beløp: ${approvedAmount}`);
    
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
      console.error("Detaljer:", error.details || "Ingen detaljer");
      console.error("Hint:", error.hint || "Ingen hint");
      console.error("Kode:", error.code || "Ingen kode");
      
      // Hvis feilen skyldes at tabellen approvals ikke eksisterer, er det sannsynligvis
      // fordi serveren bruker monthly_commission_approvals
      if (error.message && error.message.includes("approvals")) {
        console.warn("Mistanke om at RPC-kallet refererer til en foreldet tabell. Faller tilbake til direkte innsetting.");
      }
      
      throw error;
    }

    // Hvis RPC feiler, prøv direkte innsetting som backup
    if (!data) {
      console.log("Ingen data fra RPC-kall. Prøver direkte innsetting i monthly_commission_approvals.");
      
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
      
      console.log("Forsøker direkte innsetting med data:", approvalData);
      
      const { error: insertError } = await supabase
        .from('monthly_commission_approvals')
        .upsert([approvalData], { 
          onConflict: 'agent_name,month_year', 
          returning: 'minimal' 
        });
      
      if (insertError) {
        console.error("Feil ved direkte innsetting:", insertError.message);
        console.error("Detaljer:", insertError.details || "Ingen detaljer");
        console.error("Hint:", insertError.hint || "Ingen hint");
        console.error("Kode:", insertError.code || "Ingen kode");
        throw insertError;
      }
      
      console.log("Direkte innsetting vellykket");
    } else {
      console.log("RPC-kall vellykket:", data);
    }

    return data;
  } catch (err) {
    console.error('Feil ved godkjenning av månedlig salg:', err.message);
    throw err;
  }
};
