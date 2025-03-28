import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Box, 
  Button, 
  Typography, 
  TextField, 
  CircularProgress,
  Paper,
  Alert,
  Divider,
  Grid
} from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

// This is a debugging component that can be used to check and fix approval status
function ApprovalDebugger() {
  const [agentName, setAgentName] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const checkApprovalStatus = async () => {
    if (!agentName || !month) {
      setError("Angi både agent navn og måned (YYYY-MM)");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Call the validation function
      const { data, error } = await supabase.rpc(
        'validate_approval_status',
        {
          in_agent_name: agentName,
          in_month: month
        }
      );

      if (error) throw error;

      setResult(data);

    } catch (error) {
      console.error("Error checking approval status:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, m: 2, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <BugReport sx={{ mr: 1 }} /> Godkjenning Debug Verktøy
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField 
            label="Agent Navn"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Måned (YYYY-MM)"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="f.eks. 2023-01"
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12}>
          <Button 
            variant="contained" 
            onClick={checkApprovalStatus} 
            disabled={loading}
            startIcon={<Refresh />}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Sjekk Godkjenningsstatus'}
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert 
            severity={result.fixed > 0 ? "success" : "info"}
            variant={result.fixed > 0 ? "filled" : "outlined"}
          >
            {result.fixed > 0 
              ? `Fikset ${result.fixed} problem(er) med godkjenning`
              : `Ingen problemer funnet som trenger fikses`
            }
          </Alert>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>Status:</Typography>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5', mt: 1, overflow: 'auto' }}>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </Paper>
        </Box>
      )}
    </Paper>
  );
}

export default ApprovalDebugger;
