import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './routes/auth';
import DashboardPage from './routes/dashboard/Dashboard';
import LeadsPage from './routes/leads/Leads';
import LeadDetailPage from './routes/leads/LeadDetail';
import CallsPage from './routes/calls/Calls';
import CallDetailPage from './routes/calls/CallDetail';
import TasksPage from './routes/tasks/Tasks';
import CompliancePage from './routes/compliance/Compliance';
import AdminPage from './routes/admin/Admin';
import { AuthProvider, useAuth } from './lib/auth';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '220px', padding: '1rem', background: '#0f172a', color: '#e2e8f0' }}>
        <h2>Elysium-CRM</h2>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/leads">Leads</Link></li>
            <li><Link to="/calls">Calls</Link></li>
            <li><Link to="/tasks">Tasks</Link></li>
            <li><Link to="/compliance">Compliance</Link></li>
            <li><Link to="/admin">Admin</Link></li>
          </ul>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem' }}>{children}</main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/leads/:id" element={<LeadDetailPage />} />
                  <Route path="/calls" element={<CallsPage />} />
                  <Route path="/calls/:id" element={<CallDetailPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/compliance" element={<CompliancePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
