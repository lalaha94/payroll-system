import { supabase } from "../../supabaseClient";

/**
 * Henter lønnstrinn fra Supabase.
 */
export async function fetchSalaryModels() {
  const { data, error } = await supabase.from("salary_models").select("*");
  if (error) {
    console.error("Feil ved henting av lønnstrinn:", error);
    return [];
  }
  return data;
}

/**
 * Beregner provisjonen basert på provisjonsgrunnlag, lønnstrinn og forsikringstype.
 * Tar hensyn til bonusprovisjon hvis totalt salg er over terskelverdi.
 */
export function calculateCommission(data, salaryModels) {
  // Find the correct salary model with better error handling
  const model = salaryModels.find(m => parseInt(m.id) === parseInt(data.salary_level));
  
  // Debug logging
  console.log("Commission calculation:", {
    agent: data.agent_name,
    agentId: data.agent_id,
    monthKey: data.monthKey,
    modelId: data.salary_level,
    foundModel: model ? `${model.name} (id: ${model.id})` : "Not found",
    livPremium: data.livPremium,
    skadePremium: data.skadePremium,
    availableModels: salaryModels.map(m => `${m.name} (id: ${m.id})`)
  });
  
  // Use the found model or fallback to the first model
  const activeModel = model || salaryModels[0] || {
    commission_liv: 0,
    commission_skade: 0,
    bonus_enabled: false
  };
  
  let livRate = parseFloat(activeModel.commission_liv) || 0;
  let skadeRate = parseFloat(activeModel.commission_skade) || 0;
  
  // Calculate base commissions
  let livCommission = data.livPremium * livRate / 100;
  let skadeCommission = data.skadePremium * skadeRate / 100;
  
  // Calculate total premium for bonus threshold check
  const totalPremium = data.livPremium + data.skadePremium;
  
  // Additional logging for commission rates
  console.log("Commission rates:", {
    livRate: livRate,
    skadeRate: skadeRate,
    livPremium: data.livPremium,
    skadePremium: data.skadePremium,
    baseLivCommission: livCommission,
    baseSkadeCommission: skadeCommission
  });
  
  // Check if bonus is applicable
  if (activeModel.bonus_enabled && 
      activeModel.bonus_threshold && 
      totalPremium >= parseFloat(activeModel.bonus_threshold)) {
    
    // Add bonus commission
    const bonusLivRate = parseFloat(activeModel.bonus_percentage_liv) || 0;
    const bonusSkadeRate = parseFloat(activeModel.bonus_percentage_skade) || 0;
    
    const bonusLivCommission = data.livPremium * bonusLivRate / 100;
    const bonusSkadeCommission = data.skadePremium * bonusSkadeRate / 100;
    
    livCommission += bonusLivCommission;
    skadeCommission += bonusSkadeCommission;
    
    // Log bonus calculation
    console.log("Bonus applied:", {
      bonusLivRate,
      bonusSkadeRate,
      bonusLivCommission,
      bonusSkadeCommission,
      threshold: activeModel.bonus_threshold,
      totalPremium
    });
  }
  
  const totalCommission = livCommission + skadeCommission;
  
  // Final log of calculated commissions
  console.log("Final commission:", {
    livCommission,
    skadeCommission,
    totalCommission
  });
  
  return {
    livCommission,
    skadeCommission,
    totalCommission
  };
}
