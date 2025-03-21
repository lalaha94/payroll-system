import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard'; // Oppdatert import
import Employees from './Employees';
import SalaryModels from './SalaryModels';
import SalesData from "./SalesData"; // Ny side
import SalaryDeductionsUpload from './SalaryDeductionsUpload';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/salary-models" element={<SalaryModels />} />
        <Route path="/sales-data" element={<SalesData />} />
        <Route path="/salary-deductions" element={<SalaryDeductionsUpload />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
