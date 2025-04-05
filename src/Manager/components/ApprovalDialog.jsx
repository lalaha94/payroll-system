import React, { useEffect } from 'react';
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
import { Comment, CheckCircle } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

/**
 * Dialog for godkjenning av månedsprovisjon
 */
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
  batchApprovalLoading,
  managerData,
  setSuccess,
  setError,
  fetchApprovals,
}) => {
  const theme = useTheme();

  // Beregn total provisjon basert på agentens data
  const calculateTotalProvision = (agent) => {
    if (!agent) return { total: 0, details: {} };

    console.log("Beregner provisjon for agent:", agent.name, {
      id: agent.id,
      applyFivePercent: agent.applyFivePercent,
      monthsEmployed: agent.monthsEmployed,
      hireDate: agent.hireDate,
      fivePercentDeduction: agent.fivePercentDeduction
    });

    // Bruk de forhåndsberegnede verdiene hvis de finnes
    if (agent.livCommission !== undefined && 
        agent.skadeCommission !== undefined && 
        agent.totalBeforeTrekk !== undefined) {
      
      console.log("Bruker forhåndsberegnede provisjonsverdier:", {
        livCommission: agent.livCommission,
        skadeCommission: agent.skadeCommission,
        bonusAmount: agent.bonusAmount,
        totalBeforeTrekk: agent.totalBeforeTrekk,
        applyFivePercent: agent.applyFivePercent,
        monthsEmployed: agent.monthsEmployed
      });
      
      // Bruk forhåndsberegnede verdier
      const skadeCommission = agent.skadeCommission || 0;
      const livCommission = agent.livCommission || 0;
      const bonusAmount = agent.bonusAmount || 0;
      const totalBeforeDeductions = agent.totalBeforeTrekk || (skadeCommission + livCommission);
      const totalWithBonus = totalBeforeDeductions + bonusAmount;
      
      // Beregn 5% trekket basert på det totale beløpet med bonus hvis flagget er satt
      const applyFivePercent = agent.applyFivePercent !== undefined ? agent.applyFivePercent : false;
      console.log("5% trekk status:", applyFivePercent, "for agent:", agent.name);

      const fivePercentDeduction = applyFivePercent ? totalWithBonus * 0.05 : 0;
      
      const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
      const byttDeduction = agent.byttDeduction || 0;
      const otherDeductions = agent.otherDeductions || 0;
      const fixedSalary = agent.baseSalary || 0;
      const bonus = agent.bonus || 0;
      
      // Samlet fradrag
      const deductions = fivePercentDeduction + tjenestetorgetDeduction + byttDeduction + otherDeductions;
      
      // Total provisjon
      const total = totalWithBonus - deductions;
      
      console.log("Beregnet provisjon:", {
        skadeCommission,
        livCommission,
        bonusAmount,
        totalBeforeDeductions,
        totalWithBonus,
        applyFivePercent: agent.applyFivePercent,
        fivePercentDeduction,
        totalDeductions: deductions,
        finalTotal: total
      });
      
      return {
        total,
        details: {
          skadeCommission,
          livCommission,
          bonusAmount,
          totalBeforeDeductions,
          totalWithBonus,
          fivePercentDeduction,
          tjenestetorgetDeduction,
          byttDeduction,
          otherDeductions,
          fixedSalary,
          bonus,
        },
      };
    } else {
      console.log("Beregner provisjon på nytt fra satser:", {
        skadePremium: agent.skadePremium,
        livPremium: agent.livPremium,
        skadeCommissionRate: agent.skadeCommissionRate,
        livCommissionRate: agent.livCommissionRate,
        applyFivePercent: agent.applyFivePercent,
        monthsEmployed: agent.monthsEmployed,
        bonus: agent.bonus
      });
      
      // Beregn fra grunnen av
      const skadeCommission = (agent.skadePremium || 0) * ((agent.skadeCommissionRate || 0) / 100);
      const livCommission = (agent.livPremium || 0) * ((agent.livCommissionRate || 0) / 100);
      const totalBeforeDeductions = skadeCommission + livCommission;
      const bonus = agent.bonus || 0;
      const totalWithBonus = totalBeforeDeductions + bonus;

      // 5% trekk basert på totalBeløp med bonus
      const applyFivePercent = agent.applyFivePercent !== undefined ? agent.applyFivePercent : false;
      console.log("5% trekk status:", applyFivePercent, "for agent:", agent.name);

      const fivePercentDeduction = applyFivePercent ? totalWithBonus * 0.05 : 0;
      const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
      const byttDeduction = agent.byttDeduction || 0;
      const otherDeductions = agent.otherDeductions || 0;
      
      // Samlet fradrag
      const deductions = fivePercentDeduction + tjenestetorgetDeduction + byttDeduction + otherDeductions;
      
      const fixedSalary = agent.baseSalary || 0;
      const bonusAmount = bonus;

      const total = totalWithBonus - deductions + fixedSalary;
      
      console.log("Beregnet provisjon:", {
        skadeCommission,
        livCommission,
        totalBeforeDeductions,
        totalWithBonus,
        applyFivePercent: agent.applyFivePercent,
        fivePercentDeduction,
        totalDeductions: deductions,
        finalTotal: total
      });

      return {
        total,
        details: {
          skadeCommission,
          livCommission,
          totalBeforeDeductions,
          totalWithBonus,
          fivePercentDeduction,
          tjenestetorgetDeduction,
          byttDeduction,
          otherDeductions,
          fixedSalary,
          bonusAmount,
        },
      };
    }
  };

  // Når dialogen åpnes, initialiser batchAmount til den beregnede totalen
  useEffect(() => {
    if (open && selectedAgent) {
      const { total } = calculateTotalProvision(selectedAgent);
      setBatchAmount(total.toFixed(2));
    }
  }, [open, selectedAgent, setBatchAmount]);

  if (!selectedAgent) {
    return null;
  }

  const { total, details } = calculateTotalProvision(selectedAgent);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Godkjenn månedsprovisjon</DialogTitle>
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
                  <Box component="li">
                    Tjenestetorget trekk: {selectedAgent.modificationDetails.tjenestetorget.toLocaleString('nb-NO')} kr
                  </Box>
                )}
                {selectedAgent.modificationDetails?.bytt > 0 && (
                  <Box component="li">
                    Bytt trekk: {selectedAgent.modificationDetails.bytt.toLocaleString('nb-NO')} kr
                  </Box>
                )}
                {selectedAgent.modificationDetails?.other > 0 && (
                  <Box component="li">
                    Andre trekk: {selectedAgent.modificationDetails.other.toLocaleString('nb-NO')} kr
                  </Box>
                )}
                {selectedAgent.modificationDetails?.applyFivePercent !== undefined && (
                  <Box component="li">
                    5% trekk: {selectedAgent.modificationDetails.applyFivePercent ? 'Ja' : 'Nei'}
                  </Box>
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
              {total.toLocaleString('nb-NO')} kr
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Beregningsdetaljer</Typography>
            <Box sx={{ px: 2, py: 1, bgcolor: theme.palette.grey[50], borderRadius: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2">Skadeprovisjon:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right">
                    {details.skadeCommission.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2">Livprovisjon:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" align="right">
                    {details.livCommission.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="bold">Sum provisjon:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="bold" align="right">
                    {details.totalBeforeDeductions.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                {details.bonusAmount > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main">Bonus:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main" align="right">
                        +{details.bonusAmount.toLocaleString('nb-NO')} kr
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold">Sum med bonus:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold" align="right">
                        {details.totalWithBonus.toLocaleString('nb-NO')} kr
                      </Typography>
                    </Grid>
                  </>
                )}

                {details.fivePercentDeduction > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="error">5% trekk (nyansatt):</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="error" align="right">
                        -{details.fivePercentDeduction.toLocaleString('nb-NO')} kr
                      </Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={6}>
                  <Typography variant="body2" color="error">Tjenestetorget trekk:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="error" align="right">
                    -{details.tjenestetorgetDeduction.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2" color="error">Bytt trekk:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="error" align="right">
                    -{details.byttDeduction.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2" color="error">Andre trekk:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="error" align="right">
                    -{details.otherDeductions.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>

                {details.fixedSalary > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main">Fastlønn:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main" align="right">
                        +{details.fixedSalary.toLocaleString('nb-NO')} kr
                      </Typography>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                <Grid item xs={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Total utbetaling:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle1" fontWeight="bold" align="right" color={theme.palette.success.main}>
                    {total.toLocaleString('nb-NO')} kr
                  </Typography>
                </Grid>
              </Grid>
            </Box>
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
              <Button size="small" variant="outlined" onClick={() => handleCommissionAdjustment('reset')}>
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

          {parseFloat(batchAmount).toFixed(2) !== total.toFixed(2) && (
            <Grid item xs={12}>
              <Alert severity={parseFloat(batchAmount) > total ? 'info' : 'warning'}>
                {parseFloat(batchAmount) > total
                  ? `Du har økt provisjonsbeløpet med ${(parseFloat(batchAmount) - total).toFixed(2).toLocaleString('nb-NO')} kr`
                  : `Du har redusert provisjonsbeløpet med ${(total - parseFloat(batchAmount)).toFixed(2).toLocaleString('nb-NO')} kr`}
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
