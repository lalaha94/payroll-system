import React, { useCallback, useState } from 'react';
import { Box, Alert, CircularProgress, Typography, Snackbar } from '@mui/material';
import { useManagerData } from '../hooks/useManagerData';
import { useApprovalFunctions } from '../hooks/useApprovalFunctions';

/**
 * En forenklet versjon av OfficeManagerDashboard for testing av godkjenningsfunksjonalitet
 */
const OfficeManagerDashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState('2023-11');
  const [selectedYear, setSelectedYear] = useState('2023');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [approvalAmount, setApprovalAmount] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  const {
    managerData,
    processMonthlyData,
    agentPerformance,
    setAgentPerformance
  } = useManagerData();

  const {
    handleApproval
  } = useApprovalFunctions(managerData?.office, selectedMonth);

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleBatchApprove = useCallback(async () => {
    if (!selectedAgent) {
      setError('Vennligst velg en agent');
      return;
    }

    if (!selectedMonth) {
      setError('Vennligst velg en måned');
      return;
    }

    if (!approvalAmount || isNaN(approvalAmount) || approvalAmount <= 0) {
      setError('Vennligst angi et gyldig beløp');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`Starter godkjenning for ${selectedAgent.name} for ${selectedMonth}/${selectedYear}`);
      console.log('Godkjenningsbeløp:', approvalAmount);
      console.log('5% trekk aktivert:', selectedAgent.applyFivePercent);
      
      // Sikre at agent-objektet har all nødvendig data
      const agentWithDetails = {
        ...selectedAgent,
        selectedMonth: selectedMonth,
        selectedYear: selectedYear,
        approvedAmount: approvalAmount
      };
      
      // Kall handleApproval med callback for å oppdatere UI
      const result = await handleApproval(
        agentWithDetails,
        approvalAmount,
        approvalComments,
        false, // isAdmin = false (dette er kontorleder-godkjenning)
        async () => {
          console.log('Oppdaterer agentdata etter godkjenning');
          await processMonthlyData();
        }
      );
      
      if (result.success) {
        console.log('Godkjenning fullført:', result);
        setApprovalDialogOpen(false);
        
        // Vis bekreftelsesmelding
        setSnackbar({
          open: true,
          message: `Provisjon for ${selectedAgent.name} er godkjent og sendt til admin`,
          severity: 'success'
        });
        
        // Nullstill godkjenningsdata
        setSelectedAgent(null);
        setApprovalAmount('');
        setApprovalComments('');
      } else {
        throw new Error(result.error || 'Ukjent feil ved godkjenning');
      }
    } catch (error) {
      console.error('Feil ved godkjenning:', error);
      setError(`Godkjenningsfeil: ${error.message}`);
      
      setSnackbar({
        open: true,
        message: `Feil ved godkjenning: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedAgent, 
    selectedMonth, 
    selectedYear, 
    approvalAmount, 
    approvalComments, 
    handleApproval, 
    processMonthlyData
  ]);

  return (
    <Box sx={{ p: 3, minHeight: '100vh' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Typography variant="h4" gutterBottom>
        Kontorlederdashboard - Forenklet Test
      </Typography>
      
      <Typography>
        Dette er en forenklet versjon for testing av godkjenningsfunksjonalitet.
        Den fulle implementasjonen finnes i src/Manager/OfficeManagerDashboard.jsx
      </Typography>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OfficeManagerDashboard; 