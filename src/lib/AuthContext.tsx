import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { logUserActivity } from './activityLogger';
import { updateStat } from './stats';

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
        const sessionKey = `acadex_session_profile_${firebaseUser.uid}`;
        const localKey = `acadex_profile_${firebaseUser.uid}`;
        
        // 1. Session Storage check (Fresh session)
        const sessionCached = sessionStorage.getItem(sessionKey);
        if (sessionCached) {
          try {
            const { profile: p, timestamp } = JSON.parse(sessionCached);
            // Session cache good for 4 hours
            if (Date.now() - timestamp < 14400000) {
              setProfile(p);
              setLoading(false);
              return;
            }
          } catch (e) {}
        }

        // 2. Local Storage check (Secondary)
        const cached = localStorage.getItem(localKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setProfile(parsed);
          } catch (e) {}
        }

        // 3. Document fetch (Only if necessary)
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            setProfile(profileData);
            const cacheData = { profile: profileData, timestamp: Date.now() };
            localStorage.setItem(localKey, JSON.stringify(profileData));
            sessionStorage.setItem(sessionKey, JSON.stringify(cacheData));
          } else {
            setProfile(null);
          }
        } catch (error: any) {
          if (error.message?.includes('Quota exceeded')) {
            console.warn('Quota reached. Using cached profile.');
            // Profile is already set from localStorage check above if available
          } else {
            console.error('Error fetching profile:', error);
            setProfile(null);
          }
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
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err: any) {
        if (err.message?.includes('Quota exceeded')) {
          const cached = localStorage.getItem(`acadex_profile_${firebaseUser.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            setProfile(parsed);
            await logUserActivity(parsed, 'LOGIN', 'User logged in via cached profile due to quota limits');
            setLoading(false);
            return;
          }
        }
        throw err;
      }
      
      const defaultAdmins = ['arnab.roy@anudip.org', 'piem@anudip.org'];
      const defaultExaminers = ['rashmi.mukherjee@anudip.org'];

      if (!userDoc.exists()) {
        let finalRole = role;
        
        if (role === 'admin' && !defaultAdmins.includes(firebaseUser.email || '')) {
          finalRole = 'student';
        }

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
        
        // Update global counters atomically
        await Promise.all([
          updateStat('totalUsers', 1),
          finalRole === 'student' ? updateStat('totalStudents', 1) : 
          finalRole === 'examiner' ? updateStat('totalExaminers', 1) : Promise.resolve()
        ]);

        setProfile(newProfile);
        localStorage.setItem(`acadex_profile_${firebaseUser.uid}`, JSON.stringify(newProfile));
        await logUserActivity(newProfile, 'REGISTER', `New user registered as ${finalRole}`);
      } else {
        const existingProfile = userDoc.data() as UserProfile;
        
        const updates: Partial<UserProfile> = {
          displayName: firebaseUser.displayName || existingProfile.displayName,
          email: firebaseUser.email || existingProfile.email,
        };

        if (defaultAdmins.includes(firebaseUser.email || '') && existingProfile.role !== 'admin') {
          updates.role = 'admin';
        } else if (defaultExaminers.includes(firebaseUser.email || '') && existingProfile.role !== 'examiner' && existingProfile.role !== 'admin') {
          updates.role = 'examiner';
        }

        if (Object.keys(updates).length > 0) {
          try {
            await updateDoc(userDocRef, updates);
            const updatedProfile = { ...existingProfile, ...updates } as UserProfile;
            setProfile(updatedProfile);
            localStorage.setItem(`acadex_profile_${firebaseUser.uid}`, JSON.stringify(updatedProfile));
            await logUserActivity(updatedProfile, 'LOGIN', 'User logged in and profile updated');
          } catch (e) {
            setProfile(existingProfile);
            localStorage.setItem(`acadex_profile_${firebaseUser.uid}`, JSON.stringify(existingProfile));
            await logUserActivity(existingProfile, 'LOGIN', 'User logged in (profile update failed due to quota)');
          }
        } else {
          setProfile(existingProfile);
          localStorage.setItem(`acadex_profile_${firebaseUser.uid}`, JSON.stringify(existingProfile));
          await logUserActivity(existingProfile, 'LOGIN', 'User logged in');
        }
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/cancelled-popup-request') {
        console.warn('Multiple popup requests detected.');
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
        throw error;
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (profile) await logUserActivity(profile, 'LOGOUT', 'User logged out');
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
