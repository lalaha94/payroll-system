import Dashboard from './Dashboard';
// ...existing imports...
import SalaryDeductionsUpload from './SalaryDeductionsUpload';

const routes = [
  // ...existing routes...
  {
    path: '/employees',
    component: EmployeesPage,
  },
  {
    path: '/salary-models',
    component: SalaryModelsPage,
  },
  {
    path: '/sales-data',
    component: SalesDataDashboard,
  },
  
  // Add new route for salary deductions
  {
    path: '/salary-deductions',
    component: SalaryDeductionsUpload,
  },
  
  // ...other existing routes...
];

export default routes;
