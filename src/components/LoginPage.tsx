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
            data: { full_name: cleanEmail.split('@')[0], role: selectedRole }
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
        if (signInError) throw signInError;
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-primary/10 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
              <Layers className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-primary flex items-center justify-center gap-2">
              <Layers className="w-8 h-8" />
              AcadEx
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your gateway to seamless online examinations
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-4 px-4 text-justify">
              AcadEx is a dedicated assessment platform designed to evaluate and enhance knowledge through structured examinations. It serves as an internal platform of Anudip Foundation, aimed at ensuring effective learning outcomes and continuous skill development.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
                {error}
              </div>
            )}
            <Tabs defaultValue="student" onValueChange={(v) => setSelectedRole(v as UserRole)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-12">
                <TabsTrigger value="student" className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Student
                </TabsTrigger>
                <TabsTrigger value="examiner" className="flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Examiner
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Admin
                </TabsTrigger>
              </TabsList>
              
              <div className="mt-6 space-y-4">
                  <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl space-y-5">
                    {/* Common Email Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground ml-1">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@anudip.org"
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    {/* Magic Link Section */}
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center font-medium">
                        Use your @anudip.org email with a magic link
                      </p>
                      <Button 
                        onClick={handleMagicLink}
                        disabled={loading} 
                        className="w-full h-11 font-semibold"
                      >
                        Send Magic Link to Email
                      </Button>
                    </div>

                    {/* Separator */}
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-primary/5 px-2 text-muted-foreground font-bold uppercase">or option</span>
                      </div>
                    </div>

                    {/* Direct Login Section */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg text-primary">Direct Login</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use your @anudip.org email with a password
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground ml-1">Password (for direct login)</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button 
                          onClick={() => handleEmailAuth(false)}
                          disabled={loading}
                          className="h-11 font-semibold"
                          variant="secondary"
                        >
                          Sign In
                        </Button>
                        <Button 
                          onClick={() => handleEmailAuth(true)}
                          disabled={loading}
                          variant="outline"
                          className="h-11 font-semibold bg-background"
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
        <p className="mt-8 text-center text-sm text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
        <footer className="mt-8 text-center text-xs text-muted-foreground">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </motion.div>
    </div>
  );
};
