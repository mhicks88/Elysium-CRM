import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./lib/auth";
import LoginPage from "./routes/auth";
import CompliancePage from "./routes/compliance";
import LeadsPage from "./routes/leads";
import LeadDetailPage from "./routes/leads/LeadDetail";
import NewLeadPage from "./routes/leads/NewLead";

type ProtectedRouteProps = {
  children: React.ReactElement;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Simple inline dashboard for now
const DashboardPage: React.FC = () => {
  return (
    <div style={{ padding: "1.5rem" }}>
      <h1>Elysium CRM Dashboard</h1>
      <p>Welcome! You are logged in.</p>
    </div>
  );
};

const AppShell: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/leads/new" element={<NewLeadPage />} />
      <Route path="/leads/:id" element={<LeadDetailPage />} />
      {/* Future: add /calls, /tasks, etc. routes here */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />
          {/* Protected app */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

