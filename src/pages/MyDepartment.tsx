import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, CivicIssueReport } from '../types';
import { Users, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function MyDepartment() {
  const { activeRole, profile, demoRole, demoDepartment } = useAuth();
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [activeTasks, setActiveTasks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const currentDept = demoRole ? demoDepartment : profile?.department;

  useEffect(() => {
    async function fetchData() {
      if (!currentDept) {
        setWorkers([]);
        setActiveTasks({});
        setLoading(false);
        return;
      }
      try {
        // Fetch workers in same department
        const workQ = query(
          collection(db, 'users'), 
          where('role', '==', 'worker'),
          where('department', '==', currentDept)
        );
        const workSnap = await getDocs(workQ);
        
        const fetchedWorkers: UserProfile[] = [];
        workSnap.forEach(doc => fetchedWorkers.push(doc.data() as UserProfile));
        
        // Fetch active tasks for these workers
        const tasksQ = query(
          collection(db, 'reports'),
          where('department', '==', currentDept),
          where('status', 'in', ['Assigned', 'In Progress', 'Pending Verification'])
        );
        const tasksSnap = await getDocs(tasksQ);
        
        const taskCounts: Record<string, number> = {};
        tasksSnap.forEach(doc => {
          const report = doc.data() as CivicIssueReport;
          if (report.assignedWorkerUid) {
            taskCounts[report.assignedWorkerUid] = (taskCounts[report.assignedWorkerUid] || 0) + 1;
          }
        });

        setWorkers(fetchedWorkers);
        setActiveTasks(taskCounts);
      } catch (error) {
        console.error('Error fetching department data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (activeRole === 'officer') {
      fetchData();
    }
  }, [activeRole, currentDept]);

  if (activeRole !== 'officer') {
    if (activeRole === 'super_admin' || activeRole === 'admin') {
      return <Navigate to="/admin-panel" replace />;
    }
    return <Navigate to="/map" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Ensure minimum 10 rows
  const renderRows = () => {
    const rows = [...workers];
    while (rows.length < 10) {
      rows.push({ uid: `empty-${rows.length}`, email: '', displayName: '', photoURL: '', role: 'worker' } as UserProfile);
    }

    return rows.map((worker, idx) => (
      <tr key={worker.uid} className="hover:bg-slate-50 transition-colors">
        <td className="p-4 text-sm text-slate-500">{idx + 1}</td>
        <td className="p-4">
          <p className="text-sm font-bold text-slate-800">{worker.displayName || '—'}</p>
        </td>
        <td className="p-4 text-sm text-slate-600">{worker.email || '—'}</td>
        <td className="p-4">
          {worker.email ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
              {activeTasks[worker.uid] || 0} tasks
            </span>
          ) : '—'}
        </td>
        <td className="p-4">
          {worker.email ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-green-100 text-green-700">
              Active
            </span>
          ) : '—'}
        </td>
      </tr>
    ));
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          My Department {currentDept ? `(${currentDept})` : ''}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Overview of workers available for assignment in your department.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
            Workers ({workers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="p-4 w-12">#</th>
                <th className="p-4">Worker Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Active Tasks</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {renderRows()}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100">
          Table expands automatically as new workers are added to your department
        </div>
      </div>
    </div>
  );
}
