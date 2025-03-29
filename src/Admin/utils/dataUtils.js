/**
 * Returnerer en streng for året og måneden (YYYY-MM) basert på policy_sale_date.
 */
export function getMonthKey(policySaleDate) {
  if (!policySaleDate) return "Ukjent";
  const d = new Date(policySaleDate);
  if (isNaN(d.getTime())) return "Ukjent";
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Aggregerer salgsdata etter agent, med separate kolonner for Liv og Skadeforsikring.
 */
export function aggregateSalesByAgent(sales) {
  const byAgent = {};
  const uniqueMonths = new Set();

  for (const sale of sales) {
    // Skip sales with cancel_code
    if (sale.cancel_code) continue;
    
    const { agent_id, agent_name, policy_sale_date, provisjonsgruppe, salary_level } = sale;
    const monthKey = getMonthKey(policy_sale_date);
    uniqueMonths.add(monthKey);

    // Bestem forsikringstype med robust sjekk
    let insuranceType = "";
    if (provisjonsgruppe) {
      const grp = provisjonsgruppe.toLowerCase();
      if (grp.includes("life")) {
        insuranceType = "Liv";
      } else if (grp.includes("pc") || grp.includes("child") || grp.includes("skad")) {
        insuranceType = "Skadeforsikring";
      } else {
        insuranceType = "Annet";
      }
    } else {
      insuranceType = "Ukjent";
    }

    // Parse net_premium_sales
    let netPremium = 0;
    if (sale.net_premium_sales !== null && sale.net_premium_sales !== undefined) {
      let rawValue = sale.net_premium_sales;
      
      // If it's already a number, use it directly
      if (typeof rawValue === 'number') {
        netPremium = rawValue;
      } else {
        // Convert to string and clean it
        const rawStr = String(rawValue);
        
        // Remove any non-numeric characters except decimal separator
        const cleanStr = rawStr.replace(/[^0-9.,]/g, '').replace(',', '.');
        
        netPremium = parseFloat(cleanStr) || 0;
      }
    }

    // Create or update agent record with explicit salary_level mapping
    const agentKey = `${agent_id}-${monthKey}`;
    if (!byAgent[agentKey]) {
      byAgent[agentKey] = {
        id: agentKey,
        agent_id,
        agent_name,
        monthKey,
        livPremium: 0,
        livCount: 0,
        skadePremium: 0,
        skadeCount: 0,
        totalPremium: 0,
        totalCount: 0,
        salary_level: salary_level || null // Use the salary level from data if available
      };
    }

    // Update agent sales data based on insurance type
    if (insuranceType === "Liv") {
      byAgent[agentKey].livPremium += netPremium;
      byAgent[agentKey].livCount += 1;
    } else if (insuranceType === "Skadeforsikring") {
      byAgent[agentKey].skadePremium += netPremium;
      byAgent[agentKey].skadeCount += 1;
    }

    // Update totals
    byAgent[agentKey].totalPremium += netPremium;
    byAgent[agentKey].totalCount += 1;
  }

  return { 
    agents: Object.values(byAgent), 
    uniqueMonths: Array.from(uniqueMonths) 
  };
}
