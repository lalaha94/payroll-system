import React from 'react';
import SalesDataDashboardComponent from './admin/SalesDataDashboard';

// This file now imports and re-exports the dashboard from the admin folder
const SalesDataDashboardWrapper = (props) => {
  return <SalesDataDashboardComponent {...props} />;
}

export default SalesDataDashboardWrapper;
