import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../firebase';
import { Map, PlusCircle, List, LogOut, Menu, X, User, Info, ShieldAlert, Users, ClipboardCheck, Briefcase, Mail, Linkedin } from 'lucide-react';
import React, { useState } from 'react';
import clsx from 'clsx';
import { UserRole } from '../types';
import Notifications from './Notifications';

export default function Layout() {
  const { user, profile, activeRole, setDemoRole, demoRole, demoDepartment, setDemoDepartment } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAdminDenied, setShowAdminDenied] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleSignOut = () => {
    auth.signOut();
    navigate('/login');
  };

  const exitDemoMode = () => {
    setDemoRole(null);
    if (setDemoDepartment) setDemoDepartment(null);
    navigate('/admin-panel');
  };

  const isOwner = user?.email === 'saketsagar004@gmail.com';

  const getNavLinks = () => {
    let links: any[] = [];
    switch (activeRole) {
      case 'super_admin':
        links = [
          { name: 'Map', path: '/map', icon: Map },
          { name: 'Workforce Management', path: '/workforce', icon: Users },
          { name: 'Sign-in Approvals', path: '/approvals', icon: ClipboardCheck },
        ];
        break;
      case 'officer':
        links = [
          { name: 'Map', path: '/map', icon: Map },
          { name: 'Issue Dashboard', path: '/officer-dashboard', icon: List },
          { name: 'My Department', path: '/my-department', icon: Briefcase },
        ];
        break;
      case 'worker':
        links = [
          { name: 'Map', path: '/map', icon: Map },
          { name: 'My Assigned Work', path: '/worker-dashboard', icon: Briefcase },
        ];
        break;
      case 'citizen':
      default:
        links = [
          { name: 'Map', path: '/map', icon: Map },
          { name: 'Report New Issue', path: '/report', icon: PlusCircle },
          { name: 'My Reports', path: '/my-reports', icon: List },
          { name: 'My Profile', path: '/profile', icon: User },
        ];
        break;
    }
    
    links.push({ name: 'About Civic Saathi', path: '/about', icon: Info });
    
    if (isOwner && !links.some(l => l.path === '/admin-panel')) {
      links.push({ name: 'Admin Panel', path: '/admin-panel', icon: ShieldAlert });
    } else if (activeRole === 'super_admin' && !links.some(l => l.path === '/admin-panel')) {
      links.push({ name: 'Admin Panel', path: '/admin-panel', icon: ShieldAlert });
    }
    
    return links;
  };

  const navLinks = getNavLinks();

  const handleAdminPanelClick = (e: React.MouseEvent) => {
    if (!isOwner && activeRole !== 'super_admin') {
      e.preventDefault();
      setShowAdminDenied(true);
    }
  };

  if (!user) {
    return (
      <div 
        className="min-h-screen flex flex-col relative"
        style={location.pathname === '/login' || location.pathname === '/' ? { background: 'linear-gradient(180deg, #FFFFFF 0%, #FFEEDD 8%, #FF9933 22%, #FFAB5C 38%, #E8D5F5 60%, #D8E0FB 80%, #FFFFFF 100%)' } : { background: '#f8fafc' }}
      >
        <nav 
          className="sticky top-0 z-[100]"
          style={{
            background: 'transparent'
          }}
        >
          <div className="w-full mx-auto px-4 sm:px-6 pt-4 flex justify-center">
            <div 
              className="w-full max-w-4xl flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%)',
                borderRadius: '50px',
                padding: '14px 32px',
                boxShadow: '0 4px 20px rgba(255,153,51,0.15)',
              }}
            >
              <Link to="/" className="whitespace-nowrap flex items-center hover:opacity-80 transition-opacity">
                <span className="text-[20px] font-[700] text-[#1A1A2E] tracking-tight">Civic Saathi</span>
              </Link>
              <button 
                onClick={() => setShowContactModal(true)}
                className="hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                <span className="text-[20px] font-[700] text-[#1A1A2E] tracking-tight">Contact Us</span>
              </button>
            </div>
          </div>
        </nav>
        <div className="flex-1 flex items-center justify-center p-4">
          <Outlet />
        </div>

        {showContactModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowContactModal(false)}
            />
            <div 
              className="relative rounded-2xl p-8 border border-white/40 shadow-2xl flex flex-col items-center gap-6 text-center max-w-md w-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,250,245,0.92) 100%)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <button 
                onClick={() => setShowContactModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <img 
                src="/profile.jpg" 
                alt="Saket Sagar" 
                className="w-48 h-48 rounded-full border-4 border-blue-50/50 shadow-lg object-cover object-top"
              />
              <div className="flex-1 w-full">
                <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Owner & Developer</h2>
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight mb-4">Saket Sagar</h3>
                <div className="flex flex-col gap-3 justify-center items-center w-full">
                  <a href="mailto:saketsagar004@gmail.com" className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 font-medium transition-colors bg-white/50 py-2 px-4 rounded-xl w-full justify-center">
                    <Mail className="w-4 h-4" />
                    saketsagar004@gmail.com
                  </a>
                  <a href="https://www.linkedin.com/in/saketsagar" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 font-medium transition-colors bg-white/50 py-2 px-4 rounded-xl w-full justify-center">
                    <Linkedin className="w-4 h-4" />
                    linkedin.com/in/saketsagar
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {demoRole && isOwner && (
        <div className={`px-4 py-2 flex items-center justify-center gap-3 font-bold text-sm z-50 text-white ${demoRole === 'citizen' ? 'bg-[#059669]' : demoRole === 'officer' ? 'bg-[#1D4ED8]' : demoRole === 'worker' ? 'bg-[#D97706]' : 'bg-[#312E81]'}`}>
          <span>Demo Mode Active: You are viewing as {demoDepartment ? `${demoDepartment} ` : ''}{demoRole.charAt(0).toUpperCase() + demoRole.slice(1).replace('_', ' ')}</span>
          <button 
            onClick={exitDemoMode}
            className={`bg-white px-3 py-1 rounded text-xs hover:opacity-90 transition-opacity ${demoRole === 'citizen' ? 'text-[#059669]' : demoRole === 'officer' ? 'text-[#1D4ED8]' : demoRole === 'worker' ? 'text-[#D97706]' : 'text-[#312E81]'}`}
          >
            Exit Demo Mode
          </button>
        </div>
      )}
      <nav 
        className="border-b border-slate-200 sticky top-0 z-[100]"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
        }}
      >
        {profile?.roleRejected && (
          <div className="bg-red-50 text-red-600 px-4 py-2 text-center text-xs font-bold border-b border-red-100 flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Your role request was rejected. Contact admin.
          </div>
        )}
        <div className="w-full px-4 sm:px-6">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/map" className="whitespace-nowrap">
                  <div style={{
                    background: 'linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%)',
                    borderRadius: '50px',
                    padding: '6px 16px',
                    boxShadow: '0 4px 20px rgba(255,153,51,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="text-[18px] font-[700] text-[#1A1A2E] tracking-tight">Civic Saathi</span>
                  </div>
                </Link>
              </div>
              <div className="hidden md:-my-px md:ml-6 md:flex md:space-x-4 lg:space-x-6">
                {navLinks.map((link) => {
                  const isActive = location.pathname.startsWith(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={clsx(
                        isActive
                          ? 'text-blue-600 font-semibold border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-blue-600 font-medium border-b-2 border-transparent hover:border-slate-300',
                        'inline-flex items-center px-1 pt-1 text-xs lg:text-sm whitespace-nowrap transition-colors h-14'
                      )}
                    >
                      {link.name}
                    </Link>
                  );
                })}
                
                {/* Admin Panel Link for all except Super Admin, to show tooltip/modal */}
                {activeRole !== 'super_admin' && !isOwner && (
                  <div className="relative group flex items-center h-14">
                    <button
                      onClick={handleAdminPanelClick}
                      className="text-slate-500 hover:text-blue-600 font-medium border-b-2 border-transparent hover:border-slate-300 inline-flex items-center px-1 pt-1 text-xs lg:text-sm whitespace-nowrap transition-colors h-full"
                    >
                      Admin Panel
                    </button>
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      🔒 Restricted - Admin Only
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
              <div className="flex items-center gap-3">
                {activeRole === 'super_admin' && (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#312E81] text-white uppercase tracking-widest shrink-0">
                    ADMIN
                  </span>
                )}
                {activeRole === 'officer' && (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1D4ED8]/10 text-[#1D4ED8] uppercase tracking-widest shrink-0">
                     {demoRole ? (demoDepartment ? `${demoDepartment} ` : '') : (profile?.department ? `${profile?.department} ` : '')}Officer
                  </span>
                )}
                {activeRole === 'worker' && (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#D97706]/10 text-[#D97706] uppercase tracking-widest shrink-0">
                     {demoRole ? (demoDepartment ? `${demoDepartment} ` : '') : (profile?.department ? `${profile?.department} ` : '')}Worker
                  </span>
                )}
                {activeRole === 'citizen' && (
                  <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#059669]/10 text-[#059669] uppercase tracking-widest shrink-0">
                    CITIZEN
                  </span>
                )}
                
                <Notifications />
                
                <Link to="/profile" className="flex items-center shrink-0">
                  <img
                    className="w-8 h-8 rounded-full border border-slate-300 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`}
                    alt="Profile"
                  />
                </Link>
              </div>

              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="inline-flex items-center justify-center text-[14px] font-medium text-[#DC2626] border border-[#DC2626] rounded-[6px] px-[14px] py-[6px] hover:bg-[#FEF2F2] transition-colors shrink-0"
              >
                Sign Out
              </button>
            </div>
            <div className="-mr-2 flex items-center md:hidden gap-2">
              <Notifications />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="bg-white inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200">
            <div className="pt-2 pb-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
                      'block px-4 py-2 text-sm font-medium flex items-center'
                    )}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {link.name}
                  </Link>
                );
              })}
              {activeRole !== 'super_admin' && !isOwner && (
                <button
                  onClick={(e) => { setMobileMenuOpen(false); handleAdminPanelClick(e); }}
                  className="text-slate-600 hover:bg-slate-50 hover:text-slate-800 block px-4 py-2 text-sm font-medium w-full text-left flex items-center"
                >
                  <ShieldAlert className="w-5 h-5 mr-3" />
                  Admin Panel (Restricted)
                </button>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSignOutConfirm(true);
                }}
                className="text-red-600 hover:bg-red-50 block px-4 py-2 text-sm font-medium w-full text-left flex items-center"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {showAdminDenied && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowAdminDenied(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">Access Denied</h3>
            <p className="text-slate-600 text-sm mb-6">This section is only for the platform administrator.</p>
            <button
              onClick={() => setShowAdminDenied(false)}
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 font-bold text-sm hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowSignOutConfirm(false)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Sign Out?</h3>
            <p className="text-slate-600 text-sm mb-6">Are you sure you want to sign out of Civic Saathi?</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSignOutConfirm(false);
                  handleSignOut();
                }}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 font-bold text-sm hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 w-full mx-auto overflow-hidden flex flex-col relative ${location.pathname.startsWith('/issue/') ? '' : 'px-4 sm:px-6 py-6'}`}>
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="w-full mx-auto px-4 sm:px-6 flex justify-center">
          <Link to="/about" className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
            About Civic Saathi
          </Link>
        </div>
      </footer>
    </div>
  );
}
