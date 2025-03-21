import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Box,
  TextField,
  Button,
  Paper,
  Stack,
} from "@mui/material";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [salaryModels, setSalaryModels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Hent ansatte fra Supabase
  useEffect(() => {
    async function fetchEmployees() {
      const { data, error } = await supabase.from("employees").select("*");
      if (error) {
        console.error("Feil ved henting av ansatte:", error);
      } else {
        setEmployees(data);
      }
    }
    fetchEmployees();
  }, []);

  // Hent lønnstrinn fra Supabase
  useEffect(() => {
    async function fetchSalaryModels() {
      const { data, error } = await supabase.from("salary_models").select("*");
      if (error) {
        console.error("Feil ved henting av lønnstrinn:", error);
      } else {
        setSalaryModels(data);
      }
    }
    fetchSalaryModels();
  }, []);

  // Filtrer ansatte basert på søkeord
  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Beregn nøkkeltall
  const totalEmployees = filteredEmployees.length;
  const totalSalary = filteredEmployees.reduce(
    (sum, emp) => sum + parseFloat(emp.salary || 0),
    0
  );
  const avgSalary =
    totalEmployees > 0 ? (totalSalary / totalEmployees).toFixed(2) : 0;

  // Grupper ansatte etter startmåned for diagram (bruker start_date)
  const monthlyDataMap = {};
  filteredEmployees.forEach((emp) => {
    if (emp.start_date) {
      const month = new Date(emp.start_date).toLocaleString("default", {
        month: "short",
      });
      if (!monthlyDataMap[month]) {
        monthlyDataMap[month] = { month, totalSalary: 0, count: 0 };
      }
      monthlyDataMap[month].totalSalary += parseFloat(emp.salary || 0);
      monthlyDataMap[month].count += 1;
    }
  });
  const monthlyData = Object.values(monthlyDataMap).map((d) => ({
    month: d.month,
    avgSalary: d.count > 0 ? (d.totalSalary / d.count).toFixed(2) : 0,
  }));

  // Finn ansatte som mangler lønnstrinn
  const missingSalaryModel = filteredEmployees.filter(
    (emp) => !emp.salary_model_id
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      {/* Toppmeny med søkefelt */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <Typography variant="h4" fontWeight="bold">
          Payroll Dashboard
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Søk etter ansatt"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button component={Link} to="/employees" variant="contained">
            Se ansatte
          </Button>
          <Button component={Link} to="/salary-models" variant="contained">
            Administrer lønnstrinn
          </Button>
          <Button component={Link} to="/sales-data" variant="contained">
  Last opp salgsdata
</Button>
        </Stack>
      </Box>

      {/* Nøkkeltall */}
      <Grid container spacing={4} mb={4}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Antall ansatte" />
            <CardContent>
              <Typography variant="h4" fontWeight="bold">
                {totalEmployees}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Totale lønnskostnader" />
            <CardContent>
              <Typography variant="h4" fontWeight="bold">
                {totalSalary} kr
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Gjennomsnittlig lønn" />
            <CardContent>
              <Typography variant="h4" fontWeight="bold">
                {avgSalary} kr
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Diagram: Gjennomsnittslønn per startmåned */}
      <Paper sx={{ width: "100%", height: 300, mb: 4, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Gjennomsnittslønn per startmåned
        </Typography>
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgSalary" fill="#1976d2" name="Gjennomsnittlig lønn" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Typography>Ingen data for diagram.</Typography>
        )}
      </Paper>

      {/* Varslingsseksjon for ansatte uten lønnstrinn */}
      {missingSalaryModel.length > 0 && (
        <Paper sx={{ p: 2, mb: 4, backgroundColor: "#fff3cd" }}>
          <Typography variant="subtitle4" fontWeight="bold">
            Varsel: {missingSalaryModel.length} ansatte mangler lønnstrinn!
          </Typography>
          <Typography variant="body2">
            Vennligst oppdater lønnstrinn for disse ansatte.
          </Typography>
        </Paper>
      )}

      {/* Enkel liste med ansatte */}
      <Paper sx={{ mt: 2, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", padding: "8px" }}>
                ID
              </th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "8px" }}>
                Navn
              </th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "8px" }}>
                Stilling
              </th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "8px" }}>
                Startdato
              </th>
              <th style={{ borderBottom: "1px solid #ccc", padding: "8px" }}>
                Lønnstrinn
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => {
              const model = salaryModels.find(
                (m) => Number(m.id) === Number(emp.salary_model_id)
              );
              return (
                <tr key={emp.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                    {emp.id}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                    {emp.name}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                    {emp.position}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                    {emp.start_date}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                    {model ? model.name : "Ikke angitt"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Paper>
    </Container>
  );
}

export default Dashboard;
