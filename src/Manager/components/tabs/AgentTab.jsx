import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Avatar,
} from '@mui/material';
import { Search, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const AgentTab = ({ agentPerformance, CHART_COLORS }) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalPremium", direction: "desc" });

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAgents = () => {
    if (!agentPerformance || agentPerformance.length === 0) {
      return [];
    }
    
    // Filter agents by name search term
    const filteredAgents = agentPerformance.filter(agent => {
      if (!agent || !agent.name) return false;
      return agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    // Sort the agents
    return [...filteredAgents].sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      const aValue = a[sortConfig.key] !== undefined ? a[sortConfig.key] : 0;
      const bValue = b[sortConfig.key] !== undefined ? b[sortConfig.key] : 0;
      
      return sortConfig.direction === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight="bold">
          Agentprestasjoner
        </Typography>
        
        <TextField 
          placeholder="Søk etter agent..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 250 }}
        />
      </Box>
      
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => requestSort('ranking')} sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  #
                  {getSortIcon('ranking')}
                </Box>
              </TableCell>
              <TableCell onClick={() => requestSort('name')} sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Agent
                  {getSortIcon('name')}
                </Box>
              </TableCell>
              <TableCell>Lønnstrinn</TableCell>
              <TableCell onClick={() => requestSort('livPremium')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Liv Premium
                  {getSortIcon('livPremium')}
                </Box>
              </TableCell>
              <TableCell onClick={() => requestSort('skadePremium')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Skade Premium
                  {getSortIcon('skadePremium')}
                </Box>
              </TableCell>
              <TableCell onClick={() => requestSort('totalPremium')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Total Premium
                  {getSortIcon('totalPremium')}
                </Box>
              </TableCell>
              <TableCell onClick={() => requestSort('totalCount')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Antall Salg
                  {getSortIcon('totalCount')}
                </Box>
              </TableCell>
              <TableCell onClick={() => requestSort('commission')} align="right" sx={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Provisjon
                  {getSortIcon('commission')}
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedAgents().length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Ingen agenter funnet
                </TableCell>
              </TableRow>
            ) : (
              sortedAgents().map(agent => (
                <TableRow key={agent.id} hover>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={agent.ranking} 
                      color={
                        agent.ranking === 1 ? "success" :
                        agent.ranking === 2 ? "primary" :
                        agent.ranking === 3 ? "secondary" : 
                        "default"
                      }
                      variant="filled"
                      sx={{ 
                        minWidth: '30px', 
                        fontWeight: 'bold',
                        ...(agent.ranking <= 3 ? { color: 'white' } : {})
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ 
                        width: 32, 
                        height: 32, 
                        mr: 1, 
                        bgcolor: agent.ranking <= 3 
                          ? CHART_COLORS[agent.ranking - 1] 
                          : '#bdbdbd'
                      }}>
                        {agent.name.substring(0, 1)}
                      </Avatar>
                      {agent.name}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={agent.salaryModelName} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {(agent.livPremium || 0).toLocaleString('nb-NO')} kr
                  </TableCell>
                  <TableCell align="right">
                    {(agent.skadePremium || 0).toLocaleString('nb-NO')} kr
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {(agent.totalPremium || 0).toLocaleString('nb-NO')} kr
                  </TableCell>
                  <TableCell align="right">
                    {agent.totalCount || 0}
                  </TableCell>
                  <TableCell align="right" sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}>
                    {(agent.commission || 0).toLocaleString('nb-NO')} kr
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AgentTab;
