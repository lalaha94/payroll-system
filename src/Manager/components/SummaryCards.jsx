import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography
} from '@mui/material';

const SummaryCards = ({ officePerformance }) => {
  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Total Premie
            </Typography>
            <Typography variant="h5" component="div" fontWeight="bold" color="primary">
              {officePerformance.totalPremium?.toLocaleString('nb-NO')} kr
            </Typography>
            <Typography variant="body2" color="text.secondary">
              for inneværende måned
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Total Provisjon
            </Typography>
            <Typography variant="h5" component="div" fontWeight="bold" color="secondary">
              {officePerformance.totalCommission?.toLocaleString('nb-NO')} kr
            </Typography>
            <Typography variant="body2" color="text.secondary">
              for kontoret
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Antall Salg
            </Typography>
            <Typography variant="h5" component="div" fontWeight="bold" color="success.main">
              {officePerformance.totalCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {officePerformance.livCount || 0} Liv / {officePerformance.skadeCount || 0} Skade
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card elevation={2}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Aktive Agenter
            </Typography>
            <Typography variant="h5" component="div" fontWeight="bold">
              {officePerformance.agentCount || 0} / {officePerformance.activeAgentCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              med salg denne måneden
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SummaryCards;
