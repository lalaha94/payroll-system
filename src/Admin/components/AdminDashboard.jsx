import React from 'react';
import { Box, Typography, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

const AdminDashboard = () => {
  const { notifications, loading } = useAdminDashboard();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Admin Notifications
      </Typography>
      <List>
        {notifications.map((notification, index) => (
          <ListItem key={index}>
            <ListItemText
              primary={`Agent: ${notification.agentName}, Month: ${notification.monthYear}`}
              secondary={`Approved Amount: ${notification.approvedAmount} - ${new Date(notification.timestamp).toLocaleString()}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default AdminDashboard;
