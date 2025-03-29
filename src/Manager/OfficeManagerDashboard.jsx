import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert, Paper, Typography } from '@mui/material';
import NavigationMenu from '../components/NavigationMenu';
import ManagerHeader from './components/ManagerHeader';
import SummaryCards from './components/SummaryCards';
import TabsContainer from './components/TabsContainer';
import ApprovalDialog from './components/ApprovalDialog';
import RevocationDialog from './components/RevocationDialog';
import { useManagerData } from './hooks/useManagerData';
import { useApprovalFunctions } from './hooks/useApprovalFunctions'; // Add this import
import { supabase } from '../supabaseClient';

function OfficeManagerDashboard() {
  const {
    loading,
    error,
    managerData,
    officeAgents,
    salesData,
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

  const [tabValue, setTabValue] = useState(0);
  const [approvalSuccess, setApprovalSuccess] = useState(null);
  const [approvalError, setApprovalError] = useState(null);
  
  const [monthlyApprovals, setMonthlyApprovals] = useState([]);
  const [refreshingApprovals, setRefreshingApprovals] = useState(false);

  // Dialog states
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [batchApprovalOpen, setBatchApprovalOpen] = useState(false);
  const [batchComment, setBatchComment] = useState('');
  const [batchAmount, setBatchAmount] = useState('');
  const [batchApprovalLoading, setBatchApprovalLoading] = useState(false);
  const [revocationDialogOpen, setRevocationDialogOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationLoading, setRevocationLoading] = useState(false);

  // Import functions from utility files
  const { 
    fetchMonthlyApprovals, 
    handleBatchApprove, 
    handleRevokeApproval, 
    debugApprovalStatus 
  } = useApprovalFunctions({
    selectedMonth,
    managerData,
    agentPerformance,
    setAgentPerformance,
    setMonthlyApprovals,
    setRefreshingApprovals,
    setApprovalSuccess,
    setApprovalError,
    showApproved,
    tabValue
  });
  
  // Create a function to update agent performance
  const updateAgentPerformance = (updatedAgents) => {
    setAgentPerformance(updatedAgents);
  };

  // Update this useEffect to handle the new tab structure
  useEffect(() => {
    // Tab 1 is now the Monthly Approvals tab (previously was tab 3)
    if (tabValue === 1 && selectedMonth && managerData) {
      console.log("Tab changed to monthly approvals, fetching data...");
      fetchMonthlyApprovals();
    }
  }, [tabValue, selectedMonth, managerData]);

  // Dialog handlers
  const openBatchApproval = async (agent) => {
    try {
      setApprovalError(null);
      
      if (!agent || !selectedMonth) {
        setApprovalError("Manglende agent eller måned");
        return;
      }
      
      if (agent.isApproved) {
        setApprovalError(`${agent.name} er allerede godkjent for denne måneden.`);
        return;
      }
      
      setSelectedAgent(agent);
      setBatchAmount(agent.commission.toFixed(2));
      setBatchComment('');
      setBatchApprovalOpen(true);
    } catch (error) {
      console.error("Error opening approval dialog:", error);
      setApprovalError(`Feil ved åpning av godkjenningsdialog: ${error.message}`);
    }
  };
  
  const closeBatchApproval = () => {
    setBatchApprovalOpen(false);
    setSelectedAgent(null);
    setBatchAmount('');
    setBatchComment('');
  };

  const openRevocationDialog = (agent) => {
    setSelectedAgent(agent);
    setRevocationReason('');
    setRevocationDialogOpen(true);
  };

  const closeRevocationDialog = () => {
    setRevocationDialogOpen(false);
    setSelectedAgent(null);
    setRevocationReason('');
  };

  const handleCommissionAdjustment = (type) => {
    if (!selectedAgent) return;
    
    const currentAmount = parseFloat(batchAmount) || 0;
    let newAmount = currentAmount;
    
    if (type === 'add1000') newAmount = currentAmount + 1000;
    else if (type === 'subtract1000') newAmount = Math.max(0, currentAmount - 1000);
    else if (type === 'add100') newAmount = currentAmount + 100;
    else if (type === 'subtract100') newAmount = Math.max(0, currentAmount - 100);
    else if (type === 'reset') newAmount = selectedAgent.commission;
    
    setBatchAmount(newAmount.toFixed(2));
  };

  // Loading and error states
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
      
      {/* Manager Header Section */}
      <ManagerHeader 
        managerData={managerData}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        processMonthlyData={processMonthlyData}
        officeAgents={officeAgents}
      />
      
      {/* Summary Cards Section */}
      <Box sx={{ mb: 4 }}>  {/* Add margin bottom to create space */}
        <SummaryCards officePerformance={officePerformance} />
      </Box>
      
      {/* Tabs Container */}
      <TabsContainer 
        tabValue={tabValue}
        setTabValue={setTabValue}
        agentPerformance={agentPerformance}
        updateAgentPerformance={updateAgentPerformance}
        salaryModels={salaryModels} // Add this prop
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

      {/* Dialogs */}
      <ApprovalDialog 
        open={batchApprovalOpen}
        onClose={closeBatchApproval}
        selectedAgent={selectedAgent}
        selectedMonth={selectedMonth}
        batchAmount={batchAmount}
        setBatchAmount={setBatchAmount}
        batchComment={batchComment}
        setBatchComment={setBatchComment}
        handleCommissionAdjustment={handleCommissionAdjustment}
        handleBatchApprove={() => handleBatchApprove({
          selectedAgent,
          selectedMonth,
          batchAmount,
          batchComment,
          managerData,
          closeBatchApproval,
          setBatchApprovalLoading
        })}
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
        handleRevokeApproval={() => handleRevokeApproval({
          selectedAgent,
          selectedMonth,
          revocationReason,
          closeRevocationDialog,
          setRevocationLoading
        })}
        approvalError={approvalError}
        revocationLoading={revocationLoading}
      />
    </Box>
  );
}

export default OfficeManagerDashboard;
