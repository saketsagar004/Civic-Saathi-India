import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, UserRole, Department } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  activeRole: UserRole;
  setDemoRole: (role: UserRole | null) => void;
  demoRole: UserRole | null;
  demoDepartment: Department | null;
  setDemoDepartment: (dept: Department | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // For Demo Mode
  const [demoRole, setDemoRole] = useState<UserRole | null>(null);
  const [demoDepartment, setDemoDepartment] = useState<Department | null>(null);
  
  const getActiveRole = (): UserRole => {
    if (demoRole) return demoRole;
    if (user?.email === 'saketsagar004@gmail.com') return 'super_admin';
    return profile?.role || "citizen";
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial fetch to ensure creation if missing
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const isOwner = firebaseUser.email === 'saketsagar004@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || '',
            role: isOwner ? 'super_admin' : 'citizen',
            approvedByAdmin: true,
            appliedAt: Date.now()
          };
          await setDoc(userRef, newProfile);
        }

        // Listen for real-time updates
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setDemoRole(null);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, activeRole: getActiveRole(), setDemoRole, demoRole, demoDepartment, setDemoDepartment }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
