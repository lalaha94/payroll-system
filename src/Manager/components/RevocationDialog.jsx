import React from 'react';
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
  AlertTitle,
  CircularProgress,
} from '@mui/material';
import { Comment, Cancel } from '@mui/icons-material';

const RevocationDialog = ({
  open,
  onClose,
  selectedAgent,
  selectedMonth,
  revocationReason,
  setRevocationReason,
  handleRevokeApproval,
  approvalError,
  revocationLoading
}) => {
  if (!selectedAgent) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Trekk tilbake godkjenning
      </DialogTitle>
      <DialogContent>
        {approvalError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {approvalError}
          </Alert>
        )}
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Trekk tilbake godkjenning for {selectedAgent.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Måned: {selectedMonth?.replace('-', '/')}
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Advarsel</AlertTitle>
              Å trekke tilbake godkjenning vil fjerne denne agentens provisjon fra månedlig utbetaling. 
              Dette bør kun gjøres hvis godkjenningen var feilaktig eller hvis det har oppstått andre 
              grunner til at provisjonen ikke skal utbetales.
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
          
          <Grid item xs={12}>
            <Typography variant="body2" color="error">
              Merk: Denne handlingen loggføres og kan ikke angres.
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
          {revocationLoading ? <CircularProgress size={24} /> : 'Trekk tilbake godkjenning'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RevocationDialog;
