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
      {/* Root: just send to /leads */}
      <Route path="/" element={<Navigate to="/leads" replace />} />

      {/* Login is public */}
      <Route path="/login" element={<LoginPage />} />

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

      {/* Admin compliance dashboard */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/leads" replace />} />
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

