import { useState, useCallback, useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { supabase } from '../../supabaseClient';

/**
 * Hook for å håndtere godkjenningsfunksjonalitet
 */
export const useApprovalFunctions = (selectedOffice, selectedMonth, managerData) => {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [currentApprovalData, setCurrentApprovalData] = useState(null);
  const [approvalSuccess, setApprovalSuccess] = useState(null);
  const [approvalError, setApprovalError] = useState(null);
  const [monthlyApprovals, setMonthlyApprovals] = useState([]);
  const [refreshingApprovals, setRefreshingApprovals] = useState(false);
  const approvalsCache = useMemo(() => new Map(), []); // Cache for å unngå unødvendige spørringer

  /**
   * Henter månedlige godkjenninger for kontoret og måneden
   */
  const fetchMonthlyApprovals = useCallback(
    debounce(async () => {
      if (!selectedOffice || !selectedMonth) return;
      const cacheKey = `${selectedOffice}-${selectedMonth}`;
      if (approvalsCache.has(cacheKey)) {
        setMonthlyApprovals(approvalsCache.get(cacheKey));
        return;
      }

      setRefreshingApprovals(true);
      try {
        const { data: approvals, error } = await supabase
          .from('monthly_commission_approvals')
          .select('*')
          .eq('month_year', selectedMonth)
          .eq('agent_company', selectedOffice)
          .or('revoked.is.null,revoked.eq.false');

        if (error) {
          console.error("Feil ved henting av månedlige godkjenninger:", error.message);
          return;
        }

        approvalsCache.set(cacheKey, approvals || []);
        setMonthlyApprovals(approvals || []);
      } catch (error) {
        console.error("Uventet feil ved henting av månedlige godkjenninger:", error.message);
      } finally {
        setRefreshingApprovals(false);
      }
    }, 500),
    [selectedOffice, selectedMonth, approvalsCache]
  );

  /**
   * Verifiserer godkjenningsstatus for en agent
   */
  const verifyAgentApproval = useCallback(async (agentName) => {
    try {
      const { data, error } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('agent_name', agentName)
        .eq('month_year', selectedMonth);
      
      if (error) {
        console.error("Feil ved verifikasjon av agentgodkjenning:", error.message);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Uventet feil ved verifikasjon av agentgodkjenning:", error.message);
      return null;
    }
  }, [selectedMonth]);

  /**
   * Åpner godkjenningsdialogen for en agent
   */
  const openBatchApproval = useCallback((agent) => {
    setCurrentApprovalData(agent);
    setApprovalDialogOpen(true);
  }, []);

  /**
   * Håndterer godkjenning av provisjon for en agent
   * @param {object} agent - Agenten som skal godkjennes
   * @param {number} approvedAmount - Godkjent beløp
   * @param {string} comment - Kommentar til godkjenningen
   * @param {function} updateCallback - Callback som kalles etter vellykket godkjenning
   * @param {boolean} isAdmin - Om godkjenner er admin
   * @param {object} metadata - Metadata for godkjenningen med provisjonsdetaljer
   */
  const handleApproval = async (agent, approvedAmount, comments, updateCallback, isAdmin = false, metadata = {}) => {
    console.log(`Starter godkjenning for ${agent.name}, beløp: ${approvedAmount}kr, 5% trekk: ${agent.applyFivePercent ? 'JA' : 'NEI'}`);
    console.log("Agent data:", agent);
    console.log("BONUS DEBUG: Bonusverdi før godkjenning:", {
      agentName: agent.name,
      bonus: agent.bonus,
      bonusAmount: agent.bonusAmount,
      bonusType: typeof agent.bonus
    });
    
    if (!agent || (!agent.id && !agent.name)) {
      console.error('Feil: Agent mangler ID eller navn', agent);
      throw new Error('Agent-data mangler. Kan ikke fortsette med godkjenningen.');
    }
    
    try {
      // Sjekk om agenten finnes i databasen - bruk employees tabellen
      let queryBuilder = supabase.from('employees').select('*');
      console.log("SQL: Henter agent fra employees-tabellen");

      if (agent.id) {
        queryBuilder = queryBuilder.eq('id', agent.id);
        console.log("SQL: Søker på agent.id =", agent.id);
      } else if (agent.name) {
        queryBuilder = queryBuilder.eq('name', agent.name);
        console.log("SQL: Søker på agent.name =", agent.name);
      } else if (agent.agentId) {
        queryBuilder = queryBuilder.eq('agent_id', agent.agentId);
        console.log("SQL: Søker på agent.agentId =", agent.agentId);
      } else {
        console.error('Ingen identifiserbar informasjon funnet for agent:', agent);
        throw new Error('Kunne ikke identifisere agenten. Mangler ID, navn og agent_id.');
      }

      const { data: agentData, error: agentError } = await queryBuilder.single();
      
      if (agentError) {
        console.error('Feil ved henting av agentdata:', agentError);
        throw new Error(`Kunne ikke finne agent i databasen. Prøv igjen senere.`);
      }
      
      if (!agentData) {
        console.error('Ingen agentdata funnet:', {id: agent.id, name: agent.name, agentId: agent.agentId});
        throw new Error('Fant ingen agent med denne identifikasjonen.');
      }
      
      // Bruk agentData.id som agent_id for approvals
      const agentId = agentData.id;
      
      // Hent eksisterende godkjenninger for denne agenten og måneden
      console.log("Henter godkjenninger for:", {
        agentId: agentId,
        month: agent.selectedMonth,
        year: agent.selectedYear,
        fullData: agent
      });

      // Verifiser at vi har gyldige verdier for måned og år
      const month = agent.selectedMonth || (agent.month ? agent.month : selectedMonth?.split('-')[1]);
      const year = agent.selectedYear || (agent.year ? agent.year : selectedMonth?.split('-')[0]);

      if (!month || !year) {
        console.error("Mangler måned eller år for godkjenning:", { month, year, agent });
        throw new Error("Kunne ikke fastsette måned eller år for godkjenningen. Prøv igjen.");
      }

      // Kombiner til month_year format: YYYY-MM
      const monthYear = `${year}-${month}`;
      
      console.log("SQL: Henter eksisterende godkjenninger fra monthly_commission_approvals");
      console.log("SQL: Parametre: agent_name =", agent.name, "month_year =", monthYear);
      
      const { data: existingApprovals, error: approvalError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('agent_name', agent.name)
        .eq('month_year', monthYear);
        
      if (approvalError) {
        console.error('Feil ved henting av eksisterende godkjenninger:', approvalError);
        throw new Error('Kunne ikke hente eksisterende godkjenninger.');
      }
      
      // Sett godkjenningsstatus basert på brukerrolle
      let approvalStatus = 'pending';
      if (isAdmin) {
        approvalStatus = 'approved';
      } else {
        approvalStatus = 'approved';
      }
      
      console.log(`Godkjenningsstatus satt til: ${approvalStatus} (isAdmin=${isAdmin}) for agent: ${agent.name} (ID: ${agentId})`);
      
      // Samle data for oppdatering av agentens data
      const updatedAgent = {
        ...agent,
        id: agentId, // Bruk ID fra databasen
        approvalStatus,
        managerApproved: !isAdmin,
        adminApproved: isAdmin,
        approvedAmount,
        lastApprovalDate: new Date().toISOString(),
        comments
      };
      
      // Lagre eller oppdater godkjenning
      let response;
      
      if (existingApprovals && existingApprovals.length > 0) {
        const latestApproval = existingApprovals.reduce((latest, current) => 
          new Date(current.created_at) > new Date(latest.created_at) ? current : latest, 
          existingApprovals[0]
        );
        
        console.log(`Oppdaterer eksisterende godkjenning: ID=${latestApproval.id} for agent ${agent.name}`);
        console.log("SQL: Oppdaterer godkjenning i monthly_commission_approvals");
        console.log("SQL: WHERE id =", latestApproval.id);
        
        // Sikre at vi har bonus-verdien
        const bonusAmount = parseFloat(agent.bonus || agent.bonusAmount || 0);
        console.log("BONUS DEBUG: Bonusverdi ved update:", {
          agentName: agent.name,
          bonus: agent.bonus,
          bonusAmount: bonusAmount,
          bonusType: typeof bonusAmount
        });
        
        // Debug 5% trekk-status
        console.log("5% TREKK DEBUG: Status ved update:", {
          agentName: agent.name,
          applyFivePercent: agent.applyFivePercent,
          typeOf: typeof agent.applyFivePercent
        });
        
        response = await supabase
          .from('monthly_commission_approvals')
          .update({
            approved_commission: approvedAmount,
            approval_comment: comments,
            approved: true,
            manager_approved: true,
            admin_approved: isAdmin,
            approved_by: managerData?.email || 'Unknown',
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            revoked: false,
            bonus_amount: bonusAmount,
            tjenestetorget: agent.tjenestetorgetDeduction || 0,
            bytt: agent.byttDeduction || 0,
            other_deductions: agent.otherDeductions || 0,
            apply_five_percent_deduction: agent.applyFivePercent || false
          })
          .eq('id', latestApproval.id);
      } else {
        console.log(`Oppretter ny godkjenning for agent: ${agent.name} (ID: ${agentId}), måned: ${agent.selectedMonth}/${agent.selectedYear}`);
        console.log("SQL: Setter inn ny godkjenning i monthly_commission_approvals");
        
        // Beregn 5% trekket basert på totalprovisjon med bonus
        const totalCommissionWithBonus = (
          (agent.skadePremium * agent.skadeCommissionRate / 100) + 
          (agent.livPremium * agent.livCommissionRate / 100) + 
          (agent.bonus || 0)
        );
        
        // Hvis vi har pre-beregnet fivePercentDeduction, bruk det, ellers beregn
        const fivePercentDeduction = agent.fivePercentDeduction !== undefined ? 
          agent.fivePercentDeduction : 
          (agent.applyFivePercent ? totalCommissionWithBonus * 0.05 : 0);
        
        // Sikre at vi har bonus-verdien
        const bonusAmount = parseFloat(agent.bonus || agent.bonusAmount || 0);
        console.log("BONUS DEBUG: Bonusverdi ved insert:", {
          agentName: agent.name,
          bonus: agent.bonus,
          bonusAmount: bonusAmount,
          bonusType: typeof bonusAmount
        });
        
        // Debug 5% trekk-status
        console.log("5% TREKK DEBUG: Status ved insert:", {
          agentName: agent.name,
          applyFivePercent: agent.applyFivePercent,
          typeOf: typeof agent.applyFivePercent,
          fivePercentDeduction
        });
        
        console.log(`Godkjenningsdetaljer for ${agent.name}:`, {
          totalBeforeBonus: (agent.skadePremium * agent.skadeCommissionRate / 100) + 
                          (agent.livPremium * agent.livCommissionRate / 100),
          bonus: bonusAmount,
          totalWithBonus: totalCommissionWithBonus,
          applyFivePercent: agent.applyFivePercent,
          monthsEmployed: agent.monthsEmployed,
          fivePercentDeduction: fivePercentDeduction,
          finalAmount: totalCommissionWithBonus - fivePercentDeduction - 
                      (agent.tjenestetorgetDeduction || 0) - 
                      (agent.byttDeduction || 0) - 
                      (agent.otherDeductions || 0)
        });
        
        response = await supabase
          .from('monthly_commission_approvals')
          .insert({
            agent_name: agent.name || agentData.name,
            month_year: monthYear,
            agent_company: selectedOffice,
            original_commission: (agent.skadePremium * agent.skadeCommissionRate / 100) + 
                              (agent.livPremium * agent.livCommissionRate / 100),
            approved_commission: approvedAmount,
            approval_comment: comments,
            approved: true,
            manager_approved: true,
            admin_approved: isAdmin,
            approved_by: managerData?.email || 'Unknown',
            approved_at: new Date().toISOString(),
            revoked: false,
            bonus_amount: bonusAmount,
            tjenestetorget: agent.tjenestetorgetDeduction || 0,
            bytt: agent.byttDeduction || 0,
            other_deductions: agent.otherDeductions || 0,
            apply_five_percent_deduction: agent.applyFivePercent || false
          });
      }
      
      if (response.error) {
        console.error('Feil ved lagring av godkjenning:', response.error);
        console.log("BONUS DEBUG: Feil under lagring:", {
          agentName: agent.name,
          bonus: agent.bonus,
          error: response.error
        });
        throw new Error(`Kunne ikke lagre godkjenning: ${response.error.message}`);
      }
      
      console.log('Godkjenning lagret med suksess:', response.data);
      
      // Oppdater agentdata i UI
      if (updateCallback && typeof updateCallback === 'function') {
        console.log('Kaller updateCallback for å oppdatere UI...');
        try {
          await updateCallback();
        } catch (callbackError) {
          console.error('Feil i updateCallback:', callbackError);
          // Fortsett selv om callback feiler
        }
      }
      
      // Hent oppdaterte månedlige godkjenninger for denne måneden og året
      try {
        const { data: monthlyApprovals, error: monthlyError } = await supabase
          .from('monthly_commission_approvals')
          .select('*')
          .eq('month_year', monthYear);
          
        if (monthlyError) {
          console.error('Feil ved henting av månedlige godkjenninger:', monthlyError);
        } else {
          console.log(`Hentet ${monthlyApprovals?.length || 0} månedlige godkjenninger`);
          setMonthlyApprovals(monthlyApprovals || []);
        }
      } catch (monthlyError) {
        console.error('Uventet feil ved henting av månedlige godkjenninger:', monthlyError);
      }
      
      // Oppdater også cache for månedlige godkjenninger
      if (selectedMonth && selectedOffice) {
        const cacheKey = `${selectedOffice}-${selectedMonth}`;
        // Hent alle godkjenninger for kontoret og måneden
        try {
          const { data: officeApprovals, error: officeError } = await supabase
            .from('monthly_commission_approvals')
            .select('*')
            .eq('month_year', monthYear)
            .eq('agent_company', selectedOffice);
            
          if (!officeError && officeApprovals) {
            approvalsCache.set(cacheKey, officeApprovals);
          }
        } catch (error) {
          console.error('Feil ved oppdatering av godkjenningscache:', error);
        }
      }
      
      // Sett suksessmelding
      setApprovalSuccess(`Godkjenning for ${agent.name} lagret for ${agent.selectedMonth}/${agent.selectedYear}`);
      console.log(`Godkjenningsprosess fullført for ${agent.name}`);
      
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('Feil i godkjenningsprosessen:', error);
      setApprovalError(`Godkjenningsfeil: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    if (selectedMonth && selectedOffice) {
      fetchMonthlyApprovals();
    }
  }, [selectedMonth, selectedOffice, fetchMonthlyApprovals]);

  return useMemo(() => ({
    monthlyApprovals,
    refreshingApprovals,
    fetchMonthlyApprovals,
    verifyAgentApproval,
    approvalDialogOpen,
    setApprovalDialogOpen,
    currentApprovalData,
    setCurrentApprovalData,
    openBatchApproval,
    approvalSuccess,
    setApprovalSuccess,
    approvalError,
    setApprovalError,
    handleApproval
  }), [
    monthlyApprovals,
    refreshingApprovals,
    fetchMonthlyApprovals,
    verifyAgentApproval,
    approvalDialogOpen,
    currentApprovalData,
    approvalSuccess,
    approvalError,
    handleApproval
  ]);
};
