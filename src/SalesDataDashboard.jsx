import React from 'react';
import SalesDataDashboard from './admin';

// This file now imports and re-exports the dashboard from the admin folder
// This ensures backward compatibility with any existing imports of this file
const SalesDataDashboardWrapper = (props) => {
  return <SalesDataDashboard {...props} />;
}

export default SalesDataDashboardWrapper;
