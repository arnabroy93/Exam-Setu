import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '../types';
import { GraduationCap, ShieldCheck, UserCog, LogIn, Layers } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { signIn, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await signIn(selectedRole);
    } catch (err: any) {
      console.error('Login failed', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked! Please enable popups for this site to sign in.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'auth/not-authorized') {
        setError('Not authorised. Only anudip.org domain or specific authorized emails are allowed.');
      } else if (err.message?.toLowerCase().includes('quota')) {
        setError('Database quota exceeded. This usually resets every 24 hours. Please try again later.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
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
                  <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg text-primary">Email Login / Sign Up</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter your @anudip.org email. We'll send you a secure magic link, no passwords needed!
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <input
                        type="email"
                        id="email-input"
                        placeholder="name@anudip.org"
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <Button 
                        disabled={loading} 
                        className="w-full h-12 text-base font-semibold"
                        onClick={async () => {
                          const emailInput = document.getElementById('email-input') as HTMLInputElement;
                          const email = emailInput?.value?.trim();
                          if (!email) return setError('Please enter your email address');
                          
                          // Check if it's anudip.org or allowed emails
                          const isAuthorized = email.endsWith('@anudip.org') || 
                                              email === 'arnabredmi3sprime@gmail.com' || 
                                              email === 'arnabsukanya@gmail.com';
                                              
                          if (!isAuthorized) {
                            return setError('Only @anudip.org emails are allowed to sign in.');
                          }
                          
                          const { supabase } = await import('../lib/supabase');
                          // Send Magic Link OTP
                          const { error } = await supabase.auth.signInWithOtp({ 
                            email: email,
                            options: { 
                              emailRedirectTo: `${window.location.origin}/`,
                              data: { full_name: email.split('@')[0] }
                            }
                          });
                          
                          if (error) {
                            if (error.message.toLowerCase().includes('rate limit')) {
                               setError('Too many attempts! Please wait a few minutes before trying again.');
                            } else {
                               setError(error.message);
                            }
                          } else {
                            setError('Success! Check your email inbox for the magic link (it might be in spam).');
                          }
                        }}
                      >
                        Send Magic Link
                      </Button>
                    </div>
                  </div>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground font-medium">Or</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleLogin} 
                    variant="outline"
                    disabled={loading} 
                    className="w-full h-12 text-base transition-all hover:bg-muted"
                  >
                    <LogIn className="mr-2 w-5 h-5" />
                    Continue with Google
                  </Button>
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
