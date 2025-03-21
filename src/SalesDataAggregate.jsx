import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Typography,
} from "@mui/material";

// Dummy salary model for testing – erstatt med reelle data
const dummySalaryModel = {
  commission_liv: "10",     // 10% for livsforsikring
  commission_skade: "15",   // 15% for skadeforsikring
};

/**
 * Beregner provisjonen basert på provisjonsgrunnlag, lønnstrinn og forsikringstype.
 *
 * @param {number} provisjonsgrunnlag - Aggregert sum av net premium sales.
 * @param {object} salaryModel - Objekt med provisjonssatser (commission_liv og commission_skade).
 * @param {string} insuranceType - "Liv" eller "Skadeforsikring".
 * @returns {number} - Beregnet provisjon.
 */
function calculateCommission(provisjonsgrunnlag, salaryModel, insuranceType) {
  if (!salaryModel || !provisjonsgrunnlag) return 0;
  if (insuranceType === "Liv") {
    return (provisjonsgrunnlag * parseFloat(salaryModel.commission_liv)) / 100;
  } else if (insuranceType === "Skadeforsikring") {
    return (provisjonsgrunnlag * parseFloat(salaryModel.commission_skade)) / 100;
  }
  return 0;
}

/**
 * Denne komponenten:
 * 1) Henter all salgsdata fra `sales_data`.
 * 2) Mapper provisjonsgruppe til enten "Skadeforsikring" eller "Liv".
 *    (Nå sjekker vi også for andre varianter for skade.)
 * 3) Grupperer data på (agent_id, forsikringstype, måned).
 * 4) Summerer `net_premium_sales` for hver gruppe pr. måned.
 * 5) Beregner provisjon for hver gruppe basert på lønnstrinn.
 */
function SalesDataAggregate() {
  const [loading, setLoading] = useState(true);
  const [aggregatedByMonth, setAggregatedByMonth] = useState({});
  const [monthKeys, setMonthKeys] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);

  // Hent data fra Supabase ved oppstart
  useEffect(() => {
    async function fetchAndAggregate() {
      setLoading(true);
      const { data, error } = await supabase.from("sales_data").select("*");
      if (error) {
        console.error("Feil ved henting av salgsdata:", error);
        setLoading(false);
        return;
      }

      // Aggreger salgsdata per måned
      const { byMonth, uniqueMonths } = aggregateSalesByMonth(data);
      uniqueMonths.sort(); // sorterer månedsnøklene stigende
      setAggregatedByMonth(byMonth);
      setMonthKeys(uniqueMonths);
      setLoading(false);
    }

    fetchAndAggregate();
  }, []);

  /**
   * Returnerer en streng for året og måneden (YYYY-MM) basert på policy_sale_date.
   */
  function getMonthKey(policySaleDate) {
    if (!policySaleDate) return "Ukjent Måned";
    const d = new Date(policySaleDate);
    if (isNaN(d.getTime())) return "Ukjent Måned";
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  }

  /**
   * Aggregér salgsdata på måned og (agent_id, forsikringstype).
   */
  function aggregateSalesByMonth(sales) {
    const byMonth = {};
    const uniqueMonths = new Set();

    for (const sale of sales) {
      const { agent_id, agent_name, policy_sale_date, provisjonsgruppe } = sale;

      // Bestem forsikringstype med mer robust sjekk
      let insuranceType = "";
      if (provisjonsgruppe) {
        const grp = provisjonsgruppe.toLowerCase();
        if (grp.includes("life")) {
          insuranceType = "Liv";
        } else if (grp.includes("pc") || grp.includes("child") || grp.includes("skad")) {
          insuranceType = "Skadeforsikring";
        } else {
          insuranceType = provisjonsgruppe;
        }
      } else {
        insuranceType = "Ukjent";
      }

      // Få måned (YYYY-MM)
      const monthKey = getMonthKey(policy_sale_date);
      uniqueMonths.add(monthKey);

      // Opprett et felt for denne måneden om det ikke finnes
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {};
      }

      // Lag en unik nøkkel basert på agent og forsikringstype
      const groupKey = `${agent_id}-${insuranceType}`;
      if (!byMonth[monthKey][groupKey]) {
        byMonth[monthKey][groupKey] = {
          agent_id,
          agent_name,
          insuranceType,
          totalNetPremium: 0,
          count: 0,
        };
      }

      // Summer net premium sales
      const netPremium = parseFloat(sale.net_premium_sales) || 0;
      byMonth[monthKey][groupKey].totalNetPremium += netPremium;
      byMonth[monthKey][groupKey].count++;
    }

    // Konverter grupperingsobjektet til et array for hver måned
    for (const month of Object.keys(byMonth)) {
      byMonth[month] = Object.values(byMonth[month]);
    }
    return { byMonth, uniqueMonths: Array.from(uniqueMonths) };
  }

  // Bytt valgt fane
  const handleChangeTab = (event, newValue) => {
    setSelectedTab(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography>Laster salgsdata...</Typography>
      </Box>
    );
  }

  if (monthKeys.length === 0) {
    return <Typography sx={{ mt: 4 }}>Ingen salgsdata funnet.</Typography>;
  }

  // Finn måned for aktiv fane
  const currentMonthKey = monthKeys[selectedTab];
  const rowsForMonth = aggregatedByMonth[currentMonthKey] || [];

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Salg pr. måned
      </Typography>

      {/* Faner for hver måned */}
      <Tabs
        value={selectedTab}
        onChange={handleChangeTab}
        variant="scrollable"
        scrollButtons="auto"
        centered
      >
        {monthKeys.map((month, index) => (
          <Tab key={month} label={month} value={index} />
        ))}
      </Tabs>

      {/* Vis data for valgt måned */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Måned: {currentMonthKey}
        </Typography>
        <Paper sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Agent ID</TableCell>
                <TableCell>Agent Navn</TableCell>
                <TableCell>Forsikringstype</TableCell>
                <TableCell>Sum Net Premium Sales</TableCell>
                <TableCell>Antall Salg</TableCell>
                <TableCell>Provisjon</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsForMonth.map((row, idx) => {
                // Beregn provisjonen for denne gruppen med salg
                const commission = calculateCommission(
                  row.totalNetPremium,
                  dummySalaryModel,
                  row.insuranceType
                );
                return (
                  <TableRow key={idx}>
                    <TableCell>{row.agent_id}</TableCell>
                    <TableCell>{row.agent_name}</TableCell>
                    <TableCell>{row.insuranceType}</TableCell>
                    <TableCell>{row.totalNetPremium.toFixed(2)}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{commission.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}

export default SalesDataAggregate;
