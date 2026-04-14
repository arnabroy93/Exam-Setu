import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (role: UserRole) => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const email = firebaseUser.email || '';

      const isAuthorized = email.endsWith('@anudip.org') || 
                           email === 'arnabredmi3sprime@gmail.com' || 
                           email === 'arnabsukanya@gmail.com';

      if (!isAuthorized) {
        await firebaseSignOut(auth);
        const error: any = new Error('Not authorised');
        error.code = 'auth/not-authorized';
        throw error;
      }
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      const defaultAdmins = ['arnab.roy@anudip.org', 'piem@anudip.org'];
      const defaultExaminers = ['rashmi.mukherjee@anudip.org'];

      if (!userDoc.exists()) {
        let finalRole = role;
        
        // If trying to sign up as admin but not in default list, force to student
        if (role === 'admin' && !defaultAdmins.includes(firebaseUser.email || '')) {
          finalRole = 'student';
        }

        // If trying to sign up as examiner but not in default list, force to student
        if (role === 'examiner' && !defaultExaminers.includes(firebaseUser.email || '')) {
          finalRole = 'student';
        }

        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'User',
          role: finalRole,
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, newProfile);
        setProfile(newProfile);
      } else {
        const existingProfile = userDoc.data() as UserProfile;
        
        // Always update basic info to ensure it's fresh and recorded
        const updates: Partial<UserProfile> = {
          displayName: firebaseUser.displayName || existingProfile.displayName,
          email: firebaseUser.email || existingProfile.email,
        };

        // Auto-upgrade logic for default roles if they exist but have wrong role
        if (defaultAdmins.includes(firebaseUser.email || '') && existingProfile.role !== 'admin') {
          updates.role = 'admin';
        } else if (defaultExaminers.includes(firebaseUser.email || '') && existingProfile.role !== 'examiner' && existingProfile.role !== 'admin') {
          updates.role = 'examiner';
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(userDocRef, updates);
          setProfile({ ...existingProfile, ...updates } as UserProfile);
        } else {
          setProfile(existingProfile);
        }
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/cancelled-popup-request') {
        // This happens if multiple popups are requested, we can ignore it or log it
        console.warn('Multiple popup requests detected.');
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
        // These are expected user/browser behaviors, throw them to be handled by UI
        throw error;
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
