import React from 'react';
import { Navigate } from 'react-router-dom';
import OfficeManagerDashboard from './Manager/OfficeManagerDashboard';

// This file is now a wrapper that uses the modular version from the Manager folder
// For backward compatibility - this ensures any direct imports of this file will still work
const OfficeManagerDashboardWrapper = (props) => {
  return <OfficeManagerDashboard {...props} />;
}

export default OfficeManagerDashboardWrapper;
