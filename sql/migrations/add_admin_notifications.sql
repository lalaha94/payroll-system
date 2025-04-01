CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  agentName TEXT NOT NULL,
  monthYear TEXT NOT NULL,
  approvedAmount NUMERIC NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting_exports (
  id SERIAL PRIMARY KEY,
  agentName TEXT NOT NULL,
  monthYear TEXT NOT NULL,
  approvedAmount NUMERIC NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);
