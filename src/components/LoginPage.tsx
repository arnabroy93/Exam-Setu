import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '../types';
import { GraduationCap, ShieldCheck, UserCog, LogIn } from 'lucide-react';
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
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-primary flex items-center justify-center gap-2">
              <GraduationCap className="w-8 h-8" />
              Exam Setu
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your gateway to seamless online examinations
            </CardDescription>
            <p className="text-sm text-muted-foreground mt-4 px-4 text-justify">
              Exam Setu is a dedicated assessment platform designed to evaluate and enhance knowledge through structured examinations. It serves as an internal platform of Anudip Foundation, aimed at ensuring effective learning outcomes and continuous skill development.
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
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  {selectedRole === 'student' && "Access your exams, view results, and track your progress."}
                  {selectedRole === 'examiner' && "Create exams, evaluate submissions, and manage question banks."}
                  {selectedRole === 'admin' && "Full system control, user management, and advanced analytics."}
                </p>
              </div>
            </Tabs>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleLogin} 
              disabled={loading} 
              className="w-full h-12 text-lg font-semibold transition-all hover:scale-[1.02]"
            >
              <LogIn className="mr-2 w-5 h-5" />
              Sign in with Google
            </Button>
          </CardFooter>
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
