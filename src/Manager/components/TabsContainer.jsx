import React, { memo, useState } from 'react';
import { Paper, Tabs, Tab } from '@mui/material';
import { PeopleAlt } from '@mui/icons-material';
import AgentTab from './tabs/AgentTab';
import RevocationDialog from './RevocationDialog';
import { useManagerData } from '../hooks/useManagerData';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const TabsContainer = memo(({ 
  tabValue, 
  setTabValue,
  agentPerformance,
  updateAgentPerformance,
  salaryModels,
  openBatchApproval,
  fetchApprovals,
  openRevocationDialog,
  selectedMonth,
  monthlyApprovals,
  refreshingApprovals,
  showApproved,
  setShowApproved,
  debugApprovalStatus,
  approvalSuccess,
  setApprovalSuccess,
}) => {
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedRevokeMonth, setSelectedRevokeMonth] = useState(null);

  const { managerData, loading, error } = useManagerData();

  const handleOpenRevokeDialog = (agent, month) => {
    setSelectedAgent(agent);
    setSelectedRevokeMonth(month);
    setRevokeDialogOpen(true);
  };

  const closeRevokeDialog = () => {
    setRevokeDialogOpen(false);
    setSelectedAgent(null);
    setSelectedRevokeMonth(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) return <p>Laster inn...</p>;
  if (error) return <p>Feil: {error}</p>;

  return (
    <>
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<PeopleAlt />} iconPosition="start" label="Rådgivere" />
        </Tabs>

        <AgentTab 
          agentPerformance={agentPerformance}
          updateAgentPerformance={updateAgentPerformance}
          salaryModels={salaryModels}
          CHART_COLORS={CHART_COLORS}
          openBatchApproval={openBatchApproval}
          openRevokeDialog={openRevocationDialog ? openRevocationDialog : handleOpenRevokeDialog}
          selectedMonth={selectedMonth}
          monthlyApprovals={monthlyApprovals}
          refreshingApprovals={refreshingApprovals}
          showApproved={showApproved}
          setShowApproved={setShowApproved}
          debugApprovalStatus={debugApprovalStatus}
          approvalSuccess={approvalSuccess}
          setApprovalSuccess={setApprovalSuccess}
        />
      </Paper>

      {!openRevocationDialog && (
        <RevocationDialog
          open={revokeDialogOpen}
          onClose={closeRevokeDialog}
          selectedAgent={selectedAgent}
          selectedMonth={selectedRevokeMonth}
          fetchApprovals={fetchApprovals}
        />
      )}
    </>
  );
});

export default TabsContainer;
