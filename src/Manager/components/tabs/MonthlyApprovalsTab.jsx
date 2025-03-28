import React, { useState } from 'react'; // Remove useEffect
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Switch,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import { 
  Refresh, 
  Comment, 
  Cancel, 
  Search,
  CheckCircle,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const MonthlyApprovalsTab = ({
  agentPerformance,
  showApproved,
  setShowApproved,
  selectedMonth,
  refreshingApprovals,
  fetchMonthlyApprovals,
  openBatchApproval,
  openRevocationDialog,
  debugApprovalStatus,
  approvalSuccess,
  setApprovalSuccess,
  CHART_COLORS
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalPremium", direction: "desc" });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const sortedAgents = () => {
    if (!agentPerformance || agentPerformance.length === 0) {
      return [];
    }

    // First filter agents by name search term
    const filteredAgents = agentPerformance.filter(agent => {
      // Filter by search term
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    
    // Split into approved and pending agents
    const pendingAgents = filteredAgents.filter(a => !a.isApproved);
    const approvedAgents = filteredAgents.filter(a => a.isApproved);
    
    // Sort each group separately
    const sortFn = (a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      if (sortConfig.key === 'isApproved') {
        if (sortConfig.direction === 'desc') {
          return (b.isApproved ? 1 : 0) - (a.isApproved ? 1 : 0);
        } else {
          return (a.isApproved ? 1 : 0) - (b.isApproved ? 1 : 0);
        }
      }
      
      const aValue = a[sortConfig.key] !== undefined ? a[sortConfig.key] : 0;
      const bValue = b[sortConfig.key] !== undefined ? b[sortConfig.key] : 0;
      
      return sortConfig.direction === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    };
    
    const sortedPendingAgents = [...pendingAgents].sort(sortFn);
    const sortedApprovedAgents = [...approvedAgents].sort(sortFn);
    
    // Combine the groups with pending agents first
    return [...sortedPendingAgents, ...(showApproved ? sortedApprovedAgents : [])];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mr: 2 }}>
            Godkjenning av Månedsprovisjon
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showApproved}
                onChange={(e) => setShowApproved(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label="Vis godkjente agenter"
          />
        </Box>
        <Box>
          {approvalSuccess && (
            <Alert 
              severity="success" 
              sx={{ mb: 0, mr: 2 }}
              onClose={() => setApprovalSuccess(null)}
            >
              {approvalSuccess}
            </Alert>
          )}
          
          {/* Fix MUI warning by wrapping the disabled button in a span */}
          <Tooltip title="Oppdater godkjenningsstatus">
            <span>
              <IconButton 
                onClick={fetchMonthlyApprovals}
                disabled={refreshingApprovals}
                color="primary"
              >
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Godkjenn månedsutbetalinger for agenter. Her kan du gjennomgå samlet provisjon 
        for hver agent og godkjenne for utbetaling. Godkjente utbetalinger vil bli sendt 
        til regnskapsavdelingen.
      </Typography>
      
      <TableContainer sx={{ maxHeight: 600 }}>
        {refreshingApprovals ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Henter data...
            </Typography>
          </Box>
        ) : (
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
                <TableCell onClick={() => requestSort('totalPremium')} align="right" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    Total Premium
                    {getSortIcon('totalPremium')}
                  </Box>
                </TableCell>
                <TableCell onClick={() => requestSort('commission')} align="right" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    Beregnet Provisjon
                    {getSortIcon('commission')}
                  </Box>
                </TableCell>
                <TableCell onClick={() => requestSort('isApproved')} align="center" sx={{ cursor: 'pointer' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Status
                    {getSortIcon('isApproved')}
                  </Box>
                </TableCell>
                <TableCell align="center">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAgents().length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {selectedMonth ? 
                      'Ingen agenter med provisjon funnet for denne måneden. Prøv å klikk på oppdater-knappen ovenfor.' :
                      'Velg en måned for å se agenter med provisjon.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                sortedAgents().map((agent, index) => (
                  <TableRow key={agent.id || `agent-${index}`} hover>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={agent.ranking || index + 1} 
                        color={
                          (agent.ranking || index + 1) === 1 ? "success" :
                          (agent.ranking || index + 1) === 2 ? "primary" :
                          (agent.ranking || index + 1) === 3 ? "secondary" : 
                          "default"
                        }
                        variant="filled"
                        sx={{ 
                          minWidth: '30px', 
                          fontWeight: 'bold',
                          ...((agent.ranking || index + 1) <= 3 ? { color: 'white' } : {})
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ 
                          width: 32, 
                          height: 32, 
                          mr: 1, 
                          bgcolor: (agent.ranking || index + 1) <= 3 
                            ? CHART_COLORS[(agent.ranking || index + 1) - 1] 
                            : '#bdbdbd' 
                        }}>
                          {agent.name?.substring(0, 1) || '?'}
                        </Avatar>
                        {agent.name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={agent.salaryModelName || 'Ukjent'} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {(agent.totalPremium || 0).toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                      {(agent.commission || 0).toFixed(2).toLocaleString('nb-NO')} kr
                      {agent.isApproved && agent.approvalRecord?.approved_commission !== agent.commission && (
                        <Tooltip title="Justert beløp">
                          <Box component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary' }}>
                            Godkjent: {parseFloat(agent.approvalRecord?.approved_commission || 0).toFixed(2).toLocaleString('nb-NO')} kr
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {agent.isApproved ? (
                        <Tooltip title={`Godkjent av: ${agent.approvalRecord?.approved_by || 'Ukjent'}`}>
                          <Chip 
                            icon={<CheckCircle fontSize="small" />}
                            label="Godkjent"
                            color="success"
                            size="small"
                          />
                        </Tooltip>
                      ) : agent.commission > 0 ? (
                        <Chip 
                          label="Venter" 
                          color="warning" 
                          size="small"
                        />
                      ) : (
                        <Chip 
                          label="Ingen provisjon" 
                          color="default" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {!agent.isApproved && agent.commission > 0 ? (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => openBatchApproval(agent)}
                        >
                          Godkjenn
                        </Button>
                      ) : agent.isApproved && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Tooltip title={agent.approvalRecord?.approval_comment || 'Ingen kommentar'}>
                            <IconButton size="small" color="info">
                              <Comment fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Trekk tilbake godkjenning">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => openRevocationDialog(agent)}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {process.env.NODE_ENV === 'development' && (
                            <Tooltip title="Debug godkjenningsstatus">
                              <IconButton 
                                size="small" 
                                color="default"
                                onClick={() => debugApprovalStatus(agent)}
                              >
                                <Search fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
};

export default MonthlyApprovalsTab;
