import React from 'react';
import {
  Paper,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import { PeopleAlt, ShowChart, PieChart as PieChartIcon, CheckCircle } from '@mui/icons-material';
import AgentTab from './tabs/AgentTab';
import StatsTab from './tabs/StatsTab';
import ProductsTab from './tabs/ProductsTab';
import MonthlyApprovalsTab from './tabs/MonthlyApprovalsTab';

// Chart colors for consistent appearance
const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042'
];

const TabsContainer = ({ 
  tabValue, 
  setTabValue,
  agentPerformance,
  showApproved,
  setShowApproved,
  selectedMonth,
  monthlyApprovals,
  refreshingApprovals,
  fetchMonthlyApprovals,
  openBatchApproval,
  openRevocationDialog,
  debugApprovalStatus,
  approvalSuccess,
  setApprovalSuccess
}) => {
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Paper sx={{ mb: 3, borderRadius: 2 }}>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<PeopleAlt />} iconPosition="start" label="Agenter" />
        <Tab icon={<ShowChart />} iconPosition="start" label="Statistikk" />
        <Tab icon={<PieChartIcon />} iconPosition="start" label="Produkter" />
        <Tab 
          icon={<CheckCircle />} 
          iconPosition="start" 
          label="Månedsutbetaling" 
        />
      </Tabs>

      {tabValue === 0 && (
        <AgentTab 
          agentPerformance={agentPerformance}
          CHART_COLORS={CHART_COLORS}
        />
      )}

      {tabValue === 1 && (
        <StatsTab />
      )}

      {tabValue === 2 && (
        <ProductsTab />
      )}

      {tabValue === 3 && (
        <MonthlyApprovalsTab 
          agentPerformance={agentPerformance}
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
          CHART_COLORS={CHART_COLORS}
        />
      )}
    </Paper>
  );
};

export default TabsContainer;
