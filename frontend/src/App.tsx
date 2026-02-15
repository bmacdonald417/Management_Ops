import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import ContractDetail from './pages/ContractDetail';
import Compliance from './pages/Compliance';
import Financials from './pages/Financials';
import Cyber from './pages/Cyber';
import GovernanceEngine from './pages/GovernanceEngine';
import GovernanceSolicitations from './pages/GovernanceSolicitations';
import GovernanceSolicitationNew from './pages/GovernanceSolicitationNew';
import GovernanceSolicitationReview from './pages/GovernanceSolicitationReview';
import GovernanceClauseLibrary from './pages/GovernanceClauseLibrary';
import GovernanceReports from './pages/GovernanceReports';
import GovernanceAuditTrail from './pages/GovernanceAuditTrail';
import GovernancePacketExport from './pages/GovernancePacketExport';
import GovernanceMaturity from './pages/GovernanceMaturity';
import GovernanceAutoBuilder from './pages/GovernanceAutoBuilder';
import GovernanceAutoBuilderManual from './pages/GovernanceAutoBuilderManual';
import GovernanceAutoBuilderEvidence from './pages/GovernanceAutoBuilderEvidence';
import GovernanceAutoBuilderAppendices from './pages/GovernanceAutoBuilderAppendices';
import AdminComplianceRegistry from './pages/AdminComplianceRegistry';
import Login from './pages/Login';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="governance-engine" element={<GovernanceEngine />} />
        <Route path="governance-engine/solicitations" element={<GovernanceSolicitations />} />
        <Route path="governance-engine/solicitations/new" element={<GovernanceSolicitationNew />} />
        <Route path="governance-engine/solicitations/:id" element={<GovernanceSolicitationReview />} />
        <Route path="governance-engine/solicitations/:id/review" element={<GovernanceSolicitationReview />} />
        <Route path="governance-engine/solicitations/:id/audit" element={<GovernanceAuditTrail />} />
        <Route path="governance-engine/solicitations/:id/export" element={<GovernancePacketExport />} />
        <Route path="governance-engine/clause-library" element={<GovernanceClauseLibrary />} />
        <Route path="governance-engine/maturity" element={<GovernanceMaturity />} />
        <Route path="governance-engine/auto-builder" element={<GovernanceAutoBuilder />} />
        <Route path="governance-engine/auto-builder/manual" element={<GovernanceAutoBuilderManual />} />
        <Route path="governance-engine/auto-builder/evidence" element={<GovernanceAutoBuilderEvidence />} />
        <Route path="governance-engine/auto-builder/appendices" element={<GovernanceAutoBuilderAppendices />} />
        <Route path="governance-engine/reports" element={<GovernanceReports />} />
        <Route path="admin/compliance-registry" element={<AdminComplianceRegistry />} />
        <Route path="financials" element={<Financials />} />
        <Route path="cyber" element={<Cyber />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
