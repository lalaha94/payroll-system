import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box, Typography, Grid, Card, CardContent, Divider, TextField,
  MenuItem, CircularProgress, Tab, Tabs, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Alert,
  Chip, Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, FormControl, InputLabel, Select
} from '@mui/material';
import NavigationMenu from '../components/NavigationMenu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line
} from 'recharts';
import { supabase } from '../supabaseClient';
import { 
  ReceiptLong, Download, CalendarMonth, TrendingUp, 
  PieChart as PieChartIcon, BarChart as BarChartIcon,
  CheckCircle, Cancel, Info
} from '@mui/icons-material';
import { differenceInMonths } from 'date-fns';

function SalesDataDashboard() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [approvalData, setApprovalData] = useState([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [tenderData, setTenderData] = useState({});
  
  const openRevokeDialog = (agent) => {
    setSelectedAgent(agent);
    setRevokeDialogOpen(true);
  };

  const closeRevokeDialog = () => {
    setRevokeDialogOpen(false);
    setSelectedAgent(null);
    setRevokeReason('');
  };
  
  const handleRevokeApproval = async () => {
    if (!selectedAgent) return;
    
    setRevokeLoading(true);
    try {
      const { error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_by: 'Admin',
          revocation_reason: revokeReason
        })
        .eq('id', selectedAgent.approvalInfo.id);
      
      if (error) throw error;
      
      // Oppdater lokal state
      setAgentData(prev => prev.map(agent => 
        agent.agent_name === selectedAgent.agent_name
          ? { ...agent, isApproved: false, approvalInfo: null }
          : agent
      ));
      
      closeRevokeDialog();
    } catch (error) {
      console.error('Error revoking approval:', error);
    } finally {
      setRevokeLoading(false);
    }
  };
  
  // Chart colors
  const CHART_COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];
  
  // Legg til formatCurrency funksjon
  const formatCurrency = (value) => {
    // Håndter null eller undefined verdier
    if (value === undefined || value === null) {
      return '0,00 kr';
    }
    return value.toLocaleString('no-NO', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' kr';
  };
  
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Sjekk autentisering først
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Ingen aktiv sesjon funnet');
        }

        // Fetch data in parallel for better performance
        const [salesResponse, modelsResponse, monthlyApprovals, employeesResponse, tenderResponse] = await Promise.all([
          supabase
            .from('sales_data')
            .select('*')
            .order('policy_sale_date', { ascending: false }),
          supabase
            .from('salary_models')
            .select('*'),
          supabase
            .from('monthly_commission_approvals')
            .select('*'),
          supabase
            .from('employees')
            .select('name, agent_id, agent_company, salary_model_id, hire_date, apply_five_percent_deduction'),
          supabase
            .from('tender_data')
            .select('*')
        ]);
        
        // Logg responser for debugging
        console.log('Data responses:', {
          sales: salesResponse,
          models: modelsResponse,
          approvals: monthlyApprovals,
          employees: employeesResponse,
          tenders: tenderResponse
        });
        
        if (salesResponse.error) throw new Error(`Sales data error: ${salesResponse.error.message}`);
        if (modelsResponse.error) throw new Error(`Salary models error: ${modelsResponse.error.message}`);
        if (monthlyApprovals.error) throw new Error(`Approvals error: ${monthlyApprovals.error.message}`);
        if (employeesResponse.error) throw new Error(`Employees error: ${employeesResponse.error.message}`);
        if (tenderResponse.error) throw new Error(`Tender data error: ${tenderResponse.error.message}`);

        // Organiser anbudsdata etter agent
        const tenderMap = {};
        if (tenderResponse.data) {
          console.log('Processing tender data:', tenderResponse.data);
          tenderResponse.data.forEach(tender => {
            if (!tender.agent_name || !tender.month_year) {
              console.warn('Invalid tender data:', tender);
              return;
            }
            const key = `${tender.agent_name}-${tender.month_year}`;
            console.log('Processing tender for key:', key);
            tenderMap[key] = {
              tjenestetorget: parseFloat(tender.tjenestetorget) || 0,
              bytt: parseFloat(tender.bytt) || 0,
              other: parseFloat(tender.other) || 0
            };
          });
        }
        console.log('Final tender map:', tenderMap);
        setTenderData(tenderMap);
        
        // Create a map of agent names to their employee data from employees table
        const employeeSalaryModels = {};
        employeesResponse.data.forEach(employee => {
          if (employee.name) {
            employeeSalaryModels[employee.name] = {
              salary_model_id: employee.salary_model_id,
              agent_company: employee.agent_company,
              agent_id: employee.agent_id,
              hire_date: employee.hire_date,
              apply_five_percent_deduction: employee.apply_five_percent_deduction
            };
          }
        });
        
        // Process sales data to get agent performance by month
        const { agentData: processedAgents, months: processedMonths } = aggregateSalesByAgent(salesResponse.data || [], employeeSalaryModels, modelsResponse.data || []);
        
        // Sort months in descending order (most recent first)
        const sortedMonths = [...processedMonths].sort((a, b) => b.localeCompare(a));
        
        // Set default selected month to most recent
        const latestMonth = sortedMonths.length > 0 ? sortedMonths[0] : '';
        
        // Calculate commissions for each agent using the salary models
        const agentsWithCommission = processedAgents.map(agent => {
          const commission = calculateCommission(agent, modelsResponse.data || []);
          
          // Check if there's an approved commission for this agent/month
          const approvalRecord = monthlyApprovals.data?.find(
            a => a.agent_name === agent.agent_name && 
                a.month_year === agent.monthKey &&
                a.approved === true && 
                a.revoked !== true
          );
          
          return { 
            ...agent, 
            ...commission,
            isApproved: !!approvalRecord,
            approvedCommission: approvalRecord?.commission || null,
            approvalInfo: approvalRecord || null
          };
        });
        
        setSalesData(salesResponse.data || []);
        setAgentData(agentsWithCommission);
        setSalaryModels(modelsResponse.data || []);
        setMonths(sortedMonths);
        setSelectedMonth(latestMonth);
        setApprovalData(monthlyApprovals.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedMonth]);
  
  // Aggregate sales data by agent and month
  const aggregateSalesByAgent = (salesData, employeeSalaryModels, salaryModels) => {
    const agentMonthMap = {};
    const uniqueMonths = new Set();
    
    // Finn lønnstrinn 1
    const defaultSalaryModel = salaryModels.find(model => String(model.id) === '1');
    if (!defaultSalaryModel) {
      console.warn('Kunne ikke finne lønnstrinn 1 som standard lønnstrinn');
    }
    
    salesData.forEach(sale => {
      if (!sale.policy_sale_date || !sale.agent_name) return;
      
      // Skip cancelled sales
      if (sale.cancel_code) return;
      
      const date = new Date(sale.policy_sale_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      uniqueMonths.add(monthKey);
      
      const agentKey = `${sale.agent_name}_${monthKey}`;
      
      if (!agentMonthMap[agentKey]) {
        // Hent ansattdata fra employeeSalaryModels objektet
        const employeeData = employeeSalaryModels[sale.agent_name] || {};
        
        // Beregn ansettelsestid hvis vi har hire_date
        let shouldApplyFivePercent = false;
        const hireDate = employeeData.hire_date ? new Date(employeeData.hire_date) : null;
        let monthsEmployed = null;
        
        if (hireDate) {
          // Sjekk om ansatt har jobbet mindre enn 9 måneder
          monthsEmployed = differenceInMonths(new Date(), hireDate);
          shouldApplyFivePercent = monthsEmployed < 9;
          
          console.log(`Agent ${sale.agent_name} ansettelsestid:`, {
            hireDate: hireDate.toISOString().split('T')[0],
            monthsEmployed,
            shouldApplyFivePercent
          });
        }
        
        // Sjekk om apply_five_percent_deduction er satt manuelt
        const manualFivePercentSetting = employeeData.apply_five_percent_deduction;
        
        // Bestem endelig 5% trekk-status: Enten på grunn av <9 måneder eller manuelt satt til true
        const applyFivePercent = manualFivePercentSetting === true || shouldApplyFivePercent;
        
        console.log(`Agent ${sale.agent_name} 5% trekk status:`, {
          shouldApplyFivePercent,
          manualSetting: manualFivePercentSetting,
          finalDecision: applyFivePercent
        });
        
        // Bruk lønnstrinn 1 som standard hvis ingen lønnstrinn er satt
        const actualSalaryModelId = employeeData.salary_model_id || '1';
        
        // Finn lønnstrinnmodellen
        const salaryModel = salaryModels.find(model => 
          String(model.id) === String(actualSalaryModelId)
        ) || defaultSalaryModel;
        
        agentMonthMap[agentKey] = {
          agent_name: sale.agent_name,
          monthKey,
          livPremium: 0,
          skadePremium: 0,
          totalPremium: 0,
          saleCount: 0,
          salary_model_id: actualSalaryModelId,
          salary_model_name: salaryModel?.name || 'Lønnstrinn 1',
          agent_company: employeeData.agent_company || 'Ukjent',
          agent_id: employeeData.agent_id,
          applyFivePercent: applyFivePercent,
          hire_date: hireDate ? hireDate.toISOString().split('T')[0] : null,
          monthsEmployed: monthsEmployed,
          tjenestetorgetDeduction: employeeData.tjenestetorget_deduction || 0,
          byttDeduction: employeeData.bytt_deduction || 0,
          otherDeductions: employeeData.other_deductions || 0,
          baseSalary: employeeData.base_salary || 0,
          bonus: employeeData.bonus || 0
        };
      }
      
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      
      if (provisjonsgruppe.includes("life")) {
        agentMonthMap[agentKey].livPremium += netPremium;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        agentMonthMap[agentKey].skadePremium += netPremium;
      }
      
      agentMonthMap[agentKey].totalPremium += netPremium;
      agentMonthMap[agentKey].saleCount++;
    });
    
    return {
      agentData: Object.values(agentMonthMap),
      months: Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a))
    };
  };
  
  // Calculate commission based on salary model
  const calculateCommission = (agent, salaryModels) => {
    if (!agent || !salaryModels) return { commission: 0 };

    // Finn lønnstrinn 1 som standard
    const defaultSalaryModel = salaryModels.find(model => String(model.id) === '1');
    
    // Bruk lønnstrinn 1 som standard hvis ingen lønnstrinn er satt
    const actualSalaryModelId = agent.salary_model_id || '1';

    // Finn agentens lønnstrinn
    const salaryModel = salaryModels.find(model => 
      String(model.id) === String(actualSalaryModelId)
    ) || defaultSalaryModel;

    if (!salaryModel) {
      console.warn(`Ingen lønnstrinn funnet for agent ${agent.agent_name}, og kunne ikke finne standardlønnstrinn 1`);
      return { commission: 0 };
    }

    // Beregn grunnprovisjon
    const livRate = parseFloat(salaryModel.commission_liv) || 0;
    const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
    
    const baseLivCommission = (agent.livPremium || 0) * (livRate / 100);
    const baseSkadeCommission = (agent.skadePremium || 0) * (skadeRate / 100);
    
    // Beregn samlet grunnprovisjon
    const baseCommission = baseLivCommission + baseSkadeCommission;
    let totalCommission = baseCommission;

    // Sjekk om bonus skal legges til
    let bonusAmount = 0;
    if (salaryModel.bonus_enabled && 
        salaryModel.bonus_threshold && 
        (agent.livPremium + agent.skadePremium) >= parseFloat(salaryModel.bonus_threshold)) {
      
      const bonusLivRate = parseFloat(salaryModel.bonus_percentage_liv) || 0;
      const bonusSkadeRate = parseFloat(salaryModel.bonus_percentage_skade) || 0;
      
      const bonusLivCommission = (agent.livPremium || 0) * (bonusLivRate / 100);
      const bonusSkadeCommission = (agent.skadePremium || 0) * (bonusSkadeRate / 100);
      
      bonusAmount = bonusLivCommission + bonusSkadeCommission;
      totalCommission += bonusAmount;
    }

    // Totalbeløp før trekk - dette er beregnet provisjon
    const totalBeforeTrekk = totalCommission;
    
    // Sjekk om agenten skal ha 5% trekk basert på flagget
    const applyFivePercent = agent.applyFivePercent !== undefined ? agent.applyFivePercent : false;
    
    // VIKTIG: 5% trekket skal beregnes basert på totalbeløp før trekk
    const fivePercentDeduction = applyFivePercent ? totalBeforeTrekk * 0.05 : 0;

    // Andre trekk
    const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
    const byttDeduction = agent.byttDeduction || 0;
    const otherDeductions = agent.otherDeductions || 0;
    
    // Legg til fastlønn og bonus
    const baseSalary = agent.baseSalary || 0;
    const bonus = agent.bonus || 0;

    // Beregn endelig provisjon - dette er provisjon etter alle trekk
    const finalCommission = totalBeforeTrekk - fivePercentDeduction - 
      tjenestetorgetDeduction - byttDeduction - otherDeductions + 
      baseSalary + bonus;

    console.log(`Provisjonsberegning for ${agent.agent_name}:`, {
      livPremium: agent.livPremium,
      skadePremium: agent.skadePremium,
      baseLivCommission,
      baseSkadeCommission,
      bonusAmount,
      baseCommission,
      totalBeforeTrekk,
      applyFivePercent,
      fivePercentDeduction,
      tjenestetorgetDeduction,
      byttDeduction,
      otherDeductions,
      finalCommission
    });

    return {
      // Viktig: Her returnerer vi provisjonen før trekk som "commission"
      commission: totalBeforeTrekk,
      details: {
        baseLivCommission,
        baseSkadeCommission,
        totalBeforeDeductions: totalBeforeTrekk,
        fivePercentDeduction,
        tjenestetorgetDeduction,
        byttDeduction,
        otherDeductions,
        baseSalary,
        bonus,
        // Endelig provisjon etter trekk
        finalCommission
      }
    };
  };
  
  // Filter agent data for the selected month
  const filteredAgentData = useMemo(() => {
    if (!agentData || !selectedMonth) return [];
    
    return agentData.filter(agent => agent.monthKey === selectedMonth);
  }, [agentData, selectedMonth]);
  
  // Calculate commissions for filtered data
  const agentTableData = useMemo(() => {
    if (!filteredAgentData || !salaryModels) return [];
    
    return filteredAgentData.map(agent => {
      const commissionResult = calculateCommission(agent, salaryModels);
      const approvalInfo = approvalData.find(
        a => a.agent_name === agent.agent_name && 
            a.month_year === agent.monthKey &&
            a.approved === true && 
            a.revoked !== true
      );

      // Hent anbudsdata fra approvalInfo hvis godkjent, ellers fra tenderData
      const tenderKey = `${agent.agent_name}-${agent.monthKey}`;
      const tenderInfo = tenderData[tenderKey] || { tjenestetorget: 0, bytt: 0, other: 0 };
      
      // Bestem om 5% trekk skal anvendes for godkjente agenter
      let finalApplyFivePercent = agent.applyFivePercent;
      
      // For godkjente agenter, hent apply_five_percent_deduction fra godkjenningen hvis tilgjengelig
      if (approvalInfo && approvalInfo.apply_five_percent_deduction !== undefined) {
        finalApplyFivePercent = approvalInfo.apply_five_percent_deduction === true;
      }
      
      console.log(`Agent ${agent.agent_name} endelig 5% trekk status:`, {
        originalApplyFivePercent: agent.applyFivePercent,
        approvalInfoStatus: approvalInfo?.apply_five_percent_deduction,
        finalApplyFivePercent,
        totalBeforeDeductions: commissionResult.details.totalBeforeDeductions,
        finalCommission: commissionResult.details.finalCommission
      });
      
      return {
        ...agent,
        ...commissionResult.details,
        // Viktig: Her er commissionResult.commission provisjonen før trekk
        commission: commissionResult.commission, 
        // finalCommission er provisjonen etter trekk
        finalCommission: commissionResult.details.finalCommission, 
        isApproved: !!approvalInfo,
        approvedCommission: approvalInfo?.approved_commission || null,
        approvalInfo: approvalInfo ? {
          ...approvalInfo,
          tjenestetorget: parseFloat(approvalInfo.tjenestetorget) || 0,
          bytt: parseFloat(approvalInfo.bytt) || 0,
          other_deductions: parseFloat(approvalInfo.other_deductions) || 0,
          apply_five_percent_deduction: approvalInfo.apply_five_percent_deduction
        } : null,
        // Sett endelig applyFivePercent verdi basert på beregningen ovenfor
        applyFivePercent: finalApplyFivePercent
      };
    });
  }, [filteredAgentData, salaryModels, approvalData, tenderData]);
  
  // Get approved totals for the selected month
  const approvedTotal = filteredAgentData
    .filter(agent => agent.isApproved)
    .reduce((sum, agent) => {
      const approvedAmount = agent.approvalInfo?.approved_commission || agent.commission;
      return sum + approvedAmount;
    }, 0);
  
  // Get calculated totals for the selected month
  const calculatedTotal = filteredAgentData
    .reduce((sum, agent) => sum + agent.commission, 0);
  
  // Sort agents by total commission (before deductions)
  const sortedAgents = [...filteredAgentData].sort((a, b) => 
    b.commission - a.commission
  );
  
  // Group approvals by office/company
  const approvalsByOffice = approvalData
    .filter(a => a.month_year === selectedMonth && a.approved === true && a.revoked !== true)
    .reduce((acc, approval) => {
      const company = approval.agent_company || 'Unknown';
      if (!acc[company]) {
        acc[company] = {
          name: company,
          count: 0,
          amount: 0,
          agents: []
        };
      }
      acc[company].count++;
      acc[company].amount += approval.commission || 0;
      acc[company].agents.push(approval.agent_name);
      return acc;
    }, {});
  
  // Convert to array for charts
  const officeDataArray = Object.values(approvalsByOffice);
  
  // Create comparison data for approvals vs. calculations
  const comparisonData = {
    labels: ['Approved', 'Calculated'],
    values: [approvedTotal, calculatedTotal],
    difference: approvedTotal - calculatedTotal,
    differencePercent: calculatedTotal > 0 ? ((approvedTotal - calculatedTotal) / calculatedTotal) * 100 : 0
  };
  
  // Format month for display: YYYY-MM to YYYY/MM
  const formatMonth = (month) => month.replace('-', '/');
  
  // Handle month change
  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Create monthly trend data for charts
  const getMonthlyTrendData = () => {
    // Group by month
    const monthlyTotals = {};
    
    agentData.forEach(agent => {
      if (!monthlyTotals[agent.monthKey]) {
        monthlyTotals[agent.monthKey] = {
          month: agent.monthKey,
          displayMonth: formatMonth(agent.monthKey),
          totalPremium: 0,
          totalCommission: 0,
          approvedCommission: 0,
          agentCount: 0
        };
      }
      
      monthlyTotals[agent.monthKey].totalPremium += agent.totalPremium;
      monthlyTotals[agent.monthKey].totalCommission += agent.commission;
      if (agent.approvedCommission) {
        monthlyTotals[agent.monthKey].approvedCommission += agent.commission;
      }
      monthlyTotals[agent.monthKey].agentCount++;
    });
    
    // Convert to array and sort by month
    return Object.values(monthlyTotals)
      .sort((a, b) => a.month.localeCompare(b.month));
  };
  
  // Create data for company performance chart
  const getCompanyPerformanceData = () => {
    // Gruppér etter kontor
    const companyTotals = {};
    
    filteredAgentData.forEach(agent => {
      const company = agent.agent_company || 'Ukjent';
      
      if (!companyTotals[company]) {
        companyTotals[company] = {
          name: company,
          totalPremium: 0,
          totalCommission: 0,
          approvedCommission: 0,
          agentCount: 0,
          approvedAgentCount: 0,
          deductions: 0,
          fivePercentDeductions: 0,
          tenderDeductions: 0,
          bonus: 0,
          otherAdjustments: 0
        };
      }
      
      // Oppdater totaler
      companyTotals[company].totalPremium += agent.totalPremium || 0;
      companyTotals[company].totalCommission += agent.commission || 0;
      companyTotals[company].agentCount++;
      
      // Håndter godkjente provisjoner
      if (agent.isApproved) {
        companyTotals[company].approvedCommission += agent.commission || 0;
        companyTotals[company].approvedAgentCount++;
        
        // Beregn trekk og justeringer
        const tjenestetorgetDeduction = agent.tjenestetorgetDeduction || 0;
        const byttDeduction = agent.byttDeduction || 0;
        const otherDeductions = agent.otherDeductions || 0;
        
        // Beregn 5% trekk basert på agentens applyFivePercent status
        const applyFivePercent = agent.applyFivePercent !== undefined ? agent.applyFivePercent : false;
        const agentCommission = agent.commission || 0;
        const fivePercentDeduction = applyFivePercent ? agentCommission * 0.05 : 0;
        
        companyTotals[company].tenderDeductions += tjenestetorgetDeduction + byttDeduction + otherDeductions;
        companyTotals[company].fivePercentDeductions += fivePercentDeduction;
        companyTotals[company].deductions += tjenestetorgetDeduction + byttDeduction + otherDeductions + fivePercentDeduction;
        
        // Beregn bonus hvis aktuelt
        if (agent.bonusEnabled && agent.bonusThreshold) {
          const totalPremium = (agent.livPremium || 0) + (agent.skadePremium || 0);
          if (totalPremium >= agent.bonusThreshold) {
            const bonusLivCommission = (agent.livPremium || 0) * ((agent.bonusLivRate || 0) / 100);
            const bonusSkadeCommission = (agent.skadePremium || 0) * ((agent.bonusSkadeRate || 0) / 100);
            companyTotals[company].bonus += bonusLivCommission + bonusSkadeCommission;
          }
        }
      }
    });
    
    // Konverter til array og sorter etter total provisjon
    return Object.values(companyTotals)
      .map(company => ({
        ...company,
        difference: company.approvedCommission - company.totalCommission,
        percentDiff: company.totalCommission !== 0 
          ? ((company.approvedCommission - company.totalCommission) / company.totalCommission) * 100 
          : 0,
        approvalRate: company.agentCount > 0 
          ? (company.approvedAgentCount / company.agentCount) * 100 
          : 0
      }))
      .sort((a, b) => b.totalPremium - a.totalPremium);
  };
  
  // Create pie chart data for product distribution
  const getProductDistributionData = () => {
    const productTypes = {
      liv: { name: 'Liv', value: 0 },
      skade: { name: 'Skade', value: 0 }
    };
    
    filteredAgentData.forEach(agent => {
      productTypes.liv.value += agent.livPremium;
      productTypes.skade.value += agent.skadePremium;
    });
    
    return Object.values(productTypes);
  };
  
  // Export data as CSV
  const exportData = (data, filename) => {
    // Format data as CSV
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openApprovalDialog = (agent) => {
    console.log("Åpner godkjenningsdialog for agent:", {
      name: agent.agent_name,
      applyFivePercent: agent.applyFivePercent,
      totalBeforeDeductions: agent.totalBeforeDeductions,
      approvalInfo: agent.approvalInfo
    });
    
    setSelectedAgent({
      ...agent,
      // Sikre at applyFivePercent og totalBeforeDeductions overføres korrekt
      applyFivePercent: agent.applyFivePercent,
      totalBeforeDeductions: agent.totalBeforeDeductions
    });
    setApprovalDialogOpen(true);
  };

  const closeDialogs = () => {
    setApprovalDialogOpen(false);
    setRevokeDialogOpen(false);
    setSelectedAgent(null);
  };
  
  const handleApproval = async () => {
    if (!selectedAgent) return;
    
    try {
      const tenderKey = `${selectedAgent.agent_name}-${selectedAgent.monthKey}`;
      const tenderInfo = tenderData[tenderKey] || { tjenestetorget: 0, bytt: 0, other: 0 };

      console.log("Godkjenner agent med følgende data:", {
        agent: selectedAgent.agent_name,
        applyFivePercent: selectedAgent.applyFivePercent,
        commission: selectedAgent.commission,
        totalBeforeDeductions: selectedAgent.totalBeforeDeductions,
        finalCommission: selectedAgent.finalCommission
      });

      const { error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: 'Admin',
          approved_commission: selectedAgent.commission, // Dette er beregnet provisjon før trekk
          salary_model_id: selectedAgent.salaryModelId,
          approval_comment: selectedAgent.approval_comment,
          tjenestetorget: tenderInfo.tjenestetorget,
          bytt: tenderInfo.bytt,
          other_deductions: tenderInfo.other,
          apply_five_percent_deduction: selectedAgent.applyFivePercent
        })
        .eq('id', selectedAgent.approvalInfo.id);
      
      if (error) throw error;
      
      // Beregn 5% trekk basert på totalbeløp før trekk
      const fivePercentDeduction = selectedAgent.applyFivePercent 
        ? (selectedAgent.totalBeforeDeductions || 0) * 0.05 
        : 0;
      
      // Oppdater lokal state
      setAgentData(prev => prev.map(agent => 
        agent.agent_name === selectedAgent.agent_name
          ? { 
              ...agent, 
              isApproved: true,
              commission: selectedAgent.commission, // Provisjon før trekk
              finalCommission: selectedAgent.finalCommission, // Provisjon etter trekk
              salaryModelId: selectedAgent.salaryModelId,
              approvalInfo: {
                ...selectedAgent.approvalInfo,
                approved_commission: selectedAgent.commission, // Dette er beregnet provisjon før trekk
                salary_model_id: selectedAgent.salaryModelId,
                approval_comment: selectedAgent.approval_comment,
                tjenestetorget: tenderInfo.tjenestetorget,
                bytt: tenderInfo.bytt,
                other_deductions: tenderInfo.other,
                apply_five_percent_deduction: selectedAgent.applyFivePercent
              },
              // Pass på at applyFivePercent er oppdatert i agent-objektet
              applyFivePercent: selectedAgent.applyFivePercent,
              fivePercentDeduction: fivePercentDeduction,
              totalBeforeDeductions: selectedAgent.totalBeforeDeductions
            }
          : agent
      ));
      
      closeDialogs();
    } catch (error) {
      console.error('Error updating approval:', error);
    }
  };
  
  // Oppdater getAgentTableData funksjonen
  const getAgentTableData = () => {
    if (!selectedMonth) return [];
    
    return agentData
      .filter(agent => agent.monthKey === selectedMonth)
      .map(agent => {
        const tenderKey = `${agent.agent_name}-${agent.monthKey}`;
        const tenderInfo = tenderData[tenderKey] || { tjenestetorget: 0, bytt: 0, other: 0 };
        
        // Beregn total anbud
        const totalTender = tenderInfo.tjenestetorget + tenderInfo.bytt + tenderInfo.other;
        
        return {
          ...agent,
          tenderTjenestetorget: tenderInfo.tjenestetorget,
          tenderBytt: tenderInfo.bytt,
          tenderOther: tenderInfo.other,
          totalTender: totalTender
        };
      })
      .sort((a, b) => b.commission - a.commission);
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <NavigationMenu />
        <CircularProgress size={60} sx={{ mt: 10 }} />
        <Typography variant="h6" sx={{ mt: 2 }}>Laster data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <NavigationMenu />
        <Alert severity="error" sx={{ mt: 10 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh", pt: { xs: 10, sm: 11, md: 12 } }}>
      <NavigationMenu />
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Salgsoversikt
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Oversikt over salgsdata og provisjoner for alle kontorer og agenter
        </Typography>
      </Box>
      
      {/* Month selector */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Måned"
              value={selectedMonth}
              onChange={handleMonthChange}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <CalendarMonth sx={{ mr: 1, color: 'action.active' }} />
                ),
              }}
            >
              {months.map((month) => (
                <MenuItem key={month} value={month}>
                  {formatMonth(month)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={9}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button 
                variant="outlined" 
                startIcon={<Download />}
                onClick={() => exportData(filteredAgentData, `sales_data_${selectedMonth}.csv`)}
                disabled={!selectedMonth || filteredAgentData.length === 0}
              >
                Eksporter data
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Summary cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Totalt salg
                </Typography>
                <ReceiptLong color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {filteredAgentData.reduce((sum, agent) => sum + (agent.totalPremium || 0), 0).toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Beregnet provisjon
                </Typography>
                <TrendingUp color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {calculatedTotal.toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                basert på individuelle lønnstrinn
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Godkjent provisjon
                </Typography>
                <CheckCircle color={approvedTotal > 0 ? "success" : "action"} />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold" color={approvedTotal < calculatedTotal ? "warning.main" : "success.main"}>
                {approvedTotal.toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="body2" color={Math.abs(comparisonData.differencePercent) > 5 ? "error.main" : "text.secondary"}>
                {comparisonData.difference !== 0 
                  ? `${comparisonData.difference > 0 ? '+' : ''}${comparisonData.difference.toLocaleString('no-NO')} kr (${comparisonData.differencePercent.toFixed(1)}%)` 
                  : 'Ingen differanse'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography color="text.secondary">
                  Antall agenter
                </Typography>
                <PieChartIcon color="primary" />
              </Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {filteredAgentData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {`${filteredAgentData.filter(a => a.isApproved).length} godkjent av ${filteredAgentData.length}`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs for different views */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Oversikt" />
          <Tab label="Kontorer" />
          <Tab label="Agenter" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {/* Tab 1: Overview */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" gutterBottom>
                  Provisjonsutvikling over tid
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={getMonthlyTrendData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayMonth" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => `${value.toLocaleString('no-NO')} kr`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalCommission" 
                        name="Beregnet provisjon" 
                        stroke={CHART_COLORS[0]} 
                        activeDot={{ r: 8 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="approvedCommission" 
                        name="Godkjent provisjon" 
                        stroke={CHART_COLORS[2]} 
                        strokeDasharray="5 5" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Produktfordeling
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getProductDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {getProductDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `${value.toLocaleString('no-NO')} kr`} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Godkjenninger per kontor
                </Typography>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={officeDataArray}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke={CHART_COLORS[0]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS[1]} />
                      <RechartsTooltip formatter={(value, name) => {
                        if (name === 'Antall godkjenninger') return value;
                        return `${value.toLocaleString('no-NO')} kr`;
                      }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="count" name="Antall godkjenninger" fill={CHART_COLORS[0]} />
                      <Bar yAxisId="right" dataKey="amount" name="Total godkjent provisjon" fill={CHART_COLORS[1]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}
          
          {/* Tab 2: Companies */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Kontoroversikt for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                      <TableCell>Kontor</TableCell>
                      <TableCell align="right">Antall agenter</TableCell>
                      <TableCell align="right">Godkjent</TableCell>
                      <TableCell align="right">Totalt salg</TableCell>
                      <TableCell align="right">Beregnet provisjon</TableCell>
                      <TableCell align="right">5% trekk</TableCell>
                      <TableCell align="right">Anbudstrekk</TableCell>
                      <TableCell align="right">Godkjent provisjon</TableCell>
                      <TableCell align="right">Differanse</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCompanyPerformanceData().map((company) => (
                      <TableRow key={company.name} hover>
                        <TableCell>{company.name}</TableCell>
                        <TableCell align="right">{company.agentCount}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {company.approvedAgentCount} av {company.agentCount}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({company.approvalRate.toFixed(1)}%)
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{(company.totalPremium || 0).toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">{(company.totalCommission || 0).toLocaleString('no-NO')} kr</TableCell>
                        <TableCell align="right">
                          {company.fivePercentDeductions > 0 ? 
                            `${(company.fivePercentDeductions || 0).toLocaleString('no-NO')} kr` : 
                            '0 kr'}
                        </TableCell>
                        <TableCell align="right">
                          {company.tenderDeductions > 0 ? 
                            `${(company.tenderDeductions || 0).toLocaleString('no-NO')} kr` : 
                            '0 kr'}
                        </TableCell>
                        <TableCell align="right" sx={{ position: 'relative' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                            {(company.approvedCommission || 0)?.toLocaleString('nb-NO')} kr
                            {company.approvedCommission !== company.totalCommission && (
                              <Tooltip
                                title={
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold">Detaljer:</Typography>
                                    <Typography variant="body2">Beregnet provisjon: {(company.totalCommission || 0)?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">5% trekk: {(company.fivePercentDeductions || 0)?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Anbudstrekk: {(company.tenderDeductions || 0)?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Totalt trekk: {(company.deductions || 0)?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2">Bonus: {(company.bonus || 0)?.toLocaleString('nb-NO')} kr</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                      Total provisjon: {(company.approvedCommission || 0)?.toLocaleString('nb-NO')} kr
                                    </Typography>
                                  </Box>
                                }
                                arrow
                                placement="top"
                              >
                                <Info fontSize="small" color="action" />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: company.difference === 0 
                              ? 'text.primary' 
                              : company.difference > 0 
                                ? 'success.main' 
                                : 'error.main'
                          }}
                        >
                          {`${company.difference > 0 ? '+' : ''}${(company.difference || 0).toLocaleString('no-NO')} kr`}
                          <br />
                          <Typography variant="caption">
                            {`(${company.percentDiff > 0 ? '+' : ''}${(company.percentDiff || 0).toFixed(1)}%)`}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {company.approvalRate === 100 ? (
                            <Chip 
                              label="Fullstendig godkjent" 
                              color="success" 
                              size="small" 
                              icon={<CheckCircle />} 
                            />
                          ) : company.approvalRate > 0 ? (
                            <Chip 
                              label="Delvis godkjent" 
                              color="warning" 
                              size="small" 
                              icon={<Info />} 
                            />
                          ) : (
                            <Chip 
                              label="Ikke godkjent" 
                              color="default" 
                              size="small" 
                              icon={<Cancel />} 
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* Tab 3: Agents */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Agentoversikt for {selectedMonth ? formatMonth(selectedMonth) : 'valgt periode'}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                      <TableCell>Agent</TableCell>
                      <TableCell>Kontor</TableCell>
                      <TableCell>Lønnstrinn</TableCell>
                      <TableCell align="right">Liv-salg</TableCell>
                      <TableCell align="right">Skade-salg</TableCell>
                      <TableCell align="right">Totalt salg</TableCell>
                      <TableCell align="right">Beregnet provisjon</TableCell>
                      <TableCell align="right">5% trekk</TableCell>
                      <TableCell align="right">Anbudstrekk</TableCell>
                      <TableCell align="right">Godkjent provisjon</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="right">Handling</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedAgents.map((agent) => {
                      const tenderKey = `${agent.agent_name}-${selectedMonth}`;
                      const tenderInfo = tenderData[tenderKey] || { tjenestetorget: 0, bytt: 0, other: 0 };
                      const salaryModel = salaryModels.find(model => model.id === agent.salary_model_id);
                      
                      // Logg for debugging
                      console.log(`Agent ${agent.agent_name} applyFivePercent:`, {
                        name: agent.agent_name,
                        applyFivePercent: agent.applyFivePercent,
                        isApproved: agent.isApproved,
                        approvalInfo: agent.approvalInfo
                      });
                      
                      return (
                        <TableRow key={`${agent.agent_name}-${agent.monthKey}`} hover>
                          <TableCell>{agent.agent_name}</TableCell>
                          <TableCell>{agent.agent_company || 'Ukjent'}</TableCell>
                          <TableCell>
                            {salaryModel ? (
                              <Tooltip title={`Liv: ${salaryModel.commission_liv || 0}%, Skade: ${salaryModel.commission_skade || 0}%`}>
                                <Chip 
                                  label={salaryModel.name} 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                />
                              </Tooltip>
                            ) : (
                              <Tooltip title="Lønnstrinn 1 (standard)">
                                <Chip 
                                  label="Lønnstrinn 1" 
                                  size="small" 
                                  color="default"
                                  variant="outlined"
                                />
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(agent.livPremium || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(agent.skadePremium || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(agent.totalPremium || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(agent.commission || 0)}</TableCell>
                          <TableCell align="right">
                            {agent.applyFivePercent ? (
                              <Tooltip title="5% trekk er aktivt basert på ansettelsestid eller manuell innstilling">
                                <Box sx={{ color: theme.palette.warning.main }}>
                                  {formatCurrency(agent.commission * 0.05)}
                                </Box>
                              </Tooltip>
                            ) : (
                              <Box sx={{ color: theme.palette.text.secondary }}>
                                0 kr
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {agent.isApproved ? 
                              formatCurrency(
                                (parseFloat(agent.approvalInfo?.tjenestetorget || 0) || 0) + 
                                (parseFloat(agent.approvalInfo?.bytt || 0) || 0) + 
                                (parseFloat(agent.approvalInfo?.other_deductions || 0) || 0)
                              ) : 
                              formatCurrency(
                                (parseFloat(tenderInfo?.tjenestetorget || 0) || 0) + 
                                (parseFloat(tenderInfo?.bytt || 0) || 0) + 
                                (parseFloat(tenderInfo?.other || 0) || 0)
                              )
                            }
                          </TableCell>
                          <TableCell align="right">
                            {agent.isApproved ? 
                              formatCurrency(agent.approvalInfo?.approved_commission || agent.commission || 0) : 
                              formatCurrency(agent.finalCommission || 0)}
                          </TableCell>
                          <TableCell align="center">
                            {agent.isApproved ? (
                              <Chip 
                                icon={<CheckCircle />} 
                                label="Godkjent" 
                                color="success" 
                                size="small"
                              />
                            ) : (
                              <Chip 
                                icon={<Cancel />} 
                                label="Ikke godkjent" 
                                color="error" 
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                              <Button
                                variant={agent.isApproved ? "outlined" : "contained"}
                                color={agent.isApproved ? "error" : "primary"}
                                size="small"
                                onClick={() => agent.isApproved ? openRevokeDialog(agent) : openApprovalDialog(agent)}
                              >
                                {agent.isApproved ? 'Tilbakekall' : 'Godkjenn'}
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <Dialog open={approvalDialogOpen} onClose={closeDialogs} maxWidth="md" fullWidth>
        <DialogTitle>Endre godkjenning</DialogTitle>
        <DialogContent>
          {selectedAgent && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Agent: {selectedAgent.agent_name}
              </Typography>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Provisjonsbeløp</Typography>
                <TextField
                  fullWidth
                  label="Godkjent provisjon"
                  type="number"
                  value={selectedAgent.commission || ''}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    setSelectedAgent(prev => ({
                      ...prev,
                      commission: newValue
                    }));
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">kr</InputAdornment>,
                  }}
                />
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Lønnstrinn</Typography>
                <FormControl fullWidth>
                  <InputLabel>Velg lønnstrinn</InputLabel>
                  <Select
                    value={selectedAgent.salaryModelId || ''}
                    onChange={(e) => {
                      setSelectedAgent(prev => ({
                        ...prev,
                        salaryModelId: e.target.value
                      }));
                    }}
                    label="Velg lønnstrinn"
                  >
                    {salaryModels.map((model) => (
                      <MenuItem key={model.id} value={model.id}>
                        {model.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Kommentar</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Kommentar til endringen"
                  value={selectedAgent.approval_comment || ''}
                  onChange={(e) => {
                    setSelectedAgent(prev => ({
                      ...prev,
                      approval_comment: e.target.value
                    }));
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialogs}>Avbryt</Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleApproval}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={revokeDialogOpen} onClose={closeRevokeDialog}>
        <DialogTitle>Trekke tilbake godkjenning</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Er du sikker på at du vil trekke tilbake godkjenningen for {selectedAgent?.agent_name}?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Årsak til tilbakekalling"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRevokeDialog}>Avbryt</Button>
          <Button 
            onClick={handleRevokeApproval} 
            color="error"
            variant="contained"
            disabled={revokeLoading || !revokeReason.trim()}
          >
            {revokeLoading ? <CircularProgress size={24} /> : 'Trekke tilbake'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalesDataDashboard;