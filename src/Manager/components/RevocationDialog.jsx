import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Comment, Cancel } from '@mui/icons-material';
import { supabase } from '../../services/supabase/supabaseClient';

const RevocationDialog = ({
  open,
  onClose,
  selectedAgent,
  selectedMonth,
  fetchApprovals,
}) => {
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationLoading, setRevocationLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRevokeApproval = async () => {
    setRevocationLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          revoked: true,
          approved: false, // Ensure the approved field is explicitly set to false
          revoked_at: new Date().toISOString(),
          revocation_reason: revocationReason || 'Ingen årsak oppgitt',
        })
        .eq('agent_name', selectedAgent.name)
        .eq('month_year', selectedMonth)
        .eq('approved', true); // Only revoke if it was approved

      if (error) {
        throw error;
      }

      await fetchApprovals(); // Refresh UI after revocation
      onClose();
    } catch (err) {
      setError('Kunne ikke trekke tilbake godkjenning. Prøv igjen senere.');
      console.error('Error revoking approval:', err.message);
    } finally {
      setRevocationLoading(false);
    }
  };

  if (!selectedAgent) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Trekk tilbake godkjenning</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Trekk tilbake godkjenning for {selectedAgent.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Måned: {selectedMonth?.replace('-', '/')}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Alert severity="warning">
              Å trekke tilbake godkjenning vil fjerne denne agentens provisjon
              fra månedlig utbetaling. Dette bør kun gjøres hvis godkjenningen
              var feilaktig eller det er andre grunner til at provisjonen ikke
              skal utbetales.
            </Alert>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Årsak for tilbaketrekking"
              multiline
              rows={3}
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              fullWidth
              required
              placeholder="Angi årsak for tilbaketrekking av godkjenning"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Comment fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={revocationLoading}>
          Avbryt
        </Button>
        <Button
          onClick={handleRevokeApproval}
          variant="contained"
          color="error"
          startIcon={<Cancel />}
          disabled={revocationLoading || !revocationReason}
        >
          {revocationLoading ? <CircularProgress size={24} /> : 'Trekk tilbake'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RevocationDialog;
