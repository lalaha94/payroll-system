import React, { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import { Container, Typography, Button } from "@mui/material";

function ImportEmployees() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  // Håndter filopplasting
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
  };

  // Håndter import
  const handleImport = async () => {
    if (!file) {
      alert("Vennligst velg en fil først.");
      return;
    }

    try {
      // Les filen som ArrayBuffer
      const data = await file.arrayBuffer();
      // Les workbook
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Konverter til JSON; forutsetter at første rad er header
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length < 2) {
        setMessage("Filen ser ut til å være tom eller har manglende header.");
        return;
      }
      // Første rad som header
      const headers = jsonData[0];
      // De resterende radene
      const rows = jsonData.slice(1);

      // Kartlegg rader til objekter basert på header
      const employeesData = rows.map((row) => {
        const employee = {};
        headers.forEach((header, index) => {
          // Her antas header-navnene stemmer overens med feltene i din Supabase-tabell
          // Hvis ikke, må du mappe dem manuelt.
          employee[header] = row[index];
        });
        return employee;
      });

      // Bruk upsert for å unngå duplikater (basert på agent_id)
      const { data: upsertData, error } = await supabase
        .from("employees")
        .upsert(employeesData, { onConflict: "agent_id" })
        .select();

      if (error) {
        console.error("Import feilet:", error);
        setMessage("Import feilet: " + error.message);
      } else {
        console.log("Import vellykket:", upsertData);
        setMessage("Import vellykket: " + upsertData.length + " oppføringer behandlet.");
      }
    } catch (err) {
      console.error("Feil under filbehandling:", err);
      setMessage("Feil under filbehandling: " + err.message);
    }
  };

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Importer ansatte
      </Typography>
      <input
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
      />
      <Button variant="contained" onClick={handleImport} sx={{ mt: 2 }}>
        Importer
      </Button>
      {message && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Container>
  );
}

export default ImportEmployees;
