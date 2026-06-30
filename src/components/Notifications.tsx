import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Bell, CheckCircle2, AlertCircle, Wrench, XCircle, Info, ChevronRight, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Notification } from '../types';

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let notifs: Notification[] = [];
      snapshot.forEach((docSnap) => {
        notifs.push({ id: docSnap.id, ...docSnap.data() } as Notification);
      });
      // Sort locally to avoid requiring composite index
      notifs.sort((a, b) => b.timestamp - a.timestamp);
      // Apply limit locally
      notifs = notifs.slice(0, 20);
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notif: Notification) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    setIsOpen(false);
    if (notif.issueId) {
      navigate(`/issue/${notif.issueId}`);
    } else if (notif.type === 'admin_approval') {
      navigate('/approvals');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    notifications.forEach((n) => {
      if (!n.read) {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      }
    });
    await batch.commit();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'verified':
      case 'resolved':
      case 'closed':
      case 'work_confirmed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'work_started':
      case 'new_assignment':
        return <Wrench className="w-5 h-5 text-blue-600" />;
      case 'photo_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'resolution_submitted':
      case 'new_issue':
      case 'feedback':
      case 'admin_approval':
        return <Info className="w-5 h-5 text-purple-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center">
                  <Check className="w-3 h-3 mr-1" /> Mark all read
                </button>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markAsRead(notif)}
                      className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3 ${!notif.read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="shrink-0 mt-1">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-medium text-slate-400">
                            {notif.issueId ? `Issue #${notif.issueId.slice(-6).toUpperCase()}` : ''} · {formatTime(notif.timestamp)}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 flex items-center">
                            {notif.issueId ? 'View Issue' : 'View'} <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
