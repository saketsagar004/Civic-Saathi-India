import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { CivicIssueReport, UserRole } from '../types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert, Settings, Clock, CheckCircle } from 'lucide-react';

export default function Admin() {
  const { activeRole, profile, setDemoRole, demoRole, demoDepartment, setDemoDepartment } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<CivicIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  
  const isSuperAdmin = profile?.email === 'saketsagar004@gmail.com';

  const exitDemoMode = () => {
    setDemoRole(null);
    setShowDemoOptions(false);
    if (setDemoDepartment) setDemoDepartment(null);
    navigate('/admin-panel');
  };

  useEffect(() => {
    async function fetchReports() {
      if (!isSuperAdmin) return;
      try {
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedReports: CivicIssueReport[] = [];
        querySnapshot.forEach((doc) => {
          fetchedReports.push({ id: doc.id, ...doc.data() } as CivicIssueReport);
        });
        setReports(fetchedReports);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-600 mt-2">This section is only for the platform administrator.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Admin Panel
          </h1>
          <p className="text-slate-500 text-sm mt-1">Platform configuration, testing tools, and system overview.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-500 mb-4">
          Demo Mode
        </h2>
        <p className="text-slate-600 text-sm mb-6 max-w-2xl">
          Use these options to preview the application as different user roles. 
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {!demoRole && !showDemoOptions && (
            <>
              <div className="px-4 py-2 border border-slate-200 bg-slate-50 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2">
                Admin (Active)
              </div>
              <span className="text-slate-400 text-sm">or</span>
              <button
                onClick={() => setShowDemoOptions(true)}
                className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold text-sm transition-colors"
              >
                Enable Demo Mode
              </button>
            </>
          )}
          
          {(demoRole || showDemoOptions) && (
            <button
              onClick={exitDemoMode}
              className="px-4 py-2 border border-red-600 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-sm transition-colors"
            >
              Exit Demo Mode
            </button>
          )}
        </div>

        {(showDemoOptions || demoRole) && (
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            {(['officer', 'worker', 'citizen'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => { setDemoRole(role); setDemoDepartment(null); }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  demoRole === role 
                    ? role === 'officer' ? 'border-[#1D4ED8] bg-[#1D4ED8]/10 ring-1 ring-[#1D4ED8]' 
                      : role === 'worker' ? 'border-[#D97706] bg-[#D97706]/10 ring-1 ring-[#D97706]'
                      : 'border-[#059669] bg-[#059669]/10 ring-1 ring-[#059669]'
                    : role === 'officer' ? 'border-slate-200 hover:border-[#1D4ED8] hover:bg-[#1D4ED8]/5'
                      : role === 'worker' ? 'border-slate-200 hover:border-[#D97706] hover:bg-[#D97706]/5'
                      : 'border-slate-200 hover:border-[#059669] hover:bg-[#059669]/5'
                }`}
              >
                <div className="font-bold text-slate-900 mb-1 capitalize flex items-center gap-2">
                  {role === 'officer' ? '1. ' : role === 'worker' ? '2. ' : '3. '}
                  {demoRole === role && demoDepartment && (role === 'officer' || role === 'worker') 
                    ? `${demoDepartment} ${role}` 
                    : role.replace('_', ' ')}
                </div>
              </button>
            ))}
          </div>
        )}

        {demoRole && (
          <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl">
            {demoRole === 'officer' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Department context:</label>
                  <select 
                    value={demoDepartment || ''} 
                    onChange={(e) => setDemoDepartment(e.target.value)}
                    className="w-full sm:w-64 p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select a department...</option>
                    <option value="Public Works">Public Works</option>
                    <option value="Municipal Corporation">Municipal Corporation</option>
                    <option value="Jal Board">Jal Board</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Law & Enforcement">Law & Enforcement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <p className="text-sm text-slate-600"><strong className="text-slate-800">You can now:</strong> Verify issues, Assign workers, Review resolution photos</p>
              </>
            )}
            
            {demoRole === 'worker' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Department context:</label>
                  <select 
                    value={demoDepartment || ''} 
                    onChange={(e) => setDemoDepartment(e.target.value)}
                    className="w-full sm:w-64 p-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select a department...</option>
                    <option value="Public Works">Public Works</option>
                    <option value="Municipal Corporation">Municipal Corporation</option>
                    <option value="Jal Board">Jal Board</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Law & Enforcement">Law & Enforcement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <p className="text-sm text-slate-600"><strong className="text-slate-800">You can now:</strong> Accept assignments, Mark in progress, Submit resolution proof</p>
              </>
            )}
            
            {demoRole === 'citizen' && (
              <p className="text-sm text-slate-600"><strong className="text-slate-800">You can now:</strong> Report issues, Verify community issues, Confirm resolutions, Give feedback</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center">
            SYSTEM OVERVIEW
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <th className="p-4">Issue Details</th>
                <th className="p-4">Location</th>
                <th className="p-4">Department</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={report.imageUrl} 
                        alt="Issue" 
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{report.category}</p>
                        <p className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(report.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-slate-700 max-w-[200px] truncate" title={report.address}>
                      {report.address || `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {report.departmentInfo?.departmentShortName || report.department}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                      report.status === 'Resolved' || report.status === 'Closed' ? 'bg-green-100 text-green-700' :
                      report.status === 'Verified' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link 
                      to={`/issue/${report.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No reports found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
