import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { differenceInMonths } from 'date-fns';

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

  const previousAgentPerformanceRef = useRef(agentPerformance);

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
        setManagerData(null);
        return;
      }

      const userName = user.user_metadata?.name || user.email.split('@')[0];
      console.log("Henter brukerdata for:", userName);

      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .or(`name.eq."${userName}",email.eq."${user.email}"`)
        .single();

      if (employeeError && employeeError.code !== 'PGRST116') {
        throw employeeError;
      }

      if (employeeData) {
        console.log("Funnet ansattdata:", {
          name: employeeData.name,
          office: employeeData.agent_company,
          role: employeeData.role
        });
        
        const managerInfo = {
          ...employeeData,
          office: employeeData.agent_company // Sikre at office er satt
        };
        
        setManagerData(managerInfo);
        await fetchSalaryModels();
        await checkAndUpdateFivePercentStatus();
        await fetchOfficeAgents(managerInfo.office);
      } else {
        console.error("Ingen ansattdata funnet for bruker:", userName);
        setError("Kunne ikke finne lederdata for denne brukeren. Kontakt administrator.");
        setManagerData(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Feil ved henting av brukerdata: " + error.message);
      setManagerData(null);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchOfficeAgents = async (officeCompany) => {
    try {
      if (!officeCompany) {
        console.error("Mangler kontordata for å hente agenter");
        setError("Ingen kontordata funnet for denne lederen");
        setLoading(false);
        return;
      }

      console.log("Henter agenter for kontor:", officeCompany);

      // Først hent ansatte
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('agent_company', officeCompany)
        .eq('position', 'Rådgiver');
        
      if (employeesError) {
        console.error("Feil ved henting av ansatte:", employeesError);
        throw employeesError;
      }
      
      if (!employees || employees.length === 0) {
        console.log("Ingen agenter funnet for kontor:", officeCompany);
        setOfficeAgents([]);
        return;
      }

      console.log(`Hentet ${employees.length} agenter for kontor: ${officeCompany}`);

      // Deretter hent godkjenninger for disse agentene
      const { data: approvals, error: approvalsError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .in('agent_name', employees.map(e => e.name))
        .eq('month_year', selectedMonth)
        .eq('agent_company', officeCompany)
        .eq('revoked', false);

      if (approvalsError) {
        console.error("Feil ved henting av godkjenninger:", approvalsError);
      }

      // Kombiner ansatte med deres godkjenninger
      const agentsWithApprovals = employees.map(employee => {
        const approval = approvals?.find(a => 
          a.agent_name === employee.name && 
          a.month_year === selectedMonth
        );
        
        console.log(`Behandler agent ${employee.name}:`, {
          harGodkjenning: !!approval,
          godkjenningsStatus: approval ? {
            manager_approved: approval.manager_approved,
            admin_approved: approval.admin_approved,
            status: approval.admin_approved ? 'approved' : 
                   (approval.manager_approved ? 'pending_admin' : 'pending')
          } : 'ingen'
        });

        return {
          ...employee,
          approval: approval || null,
          manager_approved: approval?.manager_approved || false,
          admin_approved: approval?.admin_approved || false,
          approvalStatus: approval ? 
            (approval.manager_approved ? 'approved' : 'pending') : 'pending',
          isApproved: approval?.admin_approved || false,
          agent_company: officeCompany
        };
      });
      
      console.log(`Behandlet ${agentsWithApprovals.length} agenter med godkjenninger`);
      setOfficeAgents(agentsWithApprovals);
      
      const agentNames = employees.map(agent => agent.name);
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

  const processMonthlyData = useCallback(async () => {
    try {
      if (!selectedMonth || !managerData?.office) {
        console.log("Mangler nødvendig data for prosessering:", {
          selectedMonth,
          managerData: managerData ? {
            office: managerData.office,
            name: managerData.name
          } : null
        });
        return;
      }

      console.log("Prosesserer månedsdata for", selectedMonth, "kontor:", managerData.office);
      
      // Hent oppdaterte godkjenninger
      const { data: approvals, error: approvalsError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('month_year', selectedMonth)
        .eq('agent_company', managerData.office)
        .eq('revoked', false);

      if (approvalsError) {
        console.error("Feil ved henting av godkjenninger:", approvalsError);
      } else {
        console.log(`Hentet ${approvals?.length || 0} godkjenninger for måned ${selectedMonth}`);
        setMonthlyApprovals(approvals || []);
      }

      // Hent oppdatert informasjon om ansettelsesdato og 5% trekk
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, hire_date, apply_five_percent_deduction')
        .eq('agent_company', managerData.office);
        
      if (employeesError) {
        console.error("Feil ved henting av ansettelsesdata:", employeesError);
      }
      
      // Opprett en map for rask oppslag av ansettelsesdata
      const employeesMap = {};
      if (employeesData) {
        employeesData.forEach(emp => {
          employeesMap[emp.name] = {
            hire_date: emp.hire_date,
            apply_five_percent_deduction: emp.apply_five_percent_deduction
          };
        });
      }

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

      // Opprett en map over alle agenter
      const agentSales = {};
      officeAgents.forEach(agent => {
        const defaultSalaryModelId = '1';
        const actualSalaryModelId = agent.salary_model_id || defaultSalaryModelId;
        
        // Finn godkjenningsinformasjon for agenten
        const approvalInfo = approvals?.find(
          a => a.agent_name === agent.name && 
              a.month_year === normalizedMonth &&
              !a.revoked
        );

        // Hent anbudsdata
        const tenderValues = {
          tjenestetorgetDeduction: parseFloat(agent.tjenestetorget_deduction) || 0,
          byttDeduction: parseFloat(agent.bytt_deduction) || 0,
          otherDeductions: parseFloat(agent.other_deductions) || 0
        };
        
        // Hent ansettelsesdata og 5% trekk-status fra databasen
        const employeeInfo = employeesMap[agent.name] || {};
        const hireDate = employeeInfo.hire_date ? new Date(employeeInfo.hire_date) : null;
        
        // Beregn antall måneder ansatt hvis hire_date finnes
        let monthsEmployed = null;
        if (hireDate) {
          monthsEmployed = differenceInMonths(new Date(), hireDate);
        }
        
        // Bestem om 5% trekk skal anvendes basert på ansettelsestid og/eller innstilling i database
        // Prioriter den eksplisitte innstillingen i database
        const applyFivePercent = employeeInfo.apply_five_percent_deduction !== undefined ? 
          employeeInfo.apply_five_percent_deduction : 
          (monthsEmployed !== null ? monthsEmployed < 9 : false);
        
        console.log(`Agent ${agent.name} 5% trekk status:`, {
          hireDate: hireDate ? hireDate.toISOString().split('T')[0] : null,
          monthsEmployed,
          applyFivePercent,
          manualSetting: employeeInfo.apply_five_percent_deduction
        });
        
        agentSales[agent.name] = {
          id: agent.id,
          agentId: agent.agent_id,
          name: agent.name,
          salaryModelId: actualSalaryModelId,
          salaryModelName: getSalaryModelName(actualSalaryModelId),
          livPremium: 0,
          skadePremium: 0,
          livCount: 0,
          skadeCount: 0,
          totalCount: 0,
          totalPremium: 0,
          commission: 0,
          ranking: 0,
          isApproved: approvalInfo?.admin_approved || false,
          manager_approved: approvalInfo?.manager_approved || false,
          admin_approved: approvalInfo?.admin_approved || false,
          approvalStatus: approvalInfo ? 
            (approvalInfo.manager_approved ? 'approved' : 'pending') : 'pending',
          approvalRecord: approvalInfo || null,
          tjenestetorgetDeduction: parseFloat(approvalInfo?.tjenestetorget) || tenderValues.tjenestetorgetDeduction,
          byttDeduction: parseFloat(approvalInfo?.bytt) || tenderValues.byttDeduction,
          otherDeductions: parseFloat(approvalInfo?.other_deductions) || tenderValues.otherDeductions,
          company: agent.agent_company,
          // Legg til ansettelsesdata
          hireDate: hireDate ? hireDate.toISOString().split('T')[0] : null,
          monthsEmployed,
          applyFivePercent
        };
      });

      // Oppdater salgsdata for agenter med salg
      monthlySalesData.forEach(sale => {
        const agentName = sale.agent_name;
        if (!agentSales[agentName]) return;
        
        const netPremium = parseFloat(sale.net_premium_sales) || 0;
        const provisjonsgruppe = (sale.provisjonsgruppe || "").toLowerCase();
        
        console.log(`Prosesserer salg for ${agentName}:`, {
          netPremium,
          provisjonsgruppe,
          policy_sale_date: sale.policy_sale_date
        });

        // Kategoriser salget basert på provisjonsgruppe
        if (provisjonsgruppe.includes("liv") || 
            provisjonsgruppe.includes("life") || 
            provisjonsgruppe.includes("pension")) {
          agentSales[agentName].livPremium += netPremium;
          agentSales[agentName].livCount++;
          console.log(`Lagt til som livprodukt: ${netPremium} kr`);
        } 
        else if (provisjonsgruppe.includes("skade") || 
                 provisjonsgruppe.includes("pc") || 
                 provisjonsgruppe.includes("child") || 
                 provisjonsgruppe.includes("damage")) {
          agentSales[agentName].skadePremium += netPremium;
          agentSales[agentName].skadeCount++;
          console.log(`Lagt til som skadeprodukt: ${netPremium} kr`);
        }
        else {
          console.warn(`Ukjent provisjonsgruppe for salg:`, {
            agentName,
            provisjonsgruppe,
            netPremium
          });
        }
        
        agentSales[agentName].totalCount++;
        agentSales[agentName].totalPremium += netPremium;
      });

      console.log("Ferdig med å prosessere salgsdata");

      let totalCommission = 0;

      // Beregn provisjon for hver agent
      Object.values(agentSales).forEach(agent => {
        // Sett lønnstrinn 1 som standard hvis det mangler
        const defaultSalaryModelId = '1';
        const actualSalaryModelId = agent.salaryModelId || defaultSalaryModelId;
        
        const salaryModel = salaryModels.find(model => parseInt(model.id) === parseInt(actualSalaryModelId));
        if (!salaryModel) {
          console.warn(`Fant ikke lønnstrinn for ${agent.name}. Bruker lønnstrinn 1 som standard.`);
          return;
        }

        // Hent satser fra modellen
        const livRate = parseFloat(salaryModel.commission_liv) || 0;
        const skadeRate = parseFloat(salaryModel.commission_skade) || 0;
        
        console.log(`Beregner provisjon for ${agent.name} med satser:`, {
          livRate,
          skadeRate,
          livPremium: agent.livPremium,
          skadePremium: agent.skadePremium
        });

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
          
          const livBonus = agent.livPremium * (bonusPercentageLiv / 100);
          const skadeBonus = agent.skadePremium * (bonusPercentageSkade / 100);
          bonusAmount = livBonus + skadeBonus;

          console.log(`Bonus beregnet for ${agent.name}:`, {
            bonusThreshold,
            totalPremium,
            livBonus,
            skadeBonus,
            totalBonus: bonusAmount
          });
        }

        // Beregn total provisjon før trekk
        const baseCommission = livCommission + skadeCommission;
        // totalBeforeTrekk er provisjon før bonus (kun baseCommission)
        const totalBeforeTrekk = baseCommission;
        // totalWithBonus inkluderer både baseCommission og bonus
        const totalWithBonus = baseCommission + bonusAmount;

        // Hent trekk fra agent eller approval
        const tjenestetorgetTrekk = parseFloat(agent.tjenestetorgetDeduction) || 0;
        const byttTrekk = parseFloat(agent.byttDeduction) || 0;
        const andreTrekk = parseFloat(agent.otherDeductions) || 0;

        // Sjekk om agenten skal ha 5% trekk (bruker agent.applyFivePercent som er satt i UI eller under synkronisering)
        const applyFivePercent = agent.applyFivePercent !== undefined ? agent.applyFivePercent : false;
        
        // 5% trekk beregnes KUN på salgsprovisjon, ikke bonus
        const fivePercentTrekk = applyFivePercent ? baseCommission * 0.05 : 0;

        // Beregn total provisjon etter trekk
        const totalAgentCommission = totalWithBonus - fivePercentTrekk - tjenestetorgetTrekk - byttTrekk - andreTrekk;

        // Oppdater agent objekt med alle verdier
        agent.livCommission = livCommission;
        agent.skadeCommission = skadeCommission;
        agent.bonusAmount = bonusAmount;
        agent.baseCommission = baseCommission;
        agent.totalBeforeTrekk = totalBeforeTrekk;
        agent.totalWithBonus = totalWithBonus;
        agent.fivePercentTrekk = fivePercentTrekk;
        agent.tjenestetorgetTrekk = tjenestetorgetTrekk;
        agent.byttTrekk = byttTrekk;
        agent.andreTrekk = andreTrekk;
        agent.commission = totalAgentCommission;
        agent.originalCommission = totalAgentCommission; // Lagre original provisjon

        console.log(`Provisjonsberegning for ${agent.name}:`, {
          livPremium: agent.livPremium,
          skadePremium: agent.skadePremium,
          livCommission,
          skadeCommission,
          bonusAmount,
          baseCommission,
          totalBeforeTrekk,
          applyFivePercent,
          fivePercentTrekk,
          tjenestetorgetTrekk,
          byttTrekk,
          andreTrekk,
          totalAgentCommission,
          originalCommission: totalAgentCommission
        });

        totalCommission += totalAgentCommission;
      });

      // Oppdater officePerformance med total provisjon
      setOfficePerformance({
        livPremium: Object.values(agentSales).reduce((sum, a) => sum + a.livPremium, 0),
        skadePremium: Object.values(agentSales).reduce((sum, a) => sum + a.skadePremium, 0),
        totalPremium: Object.values(agentSales).reduce((sum, a) => sum + a.totalPremium, 0),
        livCount: Object.values(agentSales).reduce((sum, a) => sum + a.livCount, 0),
        skadeCount: Object.values(agentSales).reduce((sum, a) => sum + a.skadeCount, 0),
        totalCount: Object.values(agentSales).reduce((sum, a) => sum + a.totalCount, 0),
        totalCommission,
        originalCommission: totalCommission, // Lagre original provisjon for kontoret
        agentCount: Object.values(agentSales).filter(agent => agent.totalCount > 0).length,
        activeAgentCount: officeAgents.length
      });

      const sortedAgents = Object.values(agentSales)
        .sort((a, b) => b.totalPremium - a.totalPremium);
      sortedAgents.forEach((agent, index) => {
        agent.ranking = index + 1;
      });

      setAgentPerformance(sortedAgents);
    } catch (error) {
      console.error("Error processing monthly data:", error);
      setError("Feil ved behandling av månedsdata: " + error.message);
    }
  }, [selectedMonth, salesData, salaryModels, officeAgents, managerData]);

  const getSalaryModelName = (modelId) => {
    if (!modelId) return 'Ukjent lønnstrinn';
    
    const model = salaryModels.find(m => parseInt(m.id) === parseInt(modelId));
    if (model) return model.name;
    
    const modelByString = salaryModels.find(m => String(m.id) === String(modelId));
    if (modelByString) return modelByString.name;
    
    return 'Ukjent lønnstrinn';
  };

  const syncAgentsWithApprovals = useCallback((agents, approvals) => {
    if (!agents || !approvals || !Array.isArray(agents) || !Array.isArray(approvals)) {
      console.log("Mangler data for synkronisering:", { agents: !!agents, approvals: !!approvals });
      return agents;
    }

    console.log("Synkroniserer", agents.length, "agenter med", approvals.length, "godkjenninger");

    // Opprett et map over gyldige godkjenninger
    const approvalMap = approvals.reduce((acc, approval) => {
      if (!approval.revoked) {
        const key = `${approval.agent_name}_${approval.month_year}`;
        if (!acc[key] || new Date(approval.approved_at) > new Date(acc[key].approved_at)) {
          acc[key] = approval;
        }
      }
      return acc;
    }, {});

    console.log("Godkjenningskart opprettet med", Object.keys(approvalMap).length, "godkjenninger");

    // Oppdater agentene med godkjenningsstatus
    const updatedAgents = agents.map(agent => {
      const approvalKey = `${agent.name}_${selectedMonth}`;
      const approval = approvalMap[approvalKey];
      
      if (approval) {
        console.log(`Oppdaterer status for ${agent.name}:`, {
          approved: approval.approved,
          manager_approved: approval.manager_approved,
          admin_approved: approval.admin_approved,
          approval_status: approval.approval_status
        });

        return {
          ...agent,
          isApproved: approval.approved === true,
          approvalRecord: approval,
          approvalStatus: approval.manager_approved === true ? 'approved' : 'pending',
          company: approval.agent_company || agent.company,
          manager_approved: approval.manager_approved || false,
          admin_approved: approval.admin_approved || false,
          approved_commission: approval.approved_commission,
          approval_comment: approval.approval_comment,
          tjenestetorgetDeduction: parseFloat(approval.tjenestetorget) || agent.tjenestetorgetDeduction || 0,
          byttDeduction: parseFloat(approval.bytt) || agent.byttDeduction || 0,
          otherDeductions: parseFloat(approval.other_deductions) || agent.otherDeductions || 0
        };
      }
      
      return { 
        ...agent, 
        isApproved: false, 
        approvalRecord: null,
        approvalStatus: 'pending',
        manager_approved: false,
        admin_approved: false
      };
    });

    console.log("Synkronisering fullført. Oppdaterte agenter:", updatedAgents.length);
    return updatedAgents;
  }, [selectedMonth]);

  // Legg til en ny useEffect for å håndtere oppdateringer av godkjenninger
  useEffect(() => {
    // Sikre at både agentPerformance og monthlyApprovals er definerte arrays før vi fortsetter
    if (agentPerformance?.length > 0 && monthlyApprovals?.length > 0) {
      console.log("Starter automatisk synkronisering av godkjenninger");
      const updatedAgents = syncAgentsWithApprovals(agentPerformance, monthlyApprovals);
      
      // Forsøk å oppdage endringer i godkjenningsstatus
      const hasStatusChanges = updatedAgents.some((agent, index) => {
        const oldAgent = agentPerformance[index];
        return agent.isApproved !== oldAgent.isApproved || 
               agent.approvalStatus !== oldAgent.approvalStatus ||
               agent.approved_commission !== oldAgent.approved_commission;
      });
      
      if (hasStatusChanges || JSON.stringify(updatedAgents) !== JSON.stringify(agentPerformance)) {
        console.log("Oppdaterer agentPerformance med nye godkjenningsstatuser");
        setAgentPerformance(updatedAgents);
      }
    }
  }, [monthlyApprovals, syncAgentsWithApprovals, agentPerformance]);

  // Funksjon for å sjekke og oppdatere 5% trekk basert på ansettelsesdato
  const checkAndUpdateFivePercentStatus = async () => {
    try {
      console.log("Sjekker og oppdaterer 5% trekk-status basert på ansettelsesdato");
      
      // Hent alle ansatte med ansettelsesdato
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name, hire_date, apply_five_percent_deduction')
        .not('hire_date', 'is', null);
      
      if (error) {
        console.error("Feil ved henting av ansatte:", error);
        return;
      }
      
      if (!employees || employees.length === 0) {
        console.log("Ingen ansatte med ansettelsesdato funnet");
        return;
      }
      
      console.log(`Sjekker 5% trekk for ${employees.length} ansatte`);
      
      // Logg ansettelsesdatoer og gjeldende status for debugging
      employees.forEach(emp => {
        const hireDate = new Date(emp.hire_date);
        const today = new Date();
        const monthsEmployed = differenceInMonths(today, hireDate);
        
        console.log(`${emp.name}: Ansatt ${monthsEmployed} måneder, 5% trekk er ${emp.apply_five_percent_deduction ? 'PÅ' : 'AV'}`);
      });
      
      const updates = [];
      
      // Beregn status og opprett oppdateringer for hver ansatt
      for (const employee of employees) {
        if (!employee.hire_date) continue;
        
        const hireDate = new Date(employee.hire_date);
        const today = new Date();
        const monthsEmployed = differenceInMonths(today, hireDate);
        
        // Bestem riktig status for 5% trekk
        const shouldApplyFivePercent = monthsEmployed < 9;
        
        // Hvis gjeldende status ikke stemmer med beregnet status, legg til i oppdateringslisten
        if (employee.apply_five_percent_deduction !== shouldApplyFivePercent) {
          console.log(`Oppdaterer ${employee.name}: Fra ${employee.apply_five_percent_deduction ? 'PÅ' : 'AV'} til ${shouldApplyFivePercent ? 'PÅ' : 'AV'}`);
          
          // Oppdater i databasen
          const { error: updateError } = await supabase
            .from('employees')
            .update({ apply_five_percent_deduction: shouldApplyFivePercent })
            .eq('id', employee.id);
          
          if (updateError) {
            console.error(`Feil ved oppdatering av ${employee.name}:`, updateError);
            continue;
          }
          
          updates.push({
            name: employee.name,
            monthsEmployed,
            oldStatus: employee.apply_five_percent_deduction,
            newStatus: shouldApplyFivePercent
          });
        }
      }
      
      if (updates.length > 0) {
        console.log(`Oppdaterte 5% trekk-status for ${updates.length} ansatte:`, updates);
      } else {
        console.log("Ingen oppdateringer nødvendig for 5% trekk");
      }
      
      return updates;
    } catch (error) {
      console.error("Feil ved sjekk av 5% trekk-status:", error);
    }
  };

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