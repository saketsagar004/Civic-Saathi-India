import { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import MapPage from './pages/Map';
import Report from './pages/Report';
import MyReports from './pages/MyReports';
import IssueDetail from './pages/IssueDetail';
import Profile from './pages/Profile';
import About from './pages/About';
import Admin from './pages/Admin';
import Workforce from './pages/Workforce';
import Approvals from './pages/Approvals';
import OfficerDashboard from './pages/OfficerDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import MyDepartment from './pages/MyDepartment';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (profile?.status === 'suspended') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="bg-red-50 p-8 rounded-2xl max-w-md w-full text-center border border-red-100 shadow-sm">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">Account Suspended</h2>
          <p className="text-red-600 text-sm mb-6">
            Your account has been suspended. Please contact the administrator.
          </p>
          <button 
            onClick={() => {
              import('./firebase').then(({ auth }) => auth.signOut());
            }}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            <Layout />
          }>
            <Route index element={<Login />} />
          </Route>
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/map" replace />} />
            <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
            <Route path="my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="about" element={<ProtectedRoute><About /></ProtectedRoute>} />
            <Route path="admin-panel" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="workforce" element={<ProtectedRoute><Workforce /></ProtectedRoute>} />
            <Route path="approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
            <Route path="officer-dashboard" element={<ProtectedRoute><OfficerDashboard /></ProtectedRoute>} />
            <Route path="worker-dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
            <Route path="my-department" element={<ProtectedRoute><MyDepartment /></ProtectedRoute>} />
            <Route path="issue/:id" element={<ProtectedRoute><IssueDetail /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
