import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import TestSalaryModels from "./TestSalaryModels"; // 👈 Importer her
import SalesData from "./SalesData"; // Ny side
import SalesDataAggregate from "./SalesDataAggregate"; // Importer komponenten
import SalesDataDashboard from "./SalesDataDashboard"; // Importer den nye komponenten
import SalaryDeductionsUpload from './SalaryDeductionsUpload';



import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/salary-models" element={<SalaryModels />} />
        <Route path="/test-salary-models" element={<TestSalaryModels />} /> {/* 👈 Ny rute */}
        <Route path="/sales-data" element={<SalesData />} />
        <Route path="/sales-data-aggregate" element={<SalesDataAggregate />} />
        <Route path="/salary-deductions" element={<SalaryDeductionsUpload />} />

        <Route path="/sales-dashboard" element={<SalesDataDashboard />} /> {/* Ny route */}

      </Routes>
    </Router>
  </React.StrictMode>
);
