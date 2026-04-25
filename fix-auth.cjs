const fs = require('fs');

async function run() {
  let code = `
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { UserProfile, UserRole } from '../types';
import { logUserActivity } from './activityLogger';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserSession(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserSession = async (supabaseUser: any) => {
    setUser(supabaseUser);
    if (supabaseUser) {
      const sessionKey = \`acadex_session_profile_\${supabaseUser.id}\`;
      const localKey = \`acadex_profile_\${supabaseUser.id}\`;
      
      const sessionCached = sessionStorage.getItem(sessionKey);
      if (sessionCached) {
        try {
          const { profile: p, timestamp } = JSON.parse(sessionCached);
          if (Date.now() - timestamp < 14400000) {
            setProfile(p);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }

      const cached = localStorage.getItem(localKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
        } catch (e) {}
      }

      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', supabaseUser.id).single();
        if (data && !error) {
          const profileData = data as unknown as UserProfile;
          setProfile(profileData);
          const cacheData = { profile: profileData, timestamp: Date.now() };
          localStorage.setItem(localKey, JSON.stringify(profileData));
          sessionStorage.setItem(sessionKey, JSON.stringify(cacheData));
        } else if (error && error.code !== 'PGRST116') {
          console.error('Supabase error:', error);
          setProfile(null);
        } else {
          // Profile not found - create it
          await createProfile(supabaseUser);
        }
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  const createProfile = async (supabaseUser: any) => {
    const email = supabaseUser.email || '';
    const defaultAdmins = ['arnab.roy@anudip.org', 'piem@anudip.org'];
    const defaultExaminers = ['rashmi.mukherjee@anudip.org'];
    
    let finalRole = 'student' as UserRole;
    if (defaultAdmins.includes(email)) finalRole = 'admin';
    else if (defaultExaminers.includes(email)) finalRole = 'examiner';
    
    const isAuthorized = email.endsWith('@anudip.org') || 
                         email === 'arnabredmi3sprime@gmail.com' || 
                         email === 'arnabsukanya@gmail.com';
                         
    if (!isAuthorized) {
       await supabase.auth.signOut();
       return;
    }

    const newProfile: UserProfile = {
      uid: supabaseUser.id,
      email: email,
      displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || 'User',
      role: finalRole,
      createdAt: Date.now(),
    };
    
    await supabase.from('users').insert({
      id: supabaseUser.id,
      ...newProfile,
      updatedAt: Date.now()
    });
    
    setProfile(newProfile);
    localStorage.setItem(\`acadex_profile_\${supabaseUser.id}\`, JSON.stringify(newProfile));
    await logUserActivity(newProfile, 'REGISTER', \`New user registered as \${finalRole}\`);
  };

  const signIn = async (role: UserRole) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      // setLoading(false) shouldn't be called if redirect works
    }
  };

  const signOut = async () => {
    if (profile) await logUserActivity(profile, 'LOGOUT', 'User logged out');
    await supabase.auth.signOut();
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
`;

  fs.writeFileSync('src/lib/AuthContext.tsx', code);
  console.log('AuthContext Done mapping.');
}

run();
