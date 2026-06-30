import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile } from '../types';
import { ShieldAlert, CheckCircle, XCircle, Loader2, ClipboardCheck } from 'lucide-react';

export default function Approvals() {
  const { activeRole } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const userQ = query(collection(db, 'users'), where('role', 'in', ['pending_officer', 'pending_worker']));
        const userSnapshot = await getDocs(userQ);
        const fetchedUsers: UserProfile[] = [];
        userSnapshot.forEach((doc) => {
          fetchedUsers.push(doc.data() as UserProfile);
        });
        setPendingUsers(fetchedUsers);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (activeRole === 'super_admin') {
      fetchData();
    }
  }, [activeRole]);

  const handleApproveRole = async (userId: string, requestedRole: string) => {
    setActionLoading(userId);
    try {
      const newRole = requestedRole === 'pending_officer' ? 'officer' : 'worker';
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        roleRejected: false,
        approvedByAdmin: true
      });
      
      await addDoc(collection(db, 'notifications'), {
        uid: userId,
        title: 'Role Approved',
        message: `Your request for ${newRole} role has been approved by the Admin. You can now access all features.`,
        timestamp: Date.now(),
        read: false,
        type: 'admin_approval'
      });

      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
    } catch (error) {
      console.error("Error approving role:", error);
      alert("Failed to approve role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRole = async (userId: string) => {
    const reason = window.prompt("Please provide a reason for rejection:");
    if (reason === null) return;

    setActionLoading(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'citizen',
        roleRejected: true,
        approvedByAdmin: true // They are approved as citizen now
      });

      await addDoc(collection(db, 'notifications'), {
        uid: userId,
        title: 'Role Request Rejected',
        message: `Your request for officer/worker role was rejected. Reason: ${reason || 'Not specified'}. You have been assigned the Citizen role.`,
        timestamp: Date.now(),
        read: false,
        type: 'admin_approval'
      });

      setPendingUsers(prev => prev.filter(u => u.uid !== userId));
    } catch (error) {
      console.error("Error rejecting role:", error);
      alert("Failed to reject role");
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

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" />
          Sign-in Approvals
        </h1>
        <p className="text-slate-500 text-sm mt-1">Review and approve pending registration requests for Officers and Workers.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center">
            Pending Requests ({pendingUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Requested Role</th>
                <th className="p-4">Department</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">ID Proof</th>
                <th className="p-4">Applied On</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pendingUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No pending approval requests.
                  </td>
                </tr>
              ) : (
                pendingUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-800">{user.displayName}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                        user.role === 'pending_officer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {user.role === 'pending_officer' ? 'Officer' : 'Worker'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-slate-700">{user.department}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-slate-500 font-mono">{user.employeeId}</p>
                    </td>
                    <td className="p-4">
                      {user.idProofUrl ? (
                        <a href={user.idProofUrl} target="_blank" rel="noreferrer" className="block relative w-12 h-8 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity">
                          <img src={user.idProofUrl} alt="ID Proof" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {user.appliedAt ? new Date(user.appliedAt).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleApproveRole(user.uid, user.role)}
                        disabled={actionLoading === user.uid}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 mr-1" /> Approve</>}
                      </button>
                      <button
                        onClick={() => handleRejectRole(user.uid)}
                        disabled={actionLoading === user.uid}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <><XCircle className="w-3 h-3 mr-1" /> Reject</>}
                      </button>
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
