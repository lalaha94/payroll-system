// Configuration for route mapping, used to generate navigation
export const routeConfig = {
  admin: [
    {
      path: '/sales-dashboard',
      label: 'Dashboard',
      icon: 'Dashboard',
    },
    {
      path: '/employees',
      label: 'Ansatte',
      icon: 'People',
    },
    {
      path: '/salary-models',
      label: 'Lønnstrinn',
      icon: 'Payments',
    },
    {
      path: '/sales-data',
      label: 'Salgsdata',
      icon: 'BarChart',
    },
    {
      path: '/salary-deductions',
      label: 'Lønnstrekk',
      icon: 'MoneyOff',
    },
    {
      path: '/accounting-export',
      label: 'Regnskap',
      icon: 'AccountBalance',
    },
  ],
  manager: [
    {
      path: '/office-dashboard',
      label: 'Kontor',
      icon: 'Business',
    },
    {
      path: '/employees',
      label: 'Ansatte',
      icon: 'People',
    }
  ],
  agent: [
    {
      path: '/agent-dashboard',
      label: 'Min Oversikt',
      icon: 'Person',
    },
  ],
};
