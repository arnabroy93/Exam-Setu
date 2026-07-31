import React, { useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '../types';
import { GraduationCap, ShieldCheck, UserCog, LogIn, Layers, ArrowLeft, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
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
              role: 'student', // Assigned as student by default, admin changes it later
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

        {/* Dynamic Sweeping Ambient Light Beam */}
        <motion.div
          animate={{
            x: ['-100%', '100%'],
            y: ['-30%', '30%'],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-teal-400/10 to-transparent -rotate-45 scale-150 pointer-events-none"
        />

        {/* Sophisticated SVG Grid Pattern */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#0d94880c_1px,transparent_1px),linear-gradient(to_bottom,#0d94880c_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        />

        {/* Animated Parallax Liquid Waves at the Bottom */}
        <div className="absolute bottom-0 left-0 right-0 w-full h-[280px] overflow-hidden opacity-40 select-none">
          {/* Wave 1 */}
          <motion.svg
            className="absolute bottom-0 left-0 w-[200%] h-full text-teal-400/15 fill-current"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            animate={{
              x: [0, -1440],
              y: [0, 8, -5, 0],
            }}
            transition={{
              x: { duration: 25, repeat: Infinity, ease: "linear" },
              y: { duration: 10, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <path d="M0,160 C320,300 480,120 720,220 C960,320 1120,100 1440,180 C1760,260 1920,140 2160,200 C2400,260 2560,120 2880,180 L2880,320 L0,320 Z" />
          </motion.svg>

          {/* Wave 2 */}
          <motion.svg
            className="absolute bottom-0 left-0 w-[200%] h-full text-emerald-400/10 fill-current"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            animate={{
              x: [-1440, 0],
              y: [0, -12, 6, 0],
            }}
            transition={{
              x: { duration: 35, repeat: Infinity, ease: "linear" },
              y: { duration: 14, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <path d="M0,120 C240,240 480,80 720,180 C960,280 1200,100 1440,140 C1680,180 1920,80 2160,160 C2400,240 2640,120 2880,140 L2880,320 L0,320 Z" />
          </motion.svg>
        </div>

        {/* Floating Live Background Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-gradient-to-r from-teal-400/30 to-emerald-400/25 blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.initialX}%`,
              top: `${p.initialY}%`,
            }}
            animate={{
              y: [0, -650],
              x: [0, Math.sin(p.id) * 60, -Math.sin(p.id) * 60, 0],
              opacity: [0, 0.8, 0.4, 0],
              scale: [0.8, 1.3, 0.9, 0.8],
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
              animate={{
                y: [0, -4, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              whileHover={{ scale: 1.05 }}
              className="mx-auto w-16 h-16 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-teal-600/20 relative overflow-hidden"
            >
              {/* Pulsing ring background */}
              <motion.div 
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.1, 0.3, 0.1]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-teal-300 rounded-2xl"
              />
              
              {/* Ambient light glow swipe */}
              <motion.div 
                animate={{
                  x: ['-100%', '200%']
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 1.5
                }}
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
              />

              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative z-10"
              >
                <Layers className="w-8 h-8 text-white filter drop-shadow-md" />
              </motion.div>
            </motion.div>
            <CardTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-900 via-teal-600 to-teal-700 bg-[size:200%_auto] bg-clip-text text-transparent select-none">
              <motion.span
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="bg-gradient-to-r from-teal-900 via-teal-500 to-teal-800 bg-[size:200%_auto] bg-clip-text text-transparent inline-block"
              >
                AcadEx
              </motion.span>
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

            <AnimatePresence mode="wait">
              {!isSignUpMode ? (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {/* Elegant, animated Role Selection Tabs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-teal-900/60 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                        </span>
                        Login as
                      </span>
                      <motion.span 
                        key={selectedRole}
                        initial={{ opacity: 0, scale: 0.9, y: -2 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="text-[10px] font-bold text-teal-600 uppercase tracking-wider bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100/80 shadow-sm"
                      >
                        {selectedRole} Portal
                      </motion.span>
                    </div>

                    <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 flex gap-1.5 relative overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                      {(['student', 'examiner', 'admin'] as const).map((role) => {
                        const isActive = selectedRole === role;
                        const Icon = role === 'student' ? GraduationCap : role === 'examiner' ? UserCog : ShieldCheck;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all relative z-10 select-none cursor-pointer hover:bg-slate-200/20"
                            style={{
                              color: isActive ? '#0f766e' : '#64748b',
                            }}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeRoleBg"
                                className="absolute inset-0 bg-white shadow-md border border-teal-100/60 rounded-xl"
                                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                              />
                            )}
                            <motion.div
                              animate={isActive ? { scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] } : {}}
                              transition={{ duration: 0.4 }}
                              className="relative z-10"
                            >
                              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                            </motion.div>
                            <span className="capitalize relative z-10 tracking-wide">{role}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                        className="h-12 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 font-bold shadow-lg shadow-teal-600/10 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </Button>
                      <Button 
                        onClick={() => {
                          setError(null);
                          setSuccessMsg(null);
                          setIsSignUpMode(true);
                        }}
                        className="h-12 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold border border-teal-200/80 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        Sign Up
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {/* Informational student registration block */}
                  <div className="bg-gradient-to-r from-teal-50 to-emerald-50/80 border border-teal-100 p-4 rounded-2xl shadow-inner flex items-start gap-3">
                    <div className="bg-teal-500/10 p-2 rounded-xl text-teal-600 mt-0.5">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">Default Student Profile</h4>
                      <p className="text-[11px] text-teal-800/80 leading-normal">
                        All new registrations are assigned the <strong>Student</strong> role by default. Instructors and administrators must authorize Examiner or Admin permissions after sign-up.
                      </p>
                    </div>
                  </div>

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
   
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-teal-900/90 ml-1">Choose a Password</label>
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
                        onClick={() => handleEmailAuth(true)}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 font-bold shadow-lg shadow-teal-600/10 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        Registered
                      </Button>
                      <Button 
                        onClick={() => {
                          setError(null);
                          setSuccessMsg(null);
                          setIsSignUpMode(false);
                        }}
                        className="h-12 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold border border-teal-200/80 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Sign In
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
