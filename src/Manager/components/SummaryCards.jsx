import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Divider
} from '@mui/material';

const SummaryCards = ({ officePerformance }) => {
  return (
    <Grid container spacing={3}>
      {/* Total Sales Card */}
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Totalt salg
            </Typography>
            <Typography variant="h5" component="div" color="primary.main" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
              {officePerformance.totalPremium?.toLocaleString('nb-NO')} kr
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {officePerformance.activeAgentCount || 0}/{officePerformance.agentCount || 0} med salg denne måneden til aktive rådgivere
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Total Commission Card */}
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Total provisjon
            </Typography>
            <Typography variant="h5" component="div" color="secondary.main" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
              {officePerformance.totalCommission?.toLocaleString('nb-NO')} kr
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Gjennomsnitt: {officePerformance.avgCommission?.toLocaleString('nb-NO')} kr
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Total Sales Count Card */}
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Antall salg
            </Typography>
            <Typography variant="h5" component="div" color="info.main" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
              {officePerformance.totalCount || 0}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Liv: {officePerformance.livCount || 0} | Skade: {officePerformance.skadeCount || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Active Agents Card */}
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" component="div" gutterBottom sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Aktive rådgivere
            </Typography>
            <Typography variant="h5" component="div" color="success.main" fontWeight="bold" sx={{ fontSize: '1.5rem' }}>
              {officePerformance.activeAgentCount || 0}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              Av totalt {officePerformance.agentCount || 0} registrerte rådgivere
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SummaryCards;
