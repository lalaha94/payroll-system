import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';

export const useManagerData = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [managerData, setManagerData] = useState(null);
  const [officeAgents, setOfficeAgents] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [salaryModels, setSalaryModels] = useState([]);
  const [officePerformance, setOfficePerformance] = useState({});
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [showApproved, setShowApproved] = useState(false);
  const [monthlyApprovals, setMonthlyApprovals] = useState([]);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (selectedMonth && managerData) {
      processMonthlyData();
    }
  }, [selectedMonth]); // Fjern `salesData`, `officeAgents`, og `managerData` fra avhengighetslisten

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;

      if (!user) {
        setError("Ingen bruker er innlogget. Vennligst logg inn igjen.");
        setManagerData(null); // Explicitly set managerData to null
        return;
      }

      const userName = user.user_metadata?.name || user.email.split('@')[0];

      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .or(`name.eq."${userName}",email.eq."${user.email}"`)
        .single();

      if (employeeError && employeeError.code !== 'PGRST116') {
        throw employeeError;
      }

      if (employeeData) {
        setManagerData(employeeData);
        await fetchSalaryModels();
        await fetchOfficeAgents(employeeData.agent_company);
      } else {
        setError("Kunne ikke finne lederdata for denne brukeren. Kontakt administrator.");
        setManagerData(null); // Explicitly set managerData to null
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Feil ved henting av brukerdata: " + error.message);
      setManagerData(null); // Explicitly set managerData to null
    } finally {
      setLoading(false);
    }
  };
  
  const fetchOfficeAgents = async (officeCompany) => {
    try {
      if (!officeCompany) {
        setError("Ingen kontordata funnet for denne lederen");
        setLoading(false);
        return;
        }

        const { data, error } = await supabase
          .from('employees')
        .select('*')
        .eq('agent_company', officeCompany);
        
      if (error) throw error;
      
      console.log(`Fetched ${data?.length || 0} agents for office: ${officeCompany}`);
      setOfficeAgents(data || []);
      
      const agentNames = data.map(agent => agent.name);
      await fetchOfficeSalesData(agentNames);
      
    } catch (error) {
      console.error("Error fetching office agents:", error);
      setError("Feil ved henting av agenter: " + error.message);
    }
  };
  
  const fetchSalaryModels = async () => {
    try {
      console.log("Fetching salary models...");
      const { data, error } = await supabase
        .from('salary_models')
        .select('*');

        if (error) throw error;

      if (!data || data.length === 0) {
        console.error("No salary models found");
        setError("Ingen lønnstrinn funnet i systemet. Kontakt administrator.");
        return false;
      }
      
      console.log(`Fetched ${data.length} salary models`);
      setSalaryModels(data);
      return true;
    } catch (error) {
      console.error("Error fetching salary models:", error);
      setError("Feil ved henting av lønnstrinn: " + error.message);
      return false;
    }
  };
  
  const fetchOfficeSalesData = async (agentNames) => {
    try {
      if (!agentNames || agentNames.length === 0) {
        setError("Ingen agenter funnet for dette kontoret");
        setLoading(false);
        return;
      }
    
      if (salaryModels.length === 0) {
        await fetchSalaryModels();
      }

      const { data, error } = await supabase
        .from('sales_data')
        .select('*')
        .in('agent_name', agentNames);
        
      if (error) throw error;
      
      setSalesData(data || []);
      
      const months = new Set();
      data.forEach(sale => {
        if (sale.policy_sale_date) {
          const date = new Date(sale.policy_sale_date);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
          }
        }
      });
      
      const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
      setMonthOptions(sortedMonths);
      
      if (sortedMonths.length > 0) {
        setSelectedMonth(sortedMonths[0]);
      }
      
    } catch (error) {
      console.error("Error fetching office sales data:", error);
      setError("Feil ved henting av salgsdata: " + error.message);
    }
  };

  const processMonthlyData = useCallback(() => {
    if (!salesData || !selectedMonth) return;

    if (salaryModels.length === 0) {
      console.error("No salary models available for processing");
      setError("Kunne ikke beregne provisjon: Ingen lønnstrinn tilgjengelig");
      return;
    }

    const normalizedMonth = selectedMonth.includes("/")
      ? selectedMonth.replace("/", "-")
      : selectedMonth;

    const monthlySalesData = salesData.filter(sale => {
      if (!sale.policy_sale_date) return false;
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return false;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sale.cancel_code) return false;
      return monthKey === normalizedMonth;
    });

    // Opprett en map over alle agenter, inkludert de uten salg
    const agentSales = {};
    officeAgents.forEach(agent => {
      agentSales[agent.name] = {
        id: agent.id,
        agentId: agent.agent_id,
        name: agent.name,
        salaryModelId: agent.salary_model_id,
        salaryModelName: getSalaryModelName(agent.salary_model_id),
        livPremium: 0,
        skadePremium: 0,
        livCount: 0,
        skadeCount: 0,
        totalCount: 0,
        totalPremium: 0,
        commission: 0,
        ranking: 0,
        isApproved: false,
        approvalRecord: null
      };
    });

    // Oppdater salgsdata for agenter med salg
    monthlySalesData.forEach(sale => {
      const agentName = sale.agent_name;
      if (!agentSales[agentName]) return;
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      if (provisjonsgruppe.includes("life")) {
        agentSales[agentName].livPremium += netPremium;
        agentSales[agentName].livCount++;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        agentSales[agentName].skadePremium += netPremium;
        agentSales[agentName].skadeCount++;
      }
      agentSales[agentName].totalCount++;
      agentSales[agentName].totalPremium += netPremium;
    });

    let totalCommission = 0;

    // Beregn provisjon for hver agent
    Object.values(agentSales).forEach(agent => {
      if (!agent.salaryModelId) {
        console.warn(`No salary model found for agent ${agent.name} with modelId ${agent.salaryModelId}`);
        return;
      }

      const salaryModel = salaryModels.find(model => parseInt(model.id) === parseInt(agent.salaryModelId));
      if (!salaryModel) {
        console.warn(`No salary model found for agent ${agent.name} with modelId ${agent.salaryModelId}`);
        return;
      }

      // Hent satser fra modellen
      const livRate = parseFloat(salaryModel.commission_liv) || 0;
      const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
      
      // Beregn grunnprovisjon
      let livCommission = agent.livPremium * (livRate / 100);
      let skadeCommission = agent.skadePremium * (skadeRate / 100);
      
      // Håndter bonusberegning
      let bonusAmount = 0;
      const bonusThreshold = parseFloat(salaryModel.bonus_threshold);
      const totalPremium = agent.livPremium + agent.skadePremium;
      
      if (!isNaN(bonusThreshold) && bonusThreshold > 0 && 
          totalPremium >= bonusThreshold && salaryModel.bonus_enabled) {
        
        const bonusPercentageLiv = parseFloat(salaryModel.bonus_percentage_liv) || 0;
        const bonusPercentageSkade = parseFloat(salaryModel.bonus_percentage_skade) || 0;
        
        livCommission += agent.livPremium * (bonusPercentageLiv / 100);
        skadeCommission += agent.skadePremium * (bonusPercentageSkade / 100);
      }

      const totalAgentCommission = livCommission + skadeCommission;
      agent.commission = totalAgentCommission;
      totalCommission += totalAgentCommission;
    });

    setOfficePerformance({
      livPremium: Object.values(agentSales).reduce((sum, a) => sum + a.livPremium, 0),
      skadePremium: Object.values(agentSales).reduce((sum, a) => sum + a.skadePremium, 0),
      totalPremium: Object.values(agentSales).reduce((sum, a) => sum + a.totalPremium, 0),
      livCount: Object.values(agentSales).reduce((sum, a) => sum + a.livCount, 0),
      skadeCount: Object.values(agentSales).reduce((sum, a) => sum + a.skadeCount, 0),
      totalCount: Object.values(agentSales).reduce((sum, a) => sum + a.totalCount, 0),
      totalCommission: totalCommission,
      agentCount: Object.values(agentSales).filter(agent => agent.totalCount > 0).length,
      activeAgentCount: officeAgents.length
    });

    const sortedAgents = Object.values(agentSales)
      .sort((a, b) => b.totalPremium - a.totalPremium);
    sortedAgents.forEach((agent, index) => {
      agent.ranking = index + 1;
    });

    setAgentPerformance(sortedAgents);
  }, [salesData, selectedMonth, salaryModels, officeAgents]);

  const getSalaryModelName = (modelId) => {
    if (!modelId) return 'Ukjent lønnstrinn';
    
    const model = salaryModels.find(m => parseInt(m.id) === parseInt(modelId));
    if (model) return model.name;
    
    const modelByString = salaryModels.find(m => String(m.id) === String(modelId));
    if (modelByString) return modelByString.name;
    
    return 'Ukjent lønnstrinn';
  };

  const syncAgentsWithApprovals = useCallback((agents, approvals, targetAgentName = null) => {
    if (!agents || !approvals || !Array.isArray(agents) || !Array.isArray(approvals)) {
      return agents;
    }

    // Opprett et map over gyldige godkjenninger
    const approvalMap = approvals.reduce((acc, approval) => {
      if (approval.approved === true && approval.revoked !== true) {
        acc[approval.agent_name] = approval;
      }
      return acc;
    }, {});

    // Oppdater agentene med godkjenningsstatus
    return agents.map(agent => {
      if (targetAgentName && agent.name !== targetAgentName) return agent;
      
      const approval = approvalMap[agent.name];
      if (approval) {
        return { 
          ...agent, 
          isApproved: true, 
          approvalRecord: approval,
          approvalStatus: 'approved'
        };
      }
      
      return { 
        ...agent, 
        isApproved: false, 
        approvalRecord: null,
        approvalStatus: 'pending'
      };
    });
  }, []);

  useEffect(() => {
    if (agentPerformance && monthlyApprovals) {
      console.log("Synkroniserer agenter med godkjenninger...");
      const updatedAgents = syncAgentsWithApprovals(agentPerformance, monthlyApprovals);
      console.log("Oppdaterte agenter:", updatedAgents);
      setAgentPerformance(updatedAgents);
    }
  }, [monthlyApprovals, agentPerformance, syncAgentsWithApprovals]);

  useEffect(() => {
    const fetchApprovals = async () => {
      if (!selectedMonth) return;
      
      try {
        const { data: approvals, error } = await supabase
          .from('monthly_commission_approvals')
          .select('*')
          .eq('month_year', selectedMonth);
        
        if (error) throw error;
        
        console.log(`Hentet ${approvals.length} godkjenninger for måned ${selectedMonth}`);
        setMonthlyApprovals(approvals || []);
      } catch (error) {
        console.error("Feil ved henting av godkjenninger:", error);
      }
    };

    fetchApprovals();
  }, [selectedMonth]);

  return useMemo(() => ({
    loading,
    error,
    managerData,
    officeAgents,
    salesData,
    monthOptions,
    selectedMonth,
    setSelectedMonth,
    salaryModels,
    officePerformance,
    agentPerformance,
    setAgentPerformance,
    processMonthlyData,
    showApproved,
    setShowApproved,
    syncAgentsWithApprovals
  }), [
    loading,
    error,
    managerData,
    officeAgents,
    salesData,
    monthOptions,
    selectedMonth,
    salaryModels,
    officePerformance,
    agentPerformance,
    showApproved,
    syncAgentsWithApprovals
  ]);
};