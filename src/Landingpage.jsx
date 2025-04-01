import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from './SalesData';
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import AccountingExport from './AccountingExport';
import Login from './components/Login';
import { OfficeManagerDashboard } from './Manager';

const Landingpage = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/salary-models" element={<SalaryModels />} />
      <Route path="/sales-data" element={<SalesData />} />
      <Route path="/salary-deductions" element={<SalaryDeductionsUpload />} />
      <Route path="/accounting-export" element={<AccountingExport />} />
      <Route path="/office-dashboard" element={<OfficeManagerDashboard />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default Landingpage;