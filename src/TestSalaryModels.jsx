import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function TestSalaryModels() {
  const [salaryModels, setSalaryModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModels() {
      setLoading(true);
      const { data, error } = await supabase.from("salary_models").select("*");
      if (error) {
        console.error("Feil ved henting av lønnstrinn:", error);
      } else {
        console.log("Hentet lønnstrinn:", data);
        setSalaryModels(data);
      }
      setLoading(false);
    }
    fetchModels();
  }, []);

  if (loading) return <p>Laster lønnstrinn...</p>;

  if (salaryModels.length === 0) {
    return <p>Ingen lønnstrinn funnet</p>;
  }

  return (
    <div style={{ margin: "2rem" }}>
      <h2>Test Salary Models</h2>
      <ul>
        {salaryModels.map((model) => (
          <li key={model.id}>
            <strong>ID:</strong> {model.id} | <strong>Name:</strong> {model.name} |{" "}
            <strong>Commission Liv:</strong> {model.commission_liv} |{" "}
            <strong>Commission Skade:</strong> {model.commission_skade}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestSalaryModels;
