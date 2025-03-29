import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
} from "@mui/material";
import {
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Label,
  ResponsiveContainer
} from "recharts";
import {
  ShowChart as ShowChartIcon,
  Assessment,
  PieChart as PieChartIcon,
  CreditCard,
  PersonSearch,
  Timeline,
} from "@mui/icons-material";
import NavigationMenu from "../components/NavigationMenu";

const CHART_COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
];

function SalesDataDashboard() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [productDistribution, setProductDistribution] = useState([]);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  const [viewMode, setViewMode] = useState("table");

  useEffect(() => {
    // Fetch data logic here
  }, []);

  return (
    <Box sx={{ p: 3, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      <NavigationMenu />

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Add summary cards here */}
      </Grid>

      {/* Filterpanel */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 2 }}>
        {/* Add filter panel here */}
      </Card>

      {/* View selector */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        {/* Add view selector here */}
      </Box>

      {/* Results summary */}
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {/* Add results summary here */}
      </Typography>

      {viewMode === "table" ? (
        /* TanStack Table */
        <Paper sx={{ borderRadius: 2, overflow: "hidden" }} elevation={3}>
          {/* Add table view here */}
        </Paper>
      ) : (
        /* Charts View */
        <Grid container spacing={3}>
          {/* Sales Performance Over Time */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <ShowChartIcon sx={{ mr: 1 }} color="primary" />
                Salg og provisjon over tid
              </Typography>

              {monthlyData.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen data tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <LineChart
                    data={monthlyData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickFormatter={(value) => {
                        const [year, month] = value.split("-");
                        return `${month}/${year.substring(2)}`;
                      }}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(value) => `${value / 1000}k`}
                    >
                      <Label
                        value="Salg (NOK)"
                        angle={-90}
                        position="insideLeft"
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => `${value / 1000}k`}
                    >
                      <Label
                        value="Provisjon (NOK)"
                        angle={90}
                        position="insideRight"
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <RechartsTooltip
                      formatter={(value) =>
                        value.toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                        }) + " kr"
                      }
                      labelFormatter={(value) => {
                        const [year, month] = value.split("-");
                        return `${month}/${year}`;
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sales"
                      name="Salg"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="commission"
                      name="Provisjon"
                      stroke="#82ca9d"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Top Performing Agents */}
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <Assessment sx={{ mr: 1 }} color="primary" />
                Topp selgere
              </Typography>

              {agentPerformance.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen data tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart
                    data={agentPerformance}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      width={100}
                      tickFormatter={(value) => {
                        return value.length > 15
                          ? value.substring(0, 13) + "..."
                          : value;
                      }}
                    />
                    <RechartsTooltip
                      formatter={(value) =>
                        value.toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                        }) + " kr"
                      }
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Salg" fill="#8884d8" />
                    <Bar dataKey="commission" name="Provisjon" fill="#82ca9d" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Product Distribution Pie Chart */}
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <PieChartIcon sx={{ mr: 1 }} color="primary" />
                Salg per produkt
              </Typography>

              {productDistribution.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen data tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <PieChart>
                    <Pie
                      data={productDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) =>
                        entry.name.substring(0, 15) +
                        (entry.name.length > 15 ? "..." : "")
                      }
                    >
                      {productDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) =>
                        value.toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                        }) + " kr"
                      }
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Cancellation Reasons Chart */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <CreditCard sx={{ mr: 1 }} color="primary" />
                Kansellerings-årsaker
              </Typography>

              {cancelReasons.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen kanselleringsdata tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart
                    data={cancelReasons}
                    margin={{ top: 5, right: 30, left: 30, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        return value.length > 15
                          ? value.substring(0, 13) + "..."
                          : value;
                      }}
                    />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        if (name === "count") return `${value} kanselleringer`;
                        return (
                          value.toLocaleString("nb-NO", {
                            minimumFractionDigits: 2,
                          }) + " kr"
                        );
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="Antall kanselleringer"
                      fill="#FF8042"
                    />
                    <Bar
                      dataKey="value"
                      name="Premium verdi"
                      fill="#ff4081"
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Top Agents Performance Chart */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 400 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <PersonSearch sx={{ mr: 1 }} color="primary" />
                Topp agenter effektivitet
              </Typography>

              {topAgents.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen data tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={310}>
                  <RechartsBarChart
                    data={topAgents.slice(0, 5)}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tickFormatter={(value) => `${value / 1000}k`}
                    >
                      <Label
                        value="Beløp (NOK)"
                        angle={-90}
                        position="insideLeft"
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                    >
                      <Label
                        value="Effektivitet (%)"
                        angle={90}
                        position="insideRight"
                        style={{ textAnchor: "middle" }}
                      />
                    </YAxis>
                    <RechartsTooltip
                      formatter={(value, name) => {
                        if (name === "efficiency") return `${value}%`;
                        return (
                          value.toLocaleString("nb-NO", {
                            minimumFractionDigits: 2,
                          }) + " kr"
                        );
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="sales"
                      name="Salgsvolum"
                      fill="#3f51b5"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="commission"
                      name="Provisjon"
                      fill="#009688"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="efficiency"
                      name="Effektivitet"
                      fill="#ff9800"
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Transaction Counts by Month */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: 350 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <Timeline sx={{ mr: 1 }} color="primary" />
                Antall salg per måned
              </Typography>

              {monthlyData.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography color="text.secondary">
                    Ingen data tilgjengelig
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsBarChart
                    data={monthlyData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickFormatter={(value) => {
                        const [year, month] = value.split("-");
                        return `${month}/${year.substring(2)}`;
                      }}
                    />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="count" name="Antall salg" fill="#FF8042" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default SalesDataDashboard;