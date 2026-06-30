import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile } from '../types';
import { ShieldAlert, Users, Ban, XCircle, Loader2, CheckCircle } from 'lucide-react';

export default function Workforce() {
  const { activeRole } = useAuth();
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    userId: string;
    action: 'suspend' | 'remove' | 'reactivate';
    userName: string;
  }>({
    isOpen: false,
    userId: '',
    action: 'suspend',
    userName: ''
  });
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const offQ = query(collection(db, 'users'), where('role', '==', 'officer'));
        const workQ = query(collection(db, 'users'), where('role', '==', 'worker'));

        const [offSnap, workSnap] = await Promise.all([getDocs(offQ), getDocs(workQ)]);
        
        const fetchedOfficers: UserProfile[] = [];
        offSnap.forEach(doc => fetchedOfficers.push(doc.data() as UserProfile));
        setOfficers(fetchedOfficers);

        const fetchedWorkers: UserProfile[] = [];
        workSnap.forEach(doc => fetchedWorkers.push(doc.data() as UserProfile));
        setWorkers(fetchedWorkers);
      } catch (error) {
        console.error('Error fetching workforce:', error);
      } finally {
        setLoading(false);
      }
    }

    if (activeRole === 'super_admin') {
      fetchData();
    }
  }, [activeRole]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleActionClick = (user: UserProfile, action: 'suspend' | 'remove' | 'reactivate') => {
    setConfirmModal({
      isOpen: true,
      userId: user.uid,
      action,
      userName: user.displayName || user.email || 'this user'
    });
  };

  const executeAction = async () => {
    const { userId, action, userName } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setActionLoading(userId);
    
    try {
      if (action === 'suspend') {
        await updateDoc(doc(db, 'users', userId), { status: 'suspended' });
        const updateFn = (prev: UserProfile[]) => prev.map(u => u.uid === userId ? { ...u, status: 'suspended' as const } : u);
        setOfficers(updateFn);
        setWorkers(updateFn);
        setToastMessage(`${userName} has been suspended.`);
      } else if (action === 'reactivate') {
        await updateDoc(doc(db, 'users', userId), { status: 'active' });
        const updateFn = (prev: UserProfile[]) => prev.map(u => u.uid === userId ? { ...u, status: 'active' as const } : u);
        setOfficers(updateFn);
        setWorkers(updateFn);
        setToastMessage(`${userName} has been re-activated.`);
      } else if (action === 'remove') {
        await deleteDoc(doc(db, 'users', userId));
        setOfficers(prev => prev.filter(u => u.uid !== userId));
        setWorkers(prev => prev.filter(u => u.uid !== userId));
        setToastMessage(`${userName} has been removed from the platform.`);
      }
    } catch (error) {
      console.error('Error taking action:', error);
      alert('Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  if (activeRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Ensure minimum 10 rows
  const renderRows = (data: UserProfile[], type: 'officer' | 'worker') => {
    const rows = [...data];
    while (rows.length < 10) {
      rows.push({ uid: `empty-${rows.length}`, email: '', displayName: '', photoURL: '', role: type } as UserProfile);
    }

    return rows.map((user, idx) => (
      <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
        <td className="p-4 text-sm text-slate-500">{idx + 1}</td>
        <td className="p-4">
          <p className="text-sm font-bold text-slate-800">{user.displayName || '—'}</p>
        </td>
        <td className="p-4 text-sm text-slate-600">{user.email || '—'}</td>
        <td className="p-4 text-sm text-slate-600 font-medium">{user.department || '—'}</td>
        {type === 'worker' && <td className="p-4 text-sm text-slate-600">—</td>}
        <td className="p-4">
          {user.email ? (
            user.status === 'suspended' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-orange-100 text-orange-700">
                Suspended
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-green-100 text-green-700">
                Active
              </span>
            )
          ) : '—'}
        </td>
        <td className="p-4 text-right">
          {user.email ? (
            <div className="flex justify-end gap-2">
              {user.status === 'suspended' ? (
                <button 
                  onClick={() => handleActionClick(user, 'reactivate')}
                  disabled={actionLoading === user.uid}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Re-activate"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={() => handleActionClick(user, 'suspend')}
                  disabled={actionLoading === user.uid}
                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Suspend"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => handleActionClick(user, 'remove')}
                disabled={actionLoading === user.uid}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : '—'}
        </td>
      </tr>
    ));
  };

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Workforce Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage active department officers and department workers.</p>
          <div className="flex items-center gap-4 mt-3 text-[13px] text-slate-500">
            <span className="font-bold uppercase tracking-widest text-slate-400 text-[10px]">Actions:</span>
            <span className="flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Suspend: Temporarily disable account access</span>
            <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Remove: Permanently remove from the platform</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Officers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-[#1D4ED8]/10 px-6 py-4 border-b border-[#1D4ED8]/20">
            <h2 className="text-sm font-bold text-[#1D4ED8] uppercase tracking-widest flex items-center">
              <Users className="w-4 h-4 mr-2" /> Department Officers ({officers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {renderRows(officers, 'officer')}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100 mt-auto">
            Table expands automatically as new officers are approved
          </div>
        </div>

        {/* Workers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-[#D97706]/10 px-6 py-4 border-b border-[#D97706]/20">
            <h2 className="text-sm font-bold text-[#D97706] uppercase tracking-widest flex items-center">
              <Users className="w-4 h-4 mr-2" /> Department Workers ({workers.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Assigned Officer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {renderRows(workers, 'worker')}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100 mt-auto">
            Table expands automatically as new workers are approved
          </div>
        </div>
      </div>

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {confirmModal.action === 'suspend' ? 'Suspend Account?' : 
               confirmModal.action === 'remove' ? 'Remove Account?' : 
               'Re-activate Account?'}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {confirmModal.action === 'suspend' 
                ? `Are you sure you want to suspend ${confirmModal.userName}'s account? They will lose access to the platform immediately but their data will be preserved.`
                : confirmModal.action === 'remove'
                ? `Are you sure you want to permanently remove ${confirmModal.userName} from the platform? This action cannot be undone and all their assignments will be cleared.`
                : `Are you sure you want to re-activate ${confirmModal.userName}'s account? They will regain access to the platform.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={!!actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors flex items-center ${
                  confirmModal.action === 'suspend' ? 'bg-orange-600 hover:bg-orange-700' :
                  confirmModal.action === 'remove' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
                disabled={!!actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {confirmModal.action === 'suspend' ? 'Suspend' : 
                 confirmModal.action === 'remove' ? 'Remove' : 
                 'Re-activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
