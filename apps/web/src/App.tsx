import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./lib/auth";

import LoginPage from "./routes/auth";
import LeadsIndex from "./routes/leads";
import LeadDetailPage from "./routes/leads/LeadDetail";
import NewLeadPage from "./routes/leads/NewLead";
import AdminPage from "./routes/admin/Admin";
import DashboardPage from "./routes/dashboard/Dashboard";

// Simple guard: requires any authenticated user
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    // Remember where we came from so login can send us back
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root: send to /dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Login is public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Role-based home dashboard */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />

      {/* Leads list */}
      <Route
        path="/leads"
        element={
          <RequireAuth>
            <LeadsIndex />
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

      {/* Admin compliance & ops dashboard */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

