import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from './SalesData';
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import SalesDataDashboard from './SalesDataDashboard'; // Import SalesDataDashboard
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/sales-dashboard" />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/salary-models" element={<SalaryModels />} />
        <Route path="/sales-data" element={<SalesData />} />
        <Route path="/salary-deductions" element={<SalaryDeductionsUpload />} />
        <Route path="/sales-dashboard" element={<SalesDataDashboard />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
