import React, { useState, useEffect } from 'react';
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
  FormControlLabel,
  Switch,
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
  // Legg til state for bonus og 5% trekk
  const [bonus, setBonus] = useState(0);
  const [applyFivePercent, setApplyFivePercent] = useState(false);

  // Beregn total provisjon basert på agentens data
  const calculateTotalProvision = (agent) => {
    if (!agent) return { total: 0, details: {} };

    console.log("Beregner provisjon for agent:", agent.name, {
      id: agent.id,
      applyFivePercent: applyFivePercent, // Bruk state-verdien
      monthsEmployed: agent.monthsEmployed,
      hireDate: agent.hireDate,
      fivePercentDeduction: agent.fivePercentDeduction,
      bonus: bonus // Bruk statens bonus-verdi
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
        applyFivePercent: applyFivePercent, // Bruk state-verdien
        monthsEmployed: agent.monthsEmployed,
        bonus: bonus // Bruk statens bonus-verdi
      });
      
      // Bruk forhåndsberegnede verdier
      const skadeCommission = agent.skadeCommission || 0;
      const livCommission = agent.livCommission || 0;
      const bonusAmount = parseFloat(bonus) || 0; // Bruk statens bonus-verdi
      const totalBeforeDeductions = agent.totalBeforeTrekk || (skadeCommission + livCommission);
      const totalWithBonus = totalBeforeDeductions + bonusAmount;
      
      // Bruk state-verdien for applyFivePercent
      console.log("5% trekk status:", applyFivePercent, "for agent:", agent.name);

      // 5% trekk beregnes KUN på salgsprovisjon (ikke bonus)
      const fivePercentDeduction = applyFivePercent ? totalBeforeDeductions * 0.05 : 0;
      
      const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
      const byttDeduction = agent.byttDeduction || 0;
      const otherDeductions = agent.otherDeductions || 0;
      const fixedSalary = agent.baseSalary || 0;
      
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
        applyFivePercent, // Bruk state-verdien
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
          bonus: bonusAmount,
        },
      };
    } else {
      console.log("Beregner provisjon på nytt fra satser:", {
        skadePremium: agent.skadePremium,
        livPremium: agent.livPremium,
        skadeCommissionRate: agent.skadeCommissionRate,
        livCommissionRate: agent.livCommissionRate,
        applyFivePercent: applyFivePercent, // Bruk state-verdien
        monthsEmployed: agent.monthsEmployed,
        bonus: bonus // Bruk statens bonus-verdi
      });
      
      // Beregn fra grunnen av
      const skadeCommission = (agent.skadePremium || 0) * ((agent.skadeCommissionRate || 0) / 100);
      const livCommission = (agent.livPremium || 0) * ((agent.livCommissionRate || 0) / 100);
      const totalBeforeDeductions = skadeCommission + livCommission;
      const bonusAmount = parseFloat(bonus) || 0; // Bruk statens bonus-verdi
      const totalWithBonus = totalBeforeDeductions + bonusAmount;

      // Bruk state-verdien for applyFivePercent
      console.log("5% trekk status:", applyFivePercent, "for agent:", agent.name);

      // 5% trekk beregnes KUN på salgsprovisjon (ikke bonus)
      const fivePercentDeduction = applyFivePercent ? totalBeforeDeductions * 0.05 : 0;
      const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
      const byttDeduction = agent.byttDeduction || 0;
      const otherDeductions = agent.otherDeductions || 0;
      
      // Samlet fradrag
      const deductions = fivePercentDeduction + tjenestetorgetDeduction + byttDeduction + otherDeductions;
      
      const fixedSalary = agent.baseSalary || 0;

      const total = totalWithBonus - deductions + fixedSalary;
      
      console.log("Beregnet provisjon:", {
        skadeCommission,
        livCommission,
        totalBeforeDeductions,
        totalWithBonus,
        applyFivePercent, // Bruk state-verdien
        fivePercentDeduction,
        totalDeductions: deductions,
        finalTotal: total,
        bonusAmount
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

  // Initialiser bonusverdi og 5% trekk-status når dialogen åpnes
  useEffect(() => {
    if (open && selectedAgent) {
      // Hent bonus-verdi fra agent hvis tilgjengelig
      setBonus(selectedAgent.bonus || selectedAgent.bonusAmount || 0);
      
      // Hent 5% trekk-status fra agent
      setApplyFivePercent(selectedAgent.applyFivePercent || false);
      
      // Viktig: Oppdater agent-objektet med bonusverdien
      if (selectedAgent) {
        selectedAgent.bonus = parseFloat(selectedAgent.bonus || selectedAgent.bonusAmount || 0);
      }
      
      console.log("BONUS DEBUG - Initialisert:", {
        agentName: selectedAgent.name,
        bonusValue: selectedAgent.bonus || selectedAgent.bonusAmount || 0,
        applyFivePercent: selectedAgent.applyFivePercent
      });
    }
  }, [open, selectedAgent]);

  // Når dialogen åpnes, initialiser batchAmount til den beregnede totalen
  useEffect(() => {
    if (open && selectedAgent) {
      const { total } = calculateTotalProvision(selectedAgent);
      setBatchAmount(total.toFixed(2));
    }
  }, [open, selectedAgent, setBatchAmount, bonus, applyFivePercent]); // Legg til avhengigheter

  if (!selectedAgent) {
    return null;
  }

  const { total, details } = calculateTotalProvision(selectedAgent);

  // Funksjon for å oppdatere agent-objektet når bonus endres
  const handleBonusChange = (e) => {
    const newBonusValue = e.target.value ? parseFloat(e.target.value) : 0;
    setBonus(newBonusValue);
    
    // VIKTIG: Oppdater agent-objektet direkte
    if (selectedAgent) {
      selectedAgent.bonus = newBonusValue;
      selectedAgent.bonusAmount = newBonusValue;
    }
    
    // Oppdatert batch amount basert på ny beregning med bonus
    const { total } = calculateTotalProvision(selectedAgent);
    setBatchAmount(total.toFixed(2));
    
    console.log("BONUS DEBUG - Endret:", {
      agentName: selectedAgent?.name,
      newBonusValue: newBonusValue,
      agentBonus: selectedAgent?.bonus
    });
  };
  
  // Funksjon for å håndtere endringer i 5% trekk-status
  const handleFivePercentChange = (event) => {
    const newValue = event.target.checked;
    setApplyFivePercent(newValue);
    
    // VIKTIG: Oppdater agent-objektet direkte
    if (selectedAgent) {
      selectedAgent.applyFivePercent = newValue;
    }
    
    // Oppdater batch amount basert på ny beregning med endret 5% trekk-status
    const { total } = calculateTotalProvision(selectedAgent);
    setBatchAmount(total.toFixed(2));
    
    console.log("5% TREKK DEBUG - Endret:", {
      agentName: selectedAgent?.name,
      newValue,
      agentApplyFivePercent: selectedAgent?.applyFivePercent
    });
  };

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

          {/* Legg til kontroll for å slå av/på 5% trekk */}
          <Box mt={2} mb={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={applyFivePercent}
                  onChange={handleFivePercentChange}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  Aktiver 5% trekk {selectedAgent.monthsEmployed !== null && 
                    `(${selectedAgent.monthsEmployed} måneder ansatt${selectedAgent.monthsEmployed < 9 ? 
                      ', anbefalt' : ', ikke nødvendig'})`}
                </Typography>
              }
            />
          </Box>

          {/* Bonus input felt */}
          <Box mt={2} mb={1}>
            <TextField
              label="Bonus"
              type="number"
              fullWidth
              variant="outlined"
              value={bonus}
              onChange={handleBonusChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">kr</InputAdornment>
                ),
              }}
              helperText="Legg til eventuell bonus for perioden"
            />
          </Box>

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

                {parseFloat(bonus) > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main">Bonus:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="success.main" align="right">
                        +{parseFloat(bonus).toLocaleString('nb-NO')} kr
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

                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body1" fontWeight="bold">Total utbetaling:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" fontWeight="bold" color="success.main" align="right">
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
          onClick={() => handleBatchApprove(selectedAgent, parseFloat(batchAmount), batchComment)}
          variant="contained"
          color="success"
          startIcon={batchApprovalLoading ? <CircularProgress size={24} /> : <CheckCircle />}
          disabled={batchApprovalLoading || !batchAmount || parseFloat(batchAmount) <= 0}
        >
          {batchApprovalLoading ? 'Godkjenn Provisjon' : 'Godkjenn'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApprovalDialog;
