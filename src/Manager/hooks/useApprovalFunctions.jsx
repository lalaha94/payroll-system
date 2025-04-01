import { useState, useCallback, useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { supabase } from '../../supabaseClient';

/**
 * Hook for å håndtere godkjenningsfunksjonalitet
 */
export const useApprovalFunctions = (selectedOffice, selectedMonth) => {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [currentApprovalData, setCurrentApprovalData] = useState(null);
  const [approvalSuccess, setApprovalSuccess] = useState(null);
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
  }), [
    monthlyApprovals,
    refreshingApprovals,
    fetchMonthlyApprovals,
    verifyAgentApproval,
    approvalDialogOpen,
    currentApprovalData,
    approvalSuccess,
  ]);
};
