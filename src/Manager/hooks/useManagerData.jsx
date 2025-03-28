import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchCurrentUser();
  }, []);
  
  useEffect(() => {
    if (selectedMonth && managerData) {
      if (salaryModels.length > 0) {
        processMonthlyData();
      } else {
        console.log("Waiting for salary models to load before processing data");
        fetchSalaryModels().then(() => {
          processMonthlyData();
        });
      }
    }
  }, [selectedMonth, salesData, officeAgents, managerData]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const user = session.data?.session?.user;
      
      if (!user) {
        setError("Ingen bruker er innlogget. Vennligst logg inn igjen.");
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
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Feil ved henting av brukerdata: " + error.message);
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

  const processMonthlyData = () => {
    if (!salesData || salesData.length === 0) return;
    
    if (salaryModels.length === 0) {
      console.error("No salary models available for processing");
      setError("Kunne ikke beregne provisjon: Ingen lønnstrinn tilgjengelig");
      return;
    }
    
    const monthlySalesData = salesData.filter(sale => {
      if (!sale.policy_sale_date) return false;
      
      const date = new Date(sale.policy_sale_date);
      if (isNaN(date.getTime())) return false;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (sale.cancel_code) return false;
      
      return monthKey === selectedMonth;
    });
    
    let totalLivPremium = 0;
    let totalSkadePremium = 0;
    let totalLivCount = 0;
    let totalSkadeCount = 0;
    let totalCommission = 0;
    
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
        ranking: 0
      };
    });
    
    monthlySalesData.forEach(sale => {
      const agentName = sale.agent_name;
      if (!agentSales[agentName]) return;
      
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      
      const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
      if (provisjonsgruppe.includes("life")) {
        agentSales[agentName].livPremium += netPremium;
        agentSales[agentName].livCount++;
        totalLivPremium += netPremium;
        totalLivCount++;
      } else if (provisjonsgruppe.includes("pc") || provisjonsgruppe.includes("child") || provisjonsgruppe.includes("skad")) {
        agentSales[agentName].skadePremium += netPremium;
        agentSales[agentName].skadeCount++;
        totalSkadePremium += netPremium;
        totalSkadeCount++;
      }
      
      agentSales[agentName].totalCount++;
      agentSales[agentName].totalPremium += netPremium;
    });
    
    console.log("Available salary models:", salaryModels);

    Object.values(agentSales).forEach(agent => {
      console.log(`Processing agent: ${agent.name}, modelId: ${agent.salaryModelId}`);

      let salaryModel = salaryModels.find(model => parseInt(model.id) === parseInt(agent.salaryModelId));
      
      if (!salaryModel) {
        console.warn(`No salary model found for agent ${agent.name} with modelId ${agent.salaryModelId}`);
        
        salaryModel = salaryModels[0];
        console.log(`Using fallback salary model: ${salaryModel.name} (id: ${salaryModel.id})`);
      } else {
        console.log(`Found salary model: ${salaryModel.name} (id: ${salaryModel.id})`);
      }
      
      agent.salaryModelName = salaryModel.name;
      
      const livRate = parseFloat(salaryModel.commission_liv) || 0;
      const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
      
      let livCommission = agent.livPremium * livRate / 100;
      let skadeCommission = agent.skadePremium * skadeRate / 100;
      
      if (salaryModel.bonus_enabled &&
          salaryModel.bonus_threshold &&
          (agent.livPremium + agent.skadePremium) >= parseFloat(salaryModel.bonus_threshold)) {
        
        const bonusLivRate = parseFloat(salaryModel.bonus_percentage_liv) || 0;
        const bonusSkadeRate = parseFloat(salaryModel.bonus_percentage_skade) || 0;
        
        livCommission += agent.livPremium * bonusLivRate / 100;
        skadeCommission += agent.skadePremium * bonusSkadeRate / 100;
      }
      
      const totalAgentCommission = livCommission + skadeCommission;
      agent.commission = totalAgentCommission;
      totalCommission += totalAgentCommission;
      
      console.log(`Calculated commission for ${agent.name}: ${totalAgentCommission} (Liv: ${livCommission}, Skade: ${skadeCommission})`);
    });
    
    setOfficePerformance({
      livPremium: totalLivPremium,
      skadePremium: totalSkadePremium,
      totalPremium: totalLivPremium + totalSkadePremium,
      livCount: totalLivCount,
      skadeCount: totalSkadeCount,
      totalCount: totalLivCount + totalSkadeCount,
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
  };
  
  const getSalaryModelName = (modelId) => {
    if (!modelId) return 'Ukjent lønnstrinn';
    
    const model = salaryModels.find(m => parseInt(m.id) === parseInt(modelId));
    if (model) return model.name;
    
    const modelByString = salaryModels.find(m => String(m.id) === String(modelId));
    if (modelByString) return modelByString.name;
    
    return 'Ukjent lønnstrinn';
  };

  return {
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
    setShowApproved
  };
};