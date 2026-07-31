import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, BookOpen, FileText, Settings, Users, Plus, Play, Activity, Layers, ClipboardList, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { ExamCreator } from './ExamCreator';
import { ExamInterface } from './ExamInterface';
import { ResultsView } from './ResultsView';
import { Exam } from '../types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PortalBackground } from './PortalBackground';

import { ExamManagement } from './ExamManagement';

import { ExamDetailsView } from './ExamDetailsView';
import { SettingsView } from './SettingsView';
import { StudentDashboard } from './StudentDashboard';
import { UserManagement } from './UserManagement';
import { AdminDashboard } from './AdminDashboard';
import { StudentReports } from './StudentReports';
import { LiveMonitoring } from './LiveMonitoring';
import { UserActivitiesLog } from './UserActivitiesLog';

export const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<'dashboard' | 'create-exam' | 'taking-exam' | 'results' | 'manage-exams' | 'exam-details' | 'settings' | 'user-management' | 'student-reports' | 'live-monitoring' | 'user-activities'>('dashboard');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [quotaError, setQuotaError] = useState(false);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message?.includes('Quota exceeded') || e.error?.message?.includes('Quota exceeded')) {
        setQuotaError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (view === 'create-exam') {
    return (
      <PortalBackground>
        <ExamCreator onBack={() => setView('manage-exams')} initialExam={selectedExam || undefined} />
      </PortalBackground>
    );
  }

  if (view === 'taking-exam' && selectedExam) {
    return (
      <PortalBackground>
        <ExamInterface exam={selectedExam} onFinish={() => setView('dashboard')} />
      </PortalBackground>
    );
  }

  if (view === 'exam-details' && selectedExam) {
    return (
      <PortalBackground>
        <ExamDetailsView exam={selectedExam} onBack={() => setView('manage-exams')} />
      </PortalBackground>
    );
  }

  return (
    <PortalBackground>
      <div className="min-h-screen flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-teal-100/40 bg-white/40 backdrop-blur-md hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{
                y: [0, -2, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              whileHover={{ scale: 1.1 }}
              className="w-10 h-10 bg-gradient-to-tr from-teal-600 to-teal-400 rounded-xl flex items-center justify-center shadow-md shadow-teal-600/15 relative overflow-hidden"
            >
              {/* Subtle shining light beam inside sidebar icon */}
              <motion.div 
                animate={{
                  x: ['-100%', '200%']
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 2
                }}
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12"
              />
              <Layers className="w-5 h-5 text-white" />
            </motion.div>
            <motion.h1 
              className="text-2xl font-black bg-gradient-to-r from-teal-800 via-teal-600 to-teal-900 bg-[size:200%_auto] bg-clip-text text-transparent select-none"
            >
              <motion.span
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="bg-gradient-to-r from-teal-800 via-teal-500 to-teal-700 bg-[size:200%_auto] bg-clip-text text-transparent inline-block"
              >
                AcadEx
              </motion.span>
            </motion.h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          {profile?.role === 'student' && (
            <>
              <NavItem icon={<FileText className="w-5 h-5" />} label="My Results" active={view === 'results'} onClick={() => setView('results')} />
            </>
          )}
          {(profile?.role === 'admin' || profile?.role === 'examiner') && (
            <>
              <NavItem icon={<Activity className="w-5 h-5" />} label="Live Monitoring" active={view === 'live-monitoring'} onClick={() => setView('live-monitoring')} />
              <NavItem icon={<BookOpen className="w-5 h-5" />} label="Manage Exams" active={view === 'manage-exams'} onClick={() => setView('manage-exams')} />
              {profile?.role === 'admin' && (
                <>
                  <NavItem icon={<Users className="w-5 h-5" />} label="User Management" active={view === 'user-management'} onClick={() => setView('user-management')} />
                  <NavItem icon={<FileText className="w-5 h-5" />} label="Student Reports" active={view === 'student-reports'} onClick={() => setView('student-reports')} />
                  <NavItem icon={<ClipboardList className="w-5 h-5" />} label="User Activities" active={view === 'user-activities'} onClick={() => setView('user-activities')} />
                </>
              )}
              {profile?.role === 'examiner' && (
                <NavItem icon={<Users className="w-5 h-5" />} label="Student Reports" active={view === 'student-reports'} onClick={() => setView('student-reports')} />
              )}
            </>
          )}
          <NavItem icon={<Settings className="w-5 h-5" />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
            <LogOut className="mr-2 w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-y-auto">
        <header className="h-16 border-b border-teal-100/40 bg-white/40 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-black bg-gradient-to-r from-teal-950 to-teal-700 bg-clip-text text-transparent">
            {profile?.role === 'admin' && 'Admin Dashboard'}
            {profile?.role === 'examiner' && 'Examiner Dashboard'}
            {profile?.role === 'student' && 'Student Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            {quotaError && (
              <Badge variant="destructive" className="animate-pulse gap-1">
                <AlertTriangle className="w-3 h-3" />
                Daily Quota Limit Reached
              </Badge>
            )}
            {(profile?.role === 'admin' || profile?.role === 'examiner') && (
              <Button onClick={() => { setSelectedExam(null); setView('create-exam'); }} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/10 transition-all duration-200">
                <Plus className="mr-2 w-4 h-4" />
                New Exam
              </Button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-teal-950">{profile?.email}</p>
              <p className="text-xs text-teal-600/80 font-bold uppercase tracking-wider capitalize">{profile?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-400 text-white flex items-center justify-center font-black shadow-md shadow-teal-500/15">
              {profile?.displayName?.[0] || profile?.email?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        
        <div className="p-8 flex-1">
          {view === 'settings' && <SettingsView />}
          {view === 'results' && <ResultsView />}
          {view === 'user-management' && <UserManagement />}
          {view === 'user-activities' && <UserActivitiesLog />}
          {view === 'student-reports' && <StudentReports />}
          {view === 'live-monitoring' && <LiveMonitoring />}
          {view === 'manage-exams' && (
            <ExamManagement 
              onEdit={(exam) => { setSelectedExam(exam); setView('create-exam'); }}
              onView={(exam) => { setSelectedExam(exam); setView('exam-details'); }}
            />
          )}
          {view === 'dashboard' && (
            <>
              {profile?.role === 'student' ? (
                <StudentDashboard 
                  onStartExam={(exam) => { setSelectedExam(exam); setView('taking-exam'); }}
                  onViewResults={() => setView('results')}
                />
              ) : (
                <AdminDashboard onAction={setView} />
              )}
            </>
          )}
        </div>
        <footer className="py-4 text-center text-xs text-teal-800/60 border-t border-teal-100/40 bg-white/40 backdrop-blur-sm mt-auto shrink-0">
          An Initiative By Academic Excellence Team - Anudip Foundation
        </footer>
      </main>
    </div>
    </PortalBackground>
  );
};

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
  >
    {icon}
    {label}
  </button>
);
