import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { MapPin, Camera, X, Info, CheckCircle2, Shield, Briefcase, HardHat, User, XCircle, AlertTriangle, Clock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState<'admin' | 'officer' | 'worker' | 'citizen'>('citizen');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Staff Registration States
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  
  const isStaffReg = isSignUp && (selectedRole === 'officer' || selectedRole === 'worker');
  const staffRole = selectedRole === 'officer' ? 'pending_officer' : (selectedRole === 'worker' ? 'pending_worker' : '');
  
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [idProofPreview, setIdProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getErrorMessage = (err: any) => {
    const code = err.code;
    if (code === 'auth/wrong-password') return 'Incorrect password. Please try again.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/invalid-credential') return 'Incorrect email or password. Please try again.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
    return err.message || 'Failed to authenticate.';
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      let actualRole = 'citizen';
      if (userCredential.user.email === 'saketsagar004@gmail.com') actualRole = 'super_admin';
      if (userDoc.exists()) {
        actualRole = userDoc.data().role;
      }
      
      if (selectedRole === 'admin' && actualRole !== 'super_admin') {
        setError("Please enter a registered Admin email address.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }
      if (selectedRole === 'officer' && actualRole !== 'officer' && actualRole !== 'pending_officer' && actualRole !== 'super_admin') {
        setError("Please enter a registered Officer email address.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }
      if (selectedRole === 'worker' && actualRole !== 'worker' && actualRole !== 'pending_worker' && actualRole !== 'super_admin') {
        setError("Please enter a registered Worker email address.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }
      if (selectedRole === 'citizen' && ['officer', 'pending_officer', 'worker', 'pending_worker'].includes(actualRole)) {
        setError("Please enter a valid registered email address.");
        await signOut(auth);
        setIsLoading(false);
        return;
      }

      navigate('/map');
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdProofFile(file);
      const reader = new FileReader();
      reader.onload = () => setIdProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateStaffEmail = (emailStr: string) => {
    const e = emailStr.toLowerCase().trim();
    if (e === 'saketsagar004@gmail.com') return true;
    return e.endsWith('.gov.in') || 
           e.endsWith('@gov.in') || 
           e.endsWith('.nic.in') || 
           e.endsWith('@nic.in') || 
           e.endsWith('.gov');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        if (isStaffReg) {
          if (!department) {
            setError('Please select your department.');
            setIsLoading(false);
            return;
          }
          if (!validateStaffEmail(email)) {
            setEmailError(`Invalid email. Please use your official government email address (e.g. name@pwd.maharashtra.gov.in)`);
            setIsLoading(false);
            return;
          }
          if (!idProofFile) {
            setError('Please upload your ID proof.');
            setIsLoading(false);
            return;
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: fullName });
        
        const isOwner = userCredential.user.email === 'saketsagar004@gmail.com';
        
        let role = isOwner ? 'super_admin' : 'citizen';
        let idProofUrl = '';
        let dept = undefined;
        let empId = undefined;
        let approvedByAdmin = isOwner ? true : false;

        if (isStaffReg) {
          role = isOwner ? 'super_admin' : staffRole;
          dept = department;
          empId = employeeId;
          
          if (idProofFile) {
            const fileExt = idProofFile.name.split('.').pop() || 'jpg';
            const fileName = `id_proofs/${Date.now()}_${userCredential.user.uid}.${fileExt}`;
            const storageRef = ref(storage, fileName);
            const snapshot = await uploadBytesResumable(storageRef, idProofFile);
            idProofUrl = await getDownloadURL(snapshot.ref);
          }
        } else {
            approvedByAdmin = true; // Citizens are auto-approved
        }

        const userProfile = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          displayName: fullName,
          photoURL: '',
          role: role,
          approvedByAdmin,
          appliedAt: Date.now(),
          ...(dept ? { department: dept } : {}),
          ...(empId ? { employeeId: empId } : {}),
          ...(idProofUrl ? { idProofUrl } : {})
        };

        // Create the user document immediately
        await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
        
        if (isStaffReg && !isOwner) {
          setError("Your account is pending admin approval. Please wait.");
          await signOut(auth);
          setIsLoading(false);
          return;
        }
        
        navigate('/map');
      } else {
        if (selectedRole === 'admin' && email !== 'saketsagar004@gmail.com') {
          setError("Please enter a registered Admin email address.");
          setIsLoading(false);
          return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            const actualRole = data.role;
            
            if (selectedRole === 'admin' && actualRole !== 'super_admin') {
              setError("Please enter a registered Admin email address.");
              await signOut(auth);
              setIsLoading(false);
              return;
            }
            if (selectedRole === 'officer' && actualRole !== 'officer' && actualRole !== 'pending_officer' && actualRole !== 'super_admin') {
              setError("Please enter a registered Officer email address.");
              await signOut(auth);
              setIsLoading(false);
              return;
            }
            if (selectedRole === 'worker' && actualRole !== 'worker' && actualRole !== 'pending_worker' && actualRole !== 'super_admin') {
              setError("Please enter a registered Worker email address.");
              await signOut(auth);
              setIsLoading(false);
              return;
            }

            if ((actualRole === 'pending_officer' || actualRole === 'pending_worker') && !data.approvedByAdmin) {
                setError(`Your ${selectedRole} account is pending admin approval.`);
                await signOut(auth);
                setIsLoading(false);
                return;
            }
        }
        navigate('/map');
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first to reset password.');
      return;
    }
    try {
      setError('');
      setSuccess('');
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[680px] flex flex-col items-center justify-center my-8">
      <div 
        className="mb-[32px] mx-auto flex flex-col items-center justify-center text-center"
        style={{
          background: 'linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%)',
          borderRadius: '50px',
          padding: '18px 56px',
          boxShadow: '0 4px 20px rgba(255,153,51,0.15)',
          width: 'fit-content'
        }}
      >
        <h1 className="text-[34px] font-[800] tracking-[-0.5px] text-[#1A1A2E] leading-none m-0">
          Civic Saathi
        </h1>
        <p className="text-[17px] font-[600] text-[#374151] mt-[8px] m-0">
          AI Companion for a Better Tomorrow
        </p>
      </div>

      <div 
        className="w-full rounded-2xl overflow-hidden p-8 space-y-6 border border-slate-200/60"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,250,245,0.92) 100%)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(255,153,51,0.12)'
        }}
      >
        <div className="space-y-3 mb-6 pt-2">
        <p className="text-[15px] font-semibold text-[#111827] text-center">I am signing in as:</p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => { setSelectedRole('admin'); setIsSignUp(false); setError(''); }}
            className={`h-14 rounded-xl flex items-center justify-center transition-colors uppercase tracking-[1px] font-bold text-[16px] ${selectedRole === 'admin' ? 'border-[#312E81] border-2 bg-[#312E81] text-white' : 'border-slate-300 border text-[#312E81] bg-white hover:bg-slate-50'}`}
          >
            ADMIN
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { setSelectedRole('officer'); setIsSignUp(false); setError(''); }}
            className={`h-14 rounded-xl flex items-center justify-center transition-colors uppercase tracking-[1px] font-bold text-[16px] ${selectedRole === 'officer' ? 'border-[#1D4ED8] border-2 bg-[#1D4ED8] text-white' : 'border-slate-300 border text-[#1D4ED8] bg-white hover:bg-slate-50'}`}
          >
            OFFICER
          </button>
          <button
            onClick={() => { setSelectedRole('worker'); setIsSignUp(false); setError(''); }}
            className={`h-14 rounded-xl flex items-center justify-center transition-colors uppercase tracking-[1px] font-bold text-[16px] ${selectedRole === 'worker' ? 'border-[#D97706] border-2 bg-[#D97706] text-white' : 'border-slate-300 border text-[#D97706] bg-white hover:bg-slate-50'}`}
          >
            WORKER
          </button>
          <button
            onClick={() => { setSelectedRole('citizen'); setIsSignUp(false); setError(''); }}
            className={`h-14 rounded-xl flex items-center justify-center transition-colors uppercase tracking-[1px] font-bold text-[16px] ${selectedRole === 'citizen' ? 'border-[#059669] border-2 bg-[#059669] text-white' : 'border-slate-300 border text-[#059669] bg-white hover:bg-slate-50'}`}
          >
            CITIZEN
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {selectedRole !== 'admin' && selectedRole !== 'officer' && selectedRole !== 'worker' ? (
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#3C4043]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-3 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>
        ) : (
           <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-3 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>
        )}

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-y-2.5">
          {isSignUp && (
            <div>
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          )}
          <div>
            <input
              type="email"
              placeholder={selectedRole === 'admin' ? "Admin Email Address" : selectedRole === 'officer' ? "Officer Email Address" : selectedRole === 'worker' ? "Worker Email Address" : "Email Address"}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {isSignUp && isStaffReg && email && validateStaffEmail(email) && (
              <p className="text-xs font-bold text-green-600 mt-1 flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Valid government email
              </p>
            )}
            {emailError && (
              <p className="text-xs font-bold text-red-600 mt-1 flex items-start gap-1">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{emailError}</span>
              </p>
            )}
            {isSignUp && isStaffReg && (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 mt-2">
                <p className="font-bold flex items-center mb-1">
                  <Info className="w-4 h-4 mr-1" /> Official Government Email Required
                </p>
                <p className="mb-1 opacity-90 font-bold">Your email must follow one of these formats:</p>
                <ol className="list-decimal pl-5 mb-2 space-y-1.5 opacity-90 font-medium">
                  <li>name@[department].[state].gov.in<br/>(e.g. name@pwd.rajasthan.gov.in, name@ghmc.telangana.gov.in)</li>
                  <li>name@[organisation].gov.in<br/>(e.g. name@ias.gov.in, name@bmc.gov.in)</li>
                  <li>name@nic.in or name@gov.in</li>
                </ol>
                <p className="opacity-80 font-bold">Personal emails (Gmail, Yahoo, Outlook etc.) are not accepted.</p>
              </div>
            )}
          </div>
          <div className={`grid gap-2.5 ${isSignUp ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            {isSignUp && (
              <div>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            )}
          </div>

          {isSignUp && isStaffReg && (
            <div className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
              <p className="font-bold flex items-center mb-1">
                <AlertTriangle className="w-4 h-4 mr-1.5 shrink-0" /> Pending Approval Notice
              </p>
              <p>Your account will be created but <strong>LOGIN WILL BE BLOCKED</strong> until the Admin approves your role.</p>
            </div>
          )}

          {isSignUp && isStaffReg && (
            <div className="flex flex-col gap-y-2.5 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div>
                <input
                  type="text"
                  placeholder="Employee ID / Badge Number"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                  >
                    <option value="" disabled>Select Department</option>
                    <option value="Public Works">Public Works</option>
                    <option value="Municipal Corporation">Municipal Corporation</option>
                    <option value="Jal Board">Jal Board</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Law & Enforcement">Law & Enforcement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Upload ID Proof</label>
                {!idProofPreview ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex justify-center px-4 py-4 border-2 border-blue-200 border-dashed rounded-xl hover:border-blue-400 hover:bg-blue-100/50 cursor-pointer transition-colors bg-white"
                  >
                    <div className="space-y-1 text-center flex flex-col items-center">
                      <Camera className="h-6 w-6 text-blue-400" />
                      <div className="text-xs font-bold text-blue-600">Click to upload</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={idProofPreview} alt="ID Proof" className="w-full h-32 object-cover" />
                    <button 
                      type="button"
                      onClick={() => {
                        setIdProofFile(null);
                        setIdProofPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-slate-900/60 text-white p-1 rounded-full hover:bg-slate-900/80 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${selectedRole === 'admin' ? 'bg-[#312E81] hover:opacity-90' : selectedRole === 'officer' ? 'bg-[#1D4ED8] hover:opacity-90' : selectedRole === 'worker' ? 'bg-[#D97706] hover:opacity-90' : 'bg-[#059669] hover:opacity-90'}`}
          >
            {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : (selectedRole === 'admin' ? 'Sign In as ADMIN' : selectedRole === 'officer' ? 'Sign In as OFFICER' : selectedRole === 'worker' ? 'Sign In as WORKER' : 'Sign In as CITIZEN'))}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-4">
          {!isSignUp && (
            <button
              onClick={handleForgotPassword}
              type="button"
              className="text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Forgot Password?
            </button>
          )}
          {selectedRole !== 'admin' && (
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setEmailError('');
                setSuccess('');
              }}
              type="button"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              {isSignUp 
                ? "Already have an account? Sign In" 
                : selectedRole === 'officer' 
                  ? "Don't have an officer account? Register" 
                  : selectedRole === 'worker' 
                    ? "Don't have a worker account? Register" 
                    : "Don't have an account? Sign Up"}
            </button>
          )}
        </div>

        {error && (
          <div className={`text-[15px] font-semibold text-center p-3 rounded-lg border flex items-center justify-center gap-2 ${error.includes('pending') ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-100'}`}>
            {error.includes('pending') && <Clock className="w-4 h-4 shrink-0" />}
            <span>{error}</span>
          </div>
        )}
        {success && (
          <p className="text-xs font-bold text-green-600 text-center bg-green-50 p-3 rounded-lg border border-green-100">
            {success}
          </p>
        )}
      </div>

      <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center gap-3 text-center">
        <img 
          src="/profile.jpg" 
          alt="Saket Sagar" 
          className="w-36 h-36 rounded-full border-2 border-blue-100 shadow-sm object-cover object-top"
        />
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Developer & Owner</p>
          <p className="text-xl font-bold text-slate-800 tracking-tight">Saket Sagar</p>
        </div>
      </div>
      </div>
    </div>
  );
}
