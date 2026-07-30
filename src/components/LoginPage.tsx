import React, { useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '../types';
import { GraduationCap, ShieldCheck, UserCog, LogIn, Layers } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Floating live background particles configuration
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      size: Math.random() * 12 + 6, // 6px to 18px
      initialX: Math.random() * 100, // percentage based
      initialY: Math.random() * 100, // percentage based
      duration: Math.random() * 12 + 18, // 18s to 30s
      delay: Math.random() * -25, // negative delay so they start pre-dispersed
    }));
  }, []);

  const handleEmailAuth = async (isSignUp: boolean) => {
    setError(null);
    setSuccessMsg(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError('Please enter your email address');
    
    const isAuthorized = cleanEmail.endsWith('@anudip.org') || 
                        ['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail);
                        
    if (!isAuthorized) {
      return setError('Only @anudip.org emails are allowed.');
    }

    const { supabase } = await import('../lib/supabase');
    
    try {
      const isDefaultPassword = password === 'Default@1234' || password === 'Exam@2026';
      
      if (isSignUp) {
        if (password.length < 6) return setError('Password must be at least 6 characters');
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { 
              full_name: cleanEmail.split('@')[0], 
              role: selectedRole,
              password_reset_required: isDefaultPassword && !['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail)
            }
          }
        });
        if (signUpError) throw signUpError;
        if (!data.session) setSuccessMsg('Signup successful! If you have email confirmation enabled in Supabase, please check your inbox. Otherwise, you can now Sign In.');
      } else {
        if (!password) return setError('Please enter your password');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        
        if (signInError) {
          const errMsg = signInError.message.toLowerCase();
          const isUnconfirmed = errMsg.includes('email not confirmed');
          const isInvalid = errMsg.includes('invalid login credentials') || 
                           errMsg.includes('invalid credentials') ||
                           errMsg.includes('user not found') ||
                           errMsg.includes('no user found') ||
                           isUnconfirmed;
          
          // If login fails (including unconfirmed email) and it's the default password for an authorized domain
          if (isInvalid && isDefaultPassword && !['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail)) {
            const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: { 
                  full_name: cleanEmail.split('@')[0], 
                  role: selectedRole,
                  password_reset_required: true
                }
              }
            });

            if (signUpError) {
              if (signUpError.message.toLowerCase().includes('already registered')) {
                return setError('Invalid login credentials. The password you entered is incorrect. If your password was recently reset, please ensure the admin has correctly configured the database.');
              }
              throw signUpError;
            }

            if (signUpData.session) {
              return; // Logged in
            } else {
              return setSuccessMsg('Account initialized! Please check your email for a verification link to activate your direct login access.');
            }
          }
          throw signInError;
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50/50 p-4 relative overflow-hidden">
      {/* Dynamic Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-100/40"></div>
        
        {/* Animated Gradient Orb 1 */}
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 50, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-40 -left-40 w-[450px] h-[450px] rounded-full bg-teal-200/40 blur-3xl"
        />
        
        {/* Animated Gradient Orb 2 */}
        <motion.div
          animate={{
            x: [0, -90, 60, 0],
            y: [0, 80, -70, 0],
            scale: [1, 0.85, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-teal-300/30 blur-3xl"
        />

        {/* Animated Gradient Orb 3 */}
        <motion.div
          animate={{
            scale: [0.9, 1.1, 0.95, 0.9],
            opacity: [0.3, 0.5, 0.4, 0.3],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 left-1/4 w-[350px] h-[350px] rounded-full bg-teal-100/50 blur-3xl"
        />

        {/* Sophisticated SVG Grid Pattern */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#0d94880c_1px,transparent_1px),linear-gradient(to_bottom,#0d94880c_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        />

        {/* Floating Live Background Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-teal-500/25 blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.initialX}%`,
              top: `${p.initialY}%`,
            }}
            animate={{
              y: [0, -650],
              x: [0, Math.sin(p.id) * 50, -Math.sin(p.id) * 50, 0],
              opacity: [0, 0.7, 0.4, 0],
              scale: [0.8, 1.2, 0.9, 0.8],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border border-teal-100/80 shadow-2xl bg-white/85 backdrop-blur-md rounded-3xl text-teal-950">
          <CardHeader className="text-center space-y-3 pt-8 px-6">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="mx-auto w-16 h-16 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-teal-600/20"
            >
              <Layers className="w-8 h-8 text-white" />
            </motion.div>
            <CardTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-900 to-teal-700 bg-clip-text text-transparent">
              AcadEx
            </CardTitle>
            <CardDescription className="text-teal-900/80 text-xs mt-2 leading-relaxed max-w-sm mx-auto">
              AcadEx is a dedicated assessment platform designed to evaluate and enhance knowledge through structured examinations. It serves as an internal platform of Anudip Foundation, aimed at ensuring effective learning outcomes and continuous skill development.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-8 px-8">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm text-center"
              >
                {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-900 text-sm text-center"
              >
                {successMsg}
              </motion.div>
            )}

            {/* Elegant, animated Role Selection Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-teal-900/70 ml-1 uppercase tracking-wider">Login as</label>
              <div className="bg-teal-50/80 p-1.5 rounded-2xl border border-teal-100/50 flex gap-1 relative overflow-hidden">
                {(['student', 'examiner', 'admin'] as const).map((role) => {
                  const isActive = selectedRole === role;
                  const Icon = role === 'student' ? GraduationCap : role === 'examiner' ? UserCog : ShieldCheck;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative z-10 select-none cursor-pointer"
                      style={{
                        color: isActive ? '#0f766e' : '#4f5e5b',
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeRoleBg"
                          className="absolute inset-0 bg-white shadow-sm border border-teal-100/50 rounded-xl"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon className="w-3.5 h-3.5 relative z-10" />
                      <span className="capitalize relative z-10">{role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-teal-900/90 ml-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@anudip.org"
                      className="flex h-12 w-full rounded-2xl border border-teal-200 bg-white/75 px-4 py-2 text-teal-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner"
                    />
                  </div>
 
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-teal-900/90 ml-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="flex h-12 w-full rounded-2xl border border-teal-200 bg-white/75 px-4 py-2 text-teal-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <Button 
                        onClick={() => handleEmailAuth(false)}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 font-semibold shadow-lg shadow-teal-600/10 transition-all duration-200 active:scale-95"
                      >
                        Sign In
                      </Button>
                      <Button 
                        onClick={() => handleEmailAuth(true)}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-semibold border border-teal-200/80 transition-all duration-200 active:scale-95"
                      >
                        Sign Up
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="mt-8 text-center text-xs text-teal-900/70 font-medium">
          By signing in, you agree to our Terms of Service & Privacy Policy.
        </p>
        <footer className="mt-4 text-center text-xs text-teal-900/80 font-bold tracking-wide uppercase">
          An Initiative By Academic Excellence Team - Anudip Foundation
        </footer>
      </motion.div>
    </div>
  );
};
