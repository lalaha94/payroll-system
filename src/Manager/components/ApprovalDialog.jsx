import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  Divider,
  TextField,
  Box,
  InputAdornment,
  Alert,
  CircularProgress,
  FormHelperText,
  AlertTitle,
} from '@mui/material';
import { Edit, Comment, CheckCircle } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const ApprovalDialog = ({
  open,
  onClose,
  selectedAgent,
  selectedMonth,
  batchAmount,
  setBatchAmount,
  batchComment,
  setBatchComment,
  handleCommissionAdjustment,
  handleBatchApprove,
  approvalError,
  batchApprovalLoading
}) => {
  const theme = useTheme();

  if (!selectedAgent) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Godkjenn månedsprovisjon
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
              Godkjenn provisjon for {selectedAgent?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Måned: {selectedMonth?.replace('-', '/')}
            </Typography>
          </Grid>

          {selectedAgent?.isModified && (
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Informasjon om justering</AlertTitle>
                Provisjonen for denne agenten har blitt justert manuelt. Justeringene inkluderer:
                {selectedAgent.modificationDetails?.skadeRate && (
                  <Box component="li">Skadeprovisjon: {selectedAgent.modificationDetails.skadeRate}%</Box>
                )}
                {selectedAgent.modificationDetails?.livRate && (
                  <Box component="li">Livprovisjon: {selectedAgent.modificationDetails.livRate}%</Box>
                )}
                {selectedAgent.modificationDetails?.tjenestetorget > 0 && (
                  <Box component="li">Tjenestetorget trekk: {selectedAgent.modificationDetails.tjenestetorget.toLocaleString('nb-NO')} kr</Box>
                )}
                {selectedAgent.modificationDetails?.bytt > 0 && (
                  <Box component="li">Bytt trekk: {selectedAgent.modificationDetails.bytt.toLocaleString('nb-NO')} kr</Box>
                )}
                {selectedAgent.modificationDetails?.other > 0 && (
                  <Box component="li">Andre trekk: {selectedAgent.modificationDetails.other.toLocaleString('nb-NO')} kr</Box>
                )}
                {selectedAgent.modificationDetails?.applyFivePercent !== undefined && (
                  <Box component="li">5% trekk: {selectedAgent.modificationDetails.applyFivePercent ? 'Ja' : 'Nei'}</Box>
                )}
              </Alert>
            </Grid>
          )}
          
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Total Premium:
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {selectedAgent.totalPremium?.toLocaleString('nb-NO')} kr
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Beregnet Provisjon:
            </Typography>
            <Typography variant="body1" fontWeight="bold" color={theme.palette.success.main}>
              {selectedAgent.commission.toFixed(2).toLocaleString('nb-NO')} kr
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Godkjenningsdetaljer
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Beløp å godkjenne"
              type="number"
              value={batchAmount}
              onChange={(e) => setBatchAmount(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">kr</InputAdornment>,
              }}
            />
            <FormHelperText>
              Beløpet som vil godkjennes og utbetales til agenten.
              {selectedAgent?.commission && selectedAgent.commission !== parseFloat(batchAmount) && (
                <Typography color="error" variant="caption" display="block">
                  Dette beløpet avviker fra den beregnede provisjonen ({selectedAgent.commission.toLocaleString('nb-NO')} kr).
                </Typography>
              )}
            </FormHelperText>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleCommissionAdjustment('subtract1000')}
              >
                -1000 kr
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleCommissionAdjustment('subtract100')}
              >
                -100 kr
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleCommissionAdjustment('reset')}
              >
                Reset
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => handleCommissionAdjustment('add100')}
              >
                +100 kr
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => handleCommissionAdjustment('add1000')}
              >
                +1000 kr
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Kommentar"
              multiline
              rows={3}
              value={batchComment}
              onChange={(e) => setBatchComment(e.target.value)}
              fullWidth
              placeholder="Legg til en kommentar (valgfritt)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Comment fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {parseFloat(batchAmount).toFixed(2) !== selectedAgent.commission.toFixed(2) && (
            <Grid item xs={12}>
              <Alert
                severity={
                  parseFloat(batchAmount) > selectedAgent.commission ? 'info' : 'warning'
                }
              >
                {parseFloat(batchAmount) > selectedAgent.commission
                  ? `Du har økt provisjonsbeløpet med ${(parseFloat(batchAmount) - selectedAgent.commission).toFixed(2).toLocaleString('nb-NO')} kr`
                  : `Du har redusert provisjonsbeløpet med ${(selectedAgent.commission - parseFloat(batchAmount)).toFixed(2).toLocaleString('nb-NO')} kr`}
                . {!batchComment && ' Det anbefales å legge til en kommentar for å forklare endringen.'}
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={batchApprovalLoading}>
          Avbryt
        </Button>
        <Button
          onClick={handleBatchApprove}
          variant="contained"
          color="success"
          startIcon={<CheckCircle />}
          disabled={batchApprovalLoading || !batchAmount || parseFloat(batchAmount) <= 0}
        >
          {batchApprovalLoading ? <CircularProgress size={24} /> : 'Godkjenn Provisjon'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApprovalDialog;
