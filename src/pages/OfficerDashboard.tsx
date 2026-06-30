import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { CivicIssueReport } from '../types';
import { ShieldAlert, List, Clock, Loader2, ChevronRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

export default function OfficerDashboard() {
  const { activeRole, profile, demoDepartment } = useAuth();
  const [reports, setReports] = useState<CivicIssueReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      const targetDepartment = demoDepartment || profile?.department;
      if (!targetDepartment) return;
      try {
        const q = query(
          collection(db, 'reports'),
          where('department', '==', targetDepartment)
        );
        const snapshot = await getDocs(q);
        const data: CivicIssueReport[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...(doc.data() as any) } as CivicIssueReport));
        // Sort locally by timestamp desc
        data.sort((a, b) => b.timestamp - a.timestamp);
        setReports(data);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    }

    if (activeRole === 'officer' && (demoDepartment || profile?.department)) {
      fetchReports();
    }
  }, [activeRole, profile, demoDepartment]);

  if (activeRole !== 'officer') {
    if (activeRole === 'super_admin' || activeRole === 'admin') {
      return <Navigate to="/admin-panel" replace />;
    }
    return <Navigate to="/map" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <List className="w-6 h-6 text-blue-600" />
          Issue Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage and assign issues reported to {profile?.department}.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <th className="p-4">Issue ID / Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Status</th>
                <th className="p-4">Assigned Worker</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No issues found for your department.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={report.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="text-sm font-bold text-slate-800">{report.category}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{report.id?.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-700 max-w-[200px] truncate" title={report.address}>
                        {report.address || `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                        report.severity === 'High' ? 'bg-red-100 text-red-700' :
                        report.severity === 'Medium' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {report.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {report.assignedWorkerName ? (
                        <p className="text-sm font-medium text-slate-800">{report.assignedWorkerName}</p>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        to={`/issue/${report.id}`}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-bold"
                      >
                        Manage <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
