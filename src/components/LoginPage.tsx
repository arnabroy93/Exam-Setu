import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '../types';
import { GraduationCap, ShieldCheck, UserCog, LogIn, Layers } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailAuth = async (isSignUp: boolean) => {
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError('Please enter your email address');
    
    const isAuthorized = cleanEmail.endsWith('@anudip.org') || 
                        ['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail);
                        
    if (!isAuthorized) {
      return setError('Only @anudip.org emails are allowed.');
    }

    const { supabase } = await import('../lib/supabase');
    
    try {
      if (isSignUp) {
        if (password.length < 6) return setError('Password must be at least 6 characters');
        const { error: signUpError, data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { 
              full_name: cleanEmail.split('@')[0], 
              role: selectedRole,
              password_reset_required: password === 'Default1234' && !['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail)
            }
          }
        });
        if (signUpError) throw signUpError;
        if (!data.session) setError('Signup successful! If you have email confirmation enabled in Supabase, please check your inbox. Otherwise, you can now Sign In.');
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
          if (isInvalid && password === 'Default1234' && !['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail)) {
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
                return setError('This account is already registered with a different password. If you forgot your password, please use the Magic Link option or contact your administrator to reset it to the default.');
              }
              throw signUpError;
            }

            if (signUpData.session) {
              return; // Logged in
            } else {
              return setError('Account initialized! Please check your email for a verification link to activate your direct login access.');
            }
          }
          throw signInError;
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMagicLink = async () => {
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return setError('Please enter your email address');
    
    if (!(cleanEmail.endsWith('@anudip.org') || ['arnab.roy@anudip.org', 'arnabredmi3sprime@gmail.com', 'arnabsukanya@gmail.com'].includes(cleanEmail))) {
      return setError('Only @anudip.org emails are allowed.');
    }

    const { supabase } = await import('../lib/supabase');
    const redirectTo = window.location.origin.includes('localhost') 
      ? `${window.location.origin}/` 
      : `${window.location.origin}/`;

    const { error } = await supabase.auth.signInWithOtp({ 
      email: cleanEmail,
      options: { 
        emailRedirectTo: redirectTo,
        data: { full_name: cleanEmail.split('@')[0], role: selectedRole }
      }
    });
    
    if (error) {
      setError(error.message.toLowerCase().includes('rate limit') ? 'Too many attempts! Please wait.' : error.message);
    } else {
      setError('Success! Check your email inbox for the magic link.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-teal-100 p-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border border-teal-100 shadow-2xl bg-white/80 backdrop-blur-2xl rounded-3xl text-teal-950">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-4 backdrop-blur-md border border-teal-200">
              <Layers className="w-10 h-10 text-teal-600" />
            </div>
            <CardTitle className="text-4xl font-extrabold tracking-tighter text-teal-950">
              AcadEx
            </CardTitle>
            <CardDescription className="text-teal-700 text-sm mt-2 leading-relaxed">
              AcadEx is a dedicated assessment platform designed to evaluate and enhance knowledge through structured examinations. It serves as an internal platform of Anudip Foundation, aimed at ensuring effective learning outcomes and continuous skill development.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-red-800 text-sm text-center backdrop-blur-sm">
                {error}
              </div>
            )}
            <Tabs defaultValue="student" onValueChange={(v) => setSelectedRole(v as UserRole)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-12 bg-teal-50 p-1 rounded-2xl">
                <TabsTrigger value="student" className="rounded-xl data-[state=active]:bg-teal-600 data-[state=active]:text-white">
                  Student
                </TabsTrigger>
                <TabsTrigger value="examiner" className="rounded-xl data-[state=active]:bg-teal-600 data-[state=active]:text-white">
                  Examiner
                </TabsTrigger>
                <TabsTrigger value="admin" className="rounded-xl data-[state=active]:bg-teal-600 data-[state=active]:text-white">
                  Admin
                </TabsTrigger>
              </TabsList>
              
              <div className="mt-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-teal-700 ml-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@anudip.org"
                      className="flex h-12 w-full rounded-2xl border border-teal-200 bg-white px-4 py-2 text-teal-950 placeholder:text-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>

                  <Button 
                    onClick={handleMagicLink}
                    disabled={loading} 
                    className="w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-semibold"
                  >
                    Send Magic Link
                  </Button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-teal-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-teal-500 font-bold uppercase">OR</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-teal-700 ml-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="flex h-12 w-full rounded-2xl border border-teal-200 bg-white px-4 py-2 text-teal-950 placeholder:text-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => handleEmailAuth(false)}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-teal-700 text-white hover:bg-teal-800 font-semibold"
                      >
                        Sign In
                      </Button>
                      <Button 
                        onClick={() => handleEmailAuth(true)}
                        disabled={loading}
                        className="h-12 rounded-2xl bg-teal-100 hover:bg-teal-200 text-teal-900 font-semibold border border-teal-200"
                      >
                        Sign Up
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-8 text-center text-sm text-teal-700">
          By signing in, you agree to our Terms of Service & Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};
