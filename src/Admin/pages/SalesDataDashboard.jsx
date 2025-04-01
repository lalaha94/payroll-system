import { fetchApprovedSales } from '../../services/commissionService';
import { useEffect, useState } from 'react';

const SalesDataDashboard = () => {
  const [approvedSales, setApprovedSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApprovedSales = async () => {
      setLoading(true);
      const data = await fetchApprovedSales();
      setApprovedSales(data);
      setLoading(false);
    };

    loadApprovedSales();
  }, []);

  return (
    <div>
      <h1>Godkjente Salg</h1>
      {loading ? (
        <p>Laster...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Måned</th>
              <th>Godkjent Beløp</th>
              <th>Godkjent av</th>
            </tr>
          </thead>
          <tbody>
            {approvedSales.map((sale) => (
              <tr key={`${sale.agent_name}-${sale.month_year}`}>
                <td>{sale.agent_name}</td>
                <td>{sale.month_year}</td>
                <td>{sale.approved_commission}</td>
                <td>{sale.approved_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SalesDataDashboard;
