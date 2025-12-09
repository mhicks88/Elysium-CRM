// apps/web/src/App.tsx

import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";

// Route components
import LeadsPage from "./routes/leads/Leads";
import LeadDetailPage from "./routes/leads/LeadDetail";
import NewLeadPage from "./routes/leads/NewLead";
import AdminPage from "./routes/admin/Admin";
import CompliancePage from "./routes/compliance/Compliance";
// NOTE: we keep CallDetail, drop CallsPage for now
import CallDetailPage from "./routes/calls/CallDetail";
import TasksPage from "./routes/tasks/TasksPage";
import LoginPage from "./routes/auth/Login";
import SignupOrgPage from "./routes/auth/SignupOrg";
import ForgotPasswordPage from "./routes/auth/ForgotPassword";
import ResetPasswordPage from "./routes/auth/ResetPassword";
import Dashboard from "./routes/dashboard/Dashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupOrgPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected app routes */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />

      {/* Leads list */}
      <Route
        path="/leads"
        element={
          <RequireAuth>
            <LeadsPage />
          </RequireAuth>
        }
      />

      {/* New lead */}
      <Route
        path="/leads/new"
        element={
          <RequireAuth>
            <NewLeadPage />
          </RequireAuth>
        }
      />

      {/* Lead detail */}
      <Route
        path="/leads/:id"
        element={
          <RequireAuth>
            <LeadDetailPage />
          </RequireAuth>
        }
      />

      {/* Calls: detail-only route for now */}
      <Route
        path="/calls/:id"
        element={
          <RequireAuth>
            <CallDetailPage />
          </RequireAuth>
        }
      />

      <Route
        path="/tasks"
        element={
          <RequireAuth>
            <TasksPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/compliance"
        element={
          <RequireAuth>
            <CompliancePage />
          </RequireAuth>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

