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
import LeadImportPage from "./routes/leads/LeadImport";
import AdminPage from "./routes/admin/Admin";
import DashboardPage from "./routes/dashboard/Dashboard";
import CallDetailPage from "./routes/calls/CallDetail";
import CoachingQueuePage from "./routes/calls/CoachingQueue";
import TasksPage from "./routes/tasks/TasksPage";
import ComplianceReportsPage from "./routes/ComplianceReportsPage";

// Simple guard: requires any authenticated user
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
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

      {/* Lead import */}
      <Route
        path="/leads/import"
        element={
          <RequireAuth>
            <LeadImportPage />
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

      {/* Call detail (single call session) */}
      <Route
        path="/calls/:id"
        element={
          <RequireAuth>
            <CallDetailPage />
          </RequireAuth>
        }
      />

      {/* Coaching review queue */}
      <Route
        path="/calls/coaching"
        element={
          <RequireAuth>
            <CoachingQueuePage />
          </RequireAuth>
        }
      />

      {/* Global tasks queue */}
      <Route
        path="/tasks"
        element={
          <RequireAuth>
            <TasksPage />
          </RequireAuth>
        }
      />

      {/* Compliance reports */}
      <Route
        path="/reports/compliance"
        element={
          <RequireAuth>
            <ComplianceReportsPage />
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

