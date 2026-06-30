import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Award, FileText, CheckCircle, ShieldCheck, Star, Zap, Clock, Activity, MapPin } from 'lucide-react';
import { CivicIssueReport } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Link } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function Profile() {
  const { user } = useAuth();
  const [reportsCount, setReportsCount] = useState(0);
  const [verificationsCount, setVerificationsCount] = useState(0);
  const [reports, setReports] = useState<CivicIssueReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      try {
        const qReports = query(collection(db, 'reports'), where('userId', '==', user.uid));
        const reportsSnapshot = await getDocs(qReports);
        const fetchedReports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CivicIssueReport));
        // Sort in memory as composite index might be needed otherwise
        fetchedReports.sort((a, b) => b.timestamp - a.timestamp);
        
        setReportsCount(fetchedReports.length);
        setReports(fetchedReports);

        // Fetch verifications (reports upvoted by user)
        const qVerifications = query(collection(db, 'reports'), where('upvotedBy', 'array-contains', user.uid));
        const verificationsSnapshot = await getDocs(qVerifications);
        setVerificationsCount(verificationsSnapshot.size);
      } catch (err) {
        console.error('Error fetching profile stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user]);

  const badges = [
    {
      id: 'first_reporter',
      name: 'First Reporter',
      description: 'Reported your first civic issue',
      icon: Zap,
      earned: reportsCount >= 1,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      id: 'community_hero',
      name: 'Community Hero',
      description: 'Reported 5 or more issues',
      icon: Star,
      earned: reportsCount >= 5,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      id: 'verified_citizen',
      name: 'Verified Citizen',
      description: 'Verified 5 or more community issues',
      icon: ShieldCheck,
      earned: verificationsCount >= 5,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    }
  ];

  // Aggregations for charts
  const categoryCounts = reports.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryData = Object.keys(categoryCounts).map(key => ({ name: key, value: categoryCounts[key] }));

  const severityCounts = reports.reduce((acc, curr) => {
    acc[curr.severity] = (acc[curr.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const severityData = Object.keys(severityCounts).map(key => ({ name: key, count: severityCounts[key] }));

  const statusCounts = reports.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusData = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

  const recentReports = reports.slice(0, 5);

  if (!user) return null;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col space-y-6 pb-12">
      <div className="flex items-center space-x-4 mb-6">
        <img
          className="w-16 h-16 rounded-full border border-slate-300 object-cover"
          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`}
          alt="Profile"
        />
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{user.displayName || 'Citizen'}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <FileText className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-3xl font-bold text-slate-800 tracking-tight">{loading ? '-' : reportsCount}</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Total Reports</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-3xl font-bold text-slate-800 tracking-tight">{loading ? '-' : verificationsCount}</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Verifications Given</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center">
            <Award className="w-4 h-4 mr-2" /> Badges Earned
          </h2>
        </div>
        <div className="p-4 space-y-4 md:flex md:space-y-0 md:space-x-4">
          {badges.map(badge => (
            <div key={badge.id} className={`flex-1 flex items-center p-4 rounded-xl border ${badge.earned ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${badge.earned ? badge.bg : 'bg-slate-200'}`}>
                <badge.icon className={`w-6 h-6 ${badge.earned ? badge.color : 'text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">{badge.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{badge.description}</p>
              </div>
              {!badge.earned && (
                <div className="px-3 py-1 bg-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Locked
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Issues by Category</h2>
          <div className="h-64">
            {reportsCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Issues by Severity</h2>
          <div className="h-64">
            {reportsCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Issues by Status</h2>
          <div className="h-64">
            {reportsCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={5}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center">
              <Activity className="w-4 h-4 mr-2" /> Recent Activity
            </h2>
            <Link to="/my-reports" className="text-xs font-bold text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {recentReports.length > 0 ? (
              <div className="space-y-4">
                {recentReports.map(report => (
                  <Link key={report.id} to={`/issue/${report.id}`} className="block border border-slate-100 p-4 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
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
                          <span className="text-xs text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(report.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mt-2">{report.category}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-1 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 shrink-0" />
                          Lat: {report.location.lat.toFixed(4)}, Lng: {report.location.lng.toFixed(4)}
                        </p>
                      </div>
                      <img src={report.imageUrl} alt={report.category} className="w-12 h-12 rounded-lg object-cover ml-3 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 p-8">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
