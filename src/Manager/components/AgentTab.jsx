import React, { useState, useEffect } from 'react';
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
    setShowApproved
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
    approvalDialogOpen,
    setApprovalDialogOpen,
    currentApprovalData,
    setCurrentApprovalData,
    openBatchApproval,
    approvalSuccess,
    setApprovalSuccess,
  } = useApprovalFunctions(selectedOffice, selectedMonth);

  const selectedAgent = currentApprovalData;

  const updateAgentPerformance = (updatedAgents) => {
    setAgentPerformance(updatedAgents);
  };

  useEffect(() => {
    if (tabValue === 1 && selectedMonth && managerData) {
      fetchMonthlyApprovals();
    }
  }, [tabValue, selectedMonth, managerData, fetchMonthlyApprovals]);

  const closeBatchApproval = () => {
    setApprovalDialogOpen(false);
    setCurrentApprovalData(null);
    setBatchAmount('');
    setBatchComment('');
  };

  const handleBatchApprove = async () => {
    try {
      setBatchApprovalLoading(true);
      if (!selectedAgent || !selectedMonth) {
        throw new Error("Agent eller måned mangler.");
      }
      const approvedAmount = parseFloat(batchAmount);
      if (isNaN(approvedAmount) || approvedAmount <= 0) {
        throw new Error("Ugyldig provisjonsbeløp.");
      }

      const tableName = 'monthly_commission_approvals';
      console.log(`Using table ${tableName} for commission approval`);

      const approvalData = {
        agent_id: selectedAgent.id,
        month: selectedMonth,
        approved_amount: approvedAmount,
        comment: batchComment,
        approved_at: new Date(),
        manager_id: managerData.id,
      };

      console.log("Attempting to insert data:", approvalData);

      const { data, error } = await supabase
        .from(tableName)
        .insert([approvalData]);

      if (error) {
        console.error("Database error details:", error);
        throw new Error(`Database error: ${error.message || error.details || 'Unknown error'}`);
      }

      setApprovalSuccess("Provisjonen er godkjent!");
      closeBatchApproval();
      fetchMonthlyApprovals();
      processMonthlyData();
    } catch (err) {
      console.error("Error in handleBatchApprove:", err);
      setApprovalError(`Feil ved godkjenning: ${err.message}`);
    } finally {
      setBatchApprovalLoading(false);
    }
  };

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
        debugApprovalStatus={() => {}}
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
        approvalError={approvalError}
        batchApprovalLoading={batchApprovalLoading}
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

            const tableName = 'monthly_commission_approvals';

            const { data, error } = await supabase
              .from(tableName)
              .update({
                revoked: true,
                revocation_reason: revocationReason,
                revoked_at: new Date()
              })
              .eq('agent_id', selectedAgent.id)
              .eq('month', selectedMonth);

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
            setApprovalError(`Feil ved tilbakekalling: ${err.message}`);
          } finally {
            setRevocationLoading(false);
          }
        }}
        approvalError={approvalError}
        revocationLoading={revocationLoading}
      />
    </Box>
  );
}

export default OfficeManagerDashboard;