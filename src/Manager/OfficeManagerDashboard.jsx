import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import NavigationMenu from '../components/NavigationMenu';
import ManagerHeader from './components/ManagerHeader';
import SummaryCards from './components/SummaryCards';
import TabsContainer from './components/TabsContainer';
import ApprovalDialog from './components/ApprovalDialog';
import RevocationDialog from './components/RevocationDialog';
import { useManagerData } from './hooks/useManagerData';
import { useApprovalFunctions } from './hooks/useApprovalFunctions';
import { supabase } from '../supabaseClient';
import { checkMonthlyApprovalExists } from '../services/commissionService';

function OfficeManagerDashboard() {
  const {
    loading,
    error,
    managerData,
    officeAgents,
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    salaryModels,
    officePerformance,
    agentPerformance,
    setAgentPerformance,
    processMonthlyData,
    showApproved,
    setShowApproved,
    syncAgentsWithApprovals
  } = useManagerData();

  const selectedOffice = managerData?.office || null;

  const [tabValue, setTabValue] = useState(0);
  const [approvalError, setApprovalError] = useState(null);
  const [batchApprovalLoading, setBatchApprovalLoading] = useState(false);
  const [batchComment, setBatchComment] = useState('');
  const [batchAmount, setBatchAmount] = useState('');
  const [revocationDialogOpen, setRevocationDialogOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationLoading, setRevocationLoading] = useState(false);

  const {
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
    approvalError: hookApprovalError,
    setApprovalError: setHookApprovalError,
    handleApproval
  } = useApprovalFunctions(selectedOffice, selectedMonth, managerData);

  const selectedAgent = currentApprovalData;

  const updateAgentPerformance = (updatedAgents) => {
    setAgentPerformance(updatedAgents);
  };

  useEffect(() => {
    if (selectedMonth && selectedOffice) {
      fetchMonthlyApprovals();
    }
  }, [selectedMonth, selectedOffice, fetchMonthlyApprovals]);

  const closeBatchApproval = () => {
    setApprovalDialogOpen(false);
    setCurrentApprovalData(null);
    setBatchAmount('');
    setBatchComment('');
  };

  const handleBatchApprove = useCallback(async () => {
    if (!selectedAgent || !selectedMonth || !managerData) {
      setHookApprovalError("Mangler data for godkjenning");
      return;
    }
    
    if (!batchAmount || parseFloat(batchAmount) <= 0) {
      setHookApprovalError("Ugyldig godkjenningsbeløp");
      return;
    }
    
    setBatchApprovalLoading(true);
    setHookApprovalError(null);
    
    try {
      console.log(`Godkjenner provisjon for ${selectedAgent.name}:`, {
        beløp: parseFloat(batchAmount),
        måned: selectedMonth,
        kommentar: batchComment,
        agentData: selectedAgent
      });

      // Sjekk om godkjenning allerede eksisterer
      const { exists, data, error: checkError } = await checkMonthlyApprovalExists(selectedAgent.name, selectedMonth);
      
      if (checkError) {
        console.error("Feil ved sjekk av eksisterende godkjenning:", checkError);
      }
      
      if (exists) {
        console.log("Godkjenning eksisterer allerede:", data);
      }
      
      // Beregn provisjonsdetaljer for å kunne lagre dem korrekt
      let details = {};
      
      // Bruk forhåndsberegnede verdier hvis tilgjengelig
      if (selectedAgent && selectedAgent.livCommission !== undefined && selectedAgent.skadeCommission !== undefined) {
        details = {
          skadeCommission: selectedAgent.skadeCommission || 0,
          livCommission: selectedAgent.livCommission || 0,
          bonusAmount: selectedAgent.bonusAmount || 0,
          totalBeforeDeductions: selectedAgent.totalBeforeTrekk || 0,
          tjenestetorgetDeduction: selectedAgent.tjenestetorgetDeduction || 0,
          byttDeduction: selectedAgent.byttDeduction || 0,
          otherDeductions: selectedAgent.otherDeductions || 0
        };
      } else if (selectedAgent) {
        // Beregn på nytt hvis nødvendig
        const skadeCommission = (selectedAgent.skadePremium || 0) * ((selectedAgent.skadeCommissionRate || 0) / 100);
        const livCommission = (selectedAgent.livPremium || 0) * ((selectedAgent.livCommissionRate || 0) / 100);
        const totalBeforeDeductions = skadeCommission + livCommission;
        
        details = {
          skadeCommission,
          livCommission,
          bonusAmount: 0,
          totalBeforeDeductions,
          tjenestetorgetDeduction: selectedAgent.tjenestetorgetDeduction || 0,
          byttDeduction: selectedAgent.byttDeduction || 0,
          otherDeductions: selectedAgent.otherDeductions || 0
        };
      }
      
      // Legg ved mer detaljerte provisjonsdata for godkjenningen
      const approvalMetadata = {
        originalCommission: selectedAgent.commission || selectedAgent.originalCommission || 0,
        adjustedCommission: parseFloat(batchAmount),
        livCommission: details.livCommission || 0,
        skadeCommission: details.skadeCommission || 0,
        bonusAmount: details.bonusAmount || 0,
        totalBeforeTrekk: details.totalBeforeDeductions || 0,
        tjenestetorgetDeduction: details.tjenestetorgetDeduction || 0,
        byttDeduction: details.byttDeduction || 0,
        otherDeductions: details.otherDeductions || 0,
        hireDate: selectedAgent.hireDate,
        monthsEmployed: selectedAgent.monthsEmployed,
        applyFivePercent: selectedAgent.applyFivePercent
      };
      
      console.log("Godkjenningsdata:", approvalMetadata);
      
      const isAdmin = managerData.role === 'admin';
      
      // Utfør godkjenningen med alle detaljene
      await handleApproval(
        selectedAgent,
        parseFloat(batchAmount),
        batchComment || "",
        (updatedAgents) => {
          setAgentPerformance(updatedAgents);
          processMonthlyData();
        },
        isAdmin,
        approvalMetadata
      );
      
      // Hent oppdaterte godkjenninger og oppdater UI
      await fetchMonthlyApprovals();
      
      // Forsikre oss om at dataene oppdateres
      setTimeout(() => {
        processMonthlyData();
        syncAgentsWithApprovals(agentPerformance, monthlyApprovals);
      }, 500);
      
      setApprovalSuccess(`Provisjon for ${selectedAgent.name} ble godkjent.`);
      setApprovalDialogOpen(false);
      setBatchAmount('');
      setBatchComment('');
      setCurrentApprovalData(null);
    } catch (error) {
      console.error("Godkjenningsfeil:", error);
      setHookApprovalError(`Feil ved godkjenning: ${error.message}`);
    } finally {
      setBatchApprovalLoading(false);
    }
  }, [
    selectedAgent, 
    selectedMonth, 
    managerData, 
    batchAmount, 
    batchComment, 
    handleApproval, 
    fetchMonthlyApprovals, 
    processMonthlyData, 
    setAgentPerformance, 
    setApprovalDialogOpen, 
    setApprovalSuccess, 
    setCurrentApprovalData,
    syncAgentsWithApprovals,
    agentPerformance,
    monthlyApprovals
  ]);

  const openRevocationDialog = (agent) => {
    setCurrentApprovalData(agent);
    setRevocationReason('');
    setRevocationDialogOpen(true);
  };

  const closeRevocationDialog = () => {
    setRevocationDialogOpen(false);
    setCurrentApprovalData(null);
    setRevocationReason('');
  };

  const handleCommissionAdjustment = (type) => {
    if (!selectedAgent) return;
    const current = parseFloat(batchAmount) || 0;
    let newAmount = current;
    if (type === 'add1000') newAmount = current + 1000;
    else if (type === 'subtract1000') newAmount = Math.max(0, current - 1000);
    else if (type === 'add100') newAmount = current + 100;
    else if (type === 'subtract100') newAmount = Math.max(0, current - 100);
    else if (type === 'reset') newAmount = selectedAgent.commission;
    setBatchAmount(newAmount.toFixed(2));
  };

  const debugApprovalStatus = async (agent) => {
    console.log("Debugging approval status for:", agent.name);
    const result = await verifyAgentApproval(agent.name);
    if (result && result.length > 0) {
      const approvals = result.map(r => ({
        id: r.id,
        month: r.month_year,
        approved: r.approved,
        revoked: r.revoked,
        approvedBy: r.approved_by,
        approvedAt: new Date(r.approved_at).toLocaleString(),
        amount: r.approved_commission
      }));
      console.log(`Database contains ${result.length} approval records:`, approvals);
      if (result.some(r => r.approved && !r.revoked)) {
        const updatedAgents = agentPerformance.map(a => {
          if (a.name === agent.name) {
            const validApproval = result.find(r => r.approved && !r.revoked);
            return {
              ...a,
              isApproved: true,
              approvalRecord: validApproval
            };
          }
          return a;
        });
        setAgentPerformance(updatedAgents);
        console.log(`Fixed approval status for ${agent.name}`);
        setApprovalSuccess(`Agent ${agent.name} er bekreftet godkjent i databasen`);
      }
    } else {
      console.log(`No approval records found for ${agent.name}`);
      alert(`Ingen godkjenningsdata funnet for ${agent.name}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      </Box>
    );
  }

  if (!managerData) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="warning" sx={{ mt: 2 }}>
          Ingen lederdata funnet for denne brukeren. Kontakt administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh", pt: { xs: 10, sm: 11, md: 12 } }}>
      <NavigationMenu />

      <ManagerHeader 
        managerData={managerData}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        processMonthlyData={processMonthlyData}
        officeAgents={officeAgents}
      />

      <Box sx={{ mb: 4 }}>
        <SummaryCards officePerformance={officePerformance} />
      </Box>

      <TabsContainer 
        tabValue={tabValue}
        setTabValue={setTabValue}
        agentPerformance={agentPerformance}
        updateAgentPerformance={updateAgentPerformance}
        salaryModels={salaryModels}
        showApproved={showApproved}
        setShowApproved={setShowApproved}
        selectedMonth={selectedMonth}
        monthlyApprovals={monthlyApprovals}
        refreshingApprovals={refreshingApprovals}
        fetchMonthlyApprovals={fetchMonthlyApprovals}
        openBatchApproval={openBatchApproval}
        openRevocationDialog={openRevocationDialog}
        debugApprovalStatus={debugApprovalStatus}
        approvalSuccess={approvalSuccess}
        setApprovalSuccess={setApprovalSuccess}
      />

      <ApprovalDialog 
        open={approvalDialogOpen}
        onClose={closeBatchApproval}
        selectedAgent={selectedAgent}
        selectedMonth={selectedMonth}
        batchAmount={batchAmount}
        setBatchAmount={setBatchAmount}
        batchComment={batchComment}
        setBatchComment={setBatchComment}
        handleCommissionAdjustment={handleCommissionAdjustment}
        handleBatchApprove={handleBatchApprove}
        approvalError={hookApprovalError}
        batchApprovalLoading={batchApprovalLoading}
        managerData={managerData}
        setSuccess={setApprovalSuccess}
        setError={setHookApprovalError}
        fetchApprovals={fetchMonthlyApprovals}
      />

      <RevocationDialog 
        open={revocationDialogOpen}
        onClose={closeRevocationDialog}
        selectedAgent={selectedAgent}
        selectedMonth={selectedMonth}
        revocationReason={revocationReason}
        setRevocationReason={setRevocationReason}
        handleRevokeApproval={async () => {
          try {
            setRevocationLoading(true);
            
            // Bruk enten e-post eller navn som godkjenner-ID
            const revokerIdentifier = managerData?.email || managerData?.name;
            if (!revokerIdentifier) {
              throw new Error("Lederen mangler identifikasjon (e-post/navn). Kontakt administrator.");
            }
            
            const { data, error } = await supabase
              .from('monthly_commission_approvals')
              .update({
                revoked: true,
                revoked_by: revokerIdentifier,
                revoked_at: new Date(),
                revocation_reason: revocationReason
              })
              .eq('agent_name', selectedAgent.name)
              .eq('month_year', selectedMonth);

            if (error) {
              console.error("Database error details:", error);
              throw new Error(`Database error: ${error.message || error.details || 'Unknown error'}`);
            }

            closeRevocationDialog();
            setApprovalSuccess("Godkjenning er tilbakekalt!");
            fetchMonthlyApprovals();
            processMonthlyData();
          } catch (err) {
            console.error("Error revoking approval:", err);
            setHookApprovalError(`Feil ved tilbakekalling: ${err.message}`);
          } finally {
            setRevocationLoading(false);
          }
        }}
        approvalError={hookApprovalError}
        revocationLoading={revocationLoading}
      />
    </Box>
  );
}

export default OfficeManagerDashboard;
