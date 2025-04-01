import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Import pages
import Login from '../features/auth/pages/Login';
import AdminDashboard from '../features/admin/pages/SalesDataDashboard';
import SalaryModels from '../features/salary/pages/SalaryModels';
import SalesData from '../features/sales/pages/SalesData';
import SalaryDeductionsUpload from '../features/salary/pages/SalaryDeductionsUpload';
import AccountingExport from '../features/accounting/pages/AccountingExport';
import OfficeManagerDashboard from '../features/manager/pages/OfficeManagerDashboard';
import AgentDashboard from '../features/agent/pages/AgentDashboard';
import Employees from '../features/employees/pages/Employees';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes that don't require authentication */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/sales-dashboard" />} />
      
      {/* Protected routes with role-based access control */}
      <Route path="/employees" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <Employees key="employees-component" />
        </ProtectedRoute>
      } />
      
      <Route path="/salary-models" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <SalaryModels />
        </ProtectedRoute>
      } />
      
      <Route path="/sales-data" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <SalesData />
        </ProtectedRoute>
      } />
      
      <Route path="/salary-deductions" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <SalaryDeductionsUpload />
        </ProtectedRoute>
      } />
      
      <Route path="/accounting-export" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <AccountingExport />
        </ProtectedRoute>
      } />
      
      <Route path="/sales-dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <SalesDataDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/office-dashboard" element={
        <ProtectedRoute allowedRoles={['manager', 'admin']}>
          <OfficeManagerDashboard />
        </ProtectedRoute>
      } />

      <Route path="/agent-dashboard" element={
        <ProtectedRoute allowedRoles={['agent']}>
          <AgentDashboard />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;
