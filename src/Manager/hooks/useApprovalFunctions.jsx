import { useCallback } from 'react';
import { supabase } from '../../supabaseClient';

export const useApprovalFunctions = ({
  selectedMonth,
  managerData,
  agentPerformance,
  setAgentPerformance,
  setMonthlyApprovals,
  setRefreshingApprovals,
  setApprovalSuccess,
  setApprovalError,
  showApproved,
  tabValue
}) => {
  
  const fetchMonthlyApprovals = useCallback(async () => {
    if (!selectedMonth || !managerData?.agent_company) return;

    try {
      setRefreshingApprovals(true);
      setApprovalError?.(null);
      
      console.log("Fetching monthly approvals for:", selectedMonth, managerData.agent_company);
      
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        'generate_monthly_commission_summaries',
        { target_month: selectedMonth }
      );
      
      if (summaryError) {
        console.warn("Error generating summaries:", summaryError);
      } else {
        console.log(`Generated ${summaryData} monthly summaries`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: approvalData, error: approvalError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('month_year', selectedMonth)
        .or(`agent_company.eq.${managerData.agent_company},agent_company.is.null`)
        .order('agent_name');
        
      if (approvalError) throw approvalError;
      
      console.log("Full monthly approvals:", approvalData);
      
      if (approvalData && approvalData.some(a => a.agent_company === null)) {
        console.log("Found approvals with null agent_company, fixing them");
        
        for (const approval of approvalData) {
          if (approval.agent_company === null) {
            const { error: updateError } = await supabase
              .from('monthly_commission_approvals')
              .update({ agent_company: managerData.agent_company })
              .eq('id', approval.id);
              
            if (updateError) {
              console.error(`Error fixing approval for ${approval.agent_name}:`, updateError);
            } else {
              console.log(`Fixed agent_company for ${approval.agent_name}`);
              approval.agent_company = managerData.agent_company;
            }
          }
        }
      }
      
      setMonthlyApprovals(approvalData || []);
      
      const approvedAgentNames = (approvalData || [])
        .filter(a => a.approved === true && a.revoked !== true)
        .map(a => a.agent_name);
      
      console.log("Approved agents to mark or filter out:", approvedAgentNames);
      
      if (agentPerformance.length > 0) {
        const missingAgents = [];
        approvalData?.forEach(approval => {
          if (approval.approved && !approval.revoked && 
              !agentPerformance.some(agent => agent.name === approval.agent_name)) {
            console.log(`Found approved agent ${approval.agent_name} not in agentPerformance, will add`);
            missingAgents.push({
              name: approval.agent_name,
              approvalRecord: approval,
              isApproved: true,
              commission: parseFloat(approval.approved_commission) || 0,
              totalPremium: 0,
              livPremium: 0,
              skadePremium: 0,
              salaryModelName: 'Ukjent',
              totalCount: 0,
              ranking: agentPerformance.length + missingAgents.length + 1
            });
          }
        });

        let updatedAgentPerformance = agentPerformance.map(agent => {
          const record = approvalData?.find(
            a => a.agent_name === agent.name && a.revoked !== true
          );
          
          const isApproved = record?.approved === true && record?.revoked !== true;
          
          return {
            ...agent,
            approvalRecord: record || null,
            isApproved
          };
        });
        
        if (missingAgents.length > 0) {
          console.log(`Adding ${missingAgents.length} missing approved agents to the display`);
          updatedAgentPerformance = [...updatedAgentPerformance, ...missingAgents];
        }
        
        if (tabValue === 3 && !showApproved) {
          setAgentPerformance(updatedAgentPerformance.filter(agent => !approvedAgentNames.includes(agent.name)));
        } else {
          setAgentPerformance(updatedAgentPerformance);
        }
      }
      
    } catch (error) {
      console.error("Error fetching monthly approvals:", error);
      setApprovalError?.(`Feil ved henting av godkjenninger: ${error.message}`);
    } finally {
      setRefreshingApprovals(false);
    }
  }, [selectedMonth, managerData?.agent_company, showApproved, tabValue, agentPerformance, setAgentPerformance, setMonthlyApprovals]);

  const handleBatchApprove = useCallback(async ({
    selectedAgent,
    selectedMonth,
    batchAmount,
    batchComment,
    managerData,
    closeBatchApproval,
    setBatchApprovalLoading
  }) => {
    if (!selectedAgent || !selectedMonth) {
      setApprovalError?.("Manglende agent eller måned");
      return;
    }
    
    if (!batchAmount || isNaN(parseFloat(batchAmount)) || parseFloat(batchAmount) < 0) {
      setApprovalError?.("Ugyldig provisjonsbeløp");
      return;
    }
    
    setBatchApprovalLoading(true);
    setApprovalError?.(null);
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(`Session error: ${sessionError.message}`);
      
      const currentUser = sessionData?.session?.user;
      if (!currentUser) throw new Error("Kunne ikke hente brukerdata");

      console.log("Current user:", currentUser.email);
      console.log("Attempting to approve for company:", managerData.agent_company);
      console.log("For agent:", selectedAgent.name, "Month:", selectedMonth);
      
      if (!managerData.agent_company) {
        throw new Error("Manglende kontordata for denne lederen");
      }
      
      const approvalData = {
        approved: true,
        approved_by: currentUser.email,
        approved_commission: parseFloat(batchAmount),
        approval_comment: batchComment || null,
        approved_at: new Date().toISOString(),
        revoked: false,
        revoked_by: null,
        revoked_at: null,
        revocation_reason: null,
        agent_company: managerData.agent_company
      };
      
      // Add commission modification information to metadata
      const approvalMetadata = {};
      if (selectedAgent.isModified) {
        approvalMetadata.modifiedRates = {
          skadeRate: selectedAgent.skadeCommissionRate,
          livRate: selectedAgent.livCommissionRate
        };
        
        approvalMetadata.modifiedDeductions = {
          tjenestetorget: selectedAgent.tjenestetorgetDeduction || 0,
          bytt: selectedAgent.byttDeduction || 0,
          other: selectedAgent.otherDeductions || 0,
          fivePercent: selectedAgent.applyFivePercent
        };
      }
      
      let result;
      
      const { data: existingRecord, error: checkError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('agent_name', selectedAgent.name)
        .eq('month_year', selectedMonth);
      
      if (checkError) {
        console.error("Error running detailed check:", checkError);
      } else {
        console.log("Detailed check results:", existingRecord);
      }
      
      if (existingRecord && existingRecord.length > 0) {
        const recordToUpdate = existingRecord[0];
        console.log(`Found existing record (ID: ${recordToUpdate.id}), updating it directly`);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('monthly_commission_approvals')
          .update({
            ...approvalData,
            agent_name: selectedAgent.name,
            month_year: selectedMonth,
            agent_company: managerData.agent_company,
            revoked: false,
            approval_metadata: Object.keys(approvalMetadata).length > 0 ? approvalMetadata : null
          })
          .eq('id', recordToUpdate.id)
          .select();
          
        if (updateError) {
          console.error("Error updating existing record:", updateError);
          throw new Error(`Kunne ikke oppdatere godkjenning: ${updateError.message}`);
        }
        
        console.log("Update successful:", updateResult);
        result = { data: updateResult, success: true, action: "updated" };
      } else {
        console.log("No existing record found, attempting insert");
        
        try {
          const newRecord = {
            agent_name: selectedAgent.name,
            month_year: selectedMonth, 
            agent_company: managerData.agent_company,
            ...approvalData,
            approval_metadata: Object.keys(approvalMetadata).length > 0 ? approvalMetadata : null
          };
          
          console.log("Inserting new record:", newRecord);
          
          const { data: insertResult, error: insertError } = await supabase
            .from('monthly_commission_approvals')
            .insert(newRecord)
            .select();
          
          if (insertError) {
            console.error("Insert failed:", insertError);
            
            if (insertError.code === '23505') {
              console.log("Key conflict detected. Waiting and trying again...");
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const { data: retryCheck, error: retryError } = await supabase
                .from('monthly_commission_approvals')
                .select('*')
                .filter('agent_name', 'eq', selectedAgent.name)
                .filter('month_year', 'eq', selectedMonth);
              
              console.log("Retry check complete - Results:", retryCheck, "Error:", retryError);
              
              if (retryError) {
                console.error("Error on retry check:", retryError);
                throw new Error(`Feil ved nytt søk: ${retryError.message}`);
              }
              
              if (!retryCheck || retryCheck.length === 0) {
                console.error("Still no record found despite duplicate key error!");
                
                console.log("Attempting last resort insert");
                
                const { error: finalError } = await supabase
                  .from('monthly_commission_approvals')
                  .insert({
                    agent_name: selectedAgent.name,
                    month_year: selectedMonth,
                    agent_company: managerData.agent_company,
                    approved: true,
                    approved_by: currentUser.email,
                    approved_commission: parseFloat(batchAmount),
                    approved_at: new Date().toISOString()
                  });
                  
                if (finalError) {
                  console.error("Final insert attempt also failed:", finalError);
                  throw new Error(`Kunne ikke opprette godkjenning etter gjentatte forsøk: ${finalError.message}`);
                }
                
                result = { 
                  data: [{
                    agent_name: selectedAgent.name,
                    month_year: selectedMonth,
                    agent_company: managerData.agent_company,
                    ...approvalData,
                    approval_metadata: Object.keys(approvalMetadata).length > 0 ? approvalMetadata : null
                  }], 
                  success: true, 
                  action: "emergency-inserted" 
                };
              } else {
                const conflictRecord = retryCheck[0];
                console.log("Finally found record on retry:", conflictRecord);
                
                const { data: conflictUpdate, error: conflictUpdateError } = await supabase
                  .from('monthly_commission_approvals')
                  .update({
                    ...approvalData,
                    approval_metadata: Object.keys(approvalMetadata).length > 0 ? approvalMetadata : null
                  })
                  .eq('id', conflictRecord.id)
                  .select();
                  
                if (conflictUpdateError) {
                  console.error("Error updating found record:", conflictUpdateError);
                  throw new Error(`Kunne ikke oppdatere godkjenning: ${conflictUpdateError.message}`);
                }
                
                console.log("Successfully updated on retry:", conflictUpdate);
                result = { data: conflictUpdate, success: true, action: "conflict-resolved" };
              }
            } else {
              throw insertError;
            }
          } else {
            console.log("Insert successful:", insertResult);
            result = { data: insertResult, success: true, action: "inserted" };
          }
        } catch (insertErr) {
          console.error("Unhandled error during insert/update:", insertErr);
          throw insertErr;
        }
      }
      
      console.log(`Approval operation complete (${result?.action}):`, result);
      
      if (tabValue === 3 && !showApproved) {
        setAgentPerformance(prev => 
          prev.filter(agent => agent.name !== selectedAgent.name)
        );
      } else {
        setAgentPerformance(prev =>
          prev.map(agent =>
            agent.name === selectedAgent.name
              ? {
                  ...agent,
                  isApproved: true,
                  approvalRecord: {
                    agent_name: agent.name,
                    month_year: selectedMonth,
                    agent_company: managerData.agent_company,
                    approved: true,
                    approved_commission: parseFloat(batchAmount),
                    approved_by: currentUser.email,
                    approved_at: new Date().toISOString(),
                    approval_comment: batchComment || null,
                    revoked: false,
                    approval_metadata: Object.keys(approvalMetadata).length > 0 ? approvalMetadata : null
                  },
                }
              : agent
          )
        );
      }
      
      setApprovalSuccess?.(`Godkjent provisjon for ${selectedAgent.name}`);
      setTimeout(() => setApprovalSuccess?.(null), 3000);
      
      closeBatchApproval();
      
      setTimeout(() => {
        fetchMonthlyApprovals();
      }, 1500);
      
    } catch (err) {
      console.error("Error approving commission:", err);
      setApprovalError?.(`Feil ved godkjenning: ${err.message}`);
    } finally {
      setBatchApprovalLoading(false);
    }
  }, [tabValue, showApproved, setAgentPerformance, setApprovalError, setApprovalSuccess, fetchMonthlyApprovals]);

  const handleRevokeApproval = useCallback(async ({
    selectedAgent,
    selectedMonth,
    revocationReason,
    closeRevocationDialog,
    setRevocationLoading
  }) => {
    if (!selectedAgent || !selectedMonth) return;
    
    setRevocationLoading(true);
    setApprovalError?.(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      
      if (!currentUser) {
        throw new Error("Kunne ikke hente brukerdata. Logg inn på nytt.");
      }
      
      // First, get the specific record to update
      const { data: approvalToRevoke, error: findError } = await supabase
        .from('monthly_commission_approvals')
        .select('id')
        .eq('agent_name', selectedAgent.name)
        .eq('month_year', selectedMonth)
        .eq('agent_company', managerData.agent_company)
        .eq('approved', true)
        .eq('revoked', false)
        .maybeSingle();
      
      if (findError) {
        throw new Error(`Kunne ikke finne godkjenning: ${findError.message}`);
      }
      
      if (!approvalToRevoke) {
        throw new Error(`Ingen aktiv godkjenning funnet for ${selectedAgent.name}`);
      }
      
      console.log(`Found approval to revoke:`, approvalToRevoke);
      
      // Now update by ID to avoid ambiguous column references
      const { data, error } = await supabase
        .from('monthly_commission_approvals')
        .update({
          revoked: true,
          revoked_by: currentUser.email,
          revoked_at: new Date().toISOString(),
          revocation_reason: revocationReason || 'Godkjenning trukket tilbake'
        })
        .eq('id', approvalToRevoke.id)
        .select();
      
      if (error) throw error;
      
      console.log(`Revoked approval for ${selectedAgent.name}`);
      
      setApprovalSuccess?.(`Godkjenning for ${selectedAgent.name} ble trukket tilbake`);
      setTimeout(() => setApprovalSuccess?.(null), 3000);
      
      await fetchMonthlyApprovals();
      closeRevocationDialog();
      
    } catch (error) {
      console.error("Error revoking approval:", error);
      setApprovalError?.(`Feil ved tilbaketrekking av godkjenning: ${error.message}`);
    } finally {
      setRevocationLoading(false);
    }
  }, [fetchMonthlyApprovals, setApprovalError, setApprovalSuccess, managerData]);

  const debugApprovalStatus = useCallback(async (agent) => {
    if (!agent || !selectedMonth) return;
    
    console.log(`Debugging approval status for ${agent.name} in ${selectedMonth}`);
    
    try {
      const { data: salesCount, error: salesError } = await supabase
        .from('sales_data')
        .select('id', { count: 'exact' })
        .eq('agent_name', agent.name)
        .ilike('policy_sale_date', `${selectedMonth}%`)
        .is('cancel_code', null);
      
      if (salesError) throw salesError;
      
      const { data: approvals, error: approvalsError } = await supabase
        .from('monthly_commission_approvals')
        .select('*')
        .eq('agent_name', agent.name)
        .eq('month_year', selectedMonth);
      
      if (approvalsError) throw approvalsError;
      
      let fixed = 0;
      if (salesCount.count > 0 && (!approvals || approvals.length === 0)) {
        const { data: newApproval, error: insertError } = await supabase
          .from('monthly_commission_approvals')
          .insert({  
            agent_name: agent.name,
            agent_company: managerData.agent_company,
            month_year: selectedMonth,
            approved: false,
            revoked: false
          });
        
        if (insertError) {
          console.error("Failed to create missing approval:", insertError);
        } else {
          fixed = 1;
        }
      }
      
      const statusData = {
        agent: agent.name,
        month: selectedMonth,
        sales_count: salesCount.count,
        approved_sales: approvals?.length || 0,
        fixed,
        status: salesCount.count === 0 ? 'No sales found for this period' :
                (approvals?.length || 0) === 0 ? 'No approval records found' :
                'Approval record exists'
      };
      
      console.log("Approval status check:", statusData);
      
      if (fixed > 0) {
        setApprovalSuccess?.(`Synkroniserte ${fixed} godkjenninger for ${agent.name}`);
        await fetchMonthlyApprovals();
      }
      
      alert(`Status for ${agent.name}: ${statusData.status}\nSalg: ${statusData.sales_count}, Godkjente: ${statusData.approved_sales}`);
    } catch (error) {
      console.error("Error checking approval status:", error);
      setApprovalError?.(`Feil ved sjekking av godkjenninger: ${error.message}`);
    }
  }, [selectedMonth, fetchMonthlyApprovals, setApprovalError, setApprovalSuccess, managerData]);

  return {
    fetchMonthlyApprovals,
    handleBatchApprove,
    handleRevokeApproval,
    debugApprovalStatus
  };
};
