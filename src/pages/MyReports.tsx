import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { CivicIssueReport } from '../types';
import { MapPin, Trash2 } from 'lucide-react';

export default function MyReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<CivicIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportToDelete, setReportToDelete] = useState<CivicIssueReport | null>(null);

  useEffect(() => {
    async function fetchReports() {
      if (!user) return;
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedReports: CivicIssueReport[] = [];
        querySnapshot.forEach((doc) => {
          fetchedReports.push({ id: doc.id, ...doc.data() } as CivicIssueReport);
        });
        
        // Sort client side since we'd need a composite index for where + orderBy
        fetchedReports.sort((a, b) => b.timestamp - a.timestamp);
        
        setReports(fetchedReports);
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [user]);

  const handleDelete = async () => {
    if (!reportToDelete) return;
    try {
      if (reportToDelete.imageUrl) {
        try {
          const imageRef = ref(storage, reportToDelete.imageUrl);
          await deleteObject(imageRef);
        } catch (imgError) {
          console.error("Error deleting image:", imgError);
        }
      }
      await deleteDoc(doc(db, 'reports', reportToDelete.id));
      setReports(reports.filter(r => r.id !== reportToDelete.id));
      setReportToDelete(null);
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-200">
        <h3 className="mt-2 text-sm font-bold text-slate-800">No reports</h3>
        <p className="mt-1 text-sm text-slate-500">You haven't submitted any civic issues yet.</p>
        <div className="mt-6">
          <Link
            to="/report"
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            Report an issue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">My Reports</h1>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex flex-col p-3 overflow-hidden relative group">
            <div className="flex gap-3 mb-2">
              <img 
                src={report.imageUrl} 
                alt={report.category} 
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-slate-100"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                    report.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                    report.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                    report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {report.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(report.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight truncate pr-6">{report.category}</h3>
                <p className="text-xs text-slate-500 truncate">{report.description}</p>
              </div>
            </div>
            
            <button
              onClick={() => setReportToDelete(report)}
              className="absolute top-9 right-3 text-slate-400 hover:text-red-600 transition-colors bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100"
              title="Delete Report"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                    report.status === 'Reported' ? 'bg-blue-100 text-blue-700' :
                    report.status === 'Verified' ? 'bg-indigo-100 text-indigo-700' :
                    report.status === 'Assigned' ? 'bg-purple-100 text-purple-700' :
                    report.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 
                    report.status === 'Pending Verification' ? 'bg-orange-100 text-orange-700' : 
                    report.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' :
                    report.status === 'Closed' ? 'bg-slate-100 text-slate-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {report.status}
                  </span>
              </div>
              <div className="flex items-center gap-2">
                <Link 
                  to={`/issue/${report.id}`}
                  className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest flex items-center bg-slate-50 px-2 py-1 rounded"
                >
                  View
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setReportToDelete(report);
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 uppercase tracking-widest flex items-center bg-white px-2 py-1 rounded border border-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reportToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4" onClick={() => setReportToDelete(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Report?</h3>
            <p className="text-slate-600 text-sm mb-6">Are you sure you want to delete this report? This action cannot be undone.</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setReportToDelete(null)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 font-bold text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
