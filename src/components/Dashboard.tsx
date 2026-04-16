import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, BookOpen, FileText, Settings, Users, Plus, Play, Activity, Layers, ClipboardList } from 'lucide-react';
import { ExamCreator } from './ExamCreator';
import { ExamInterface } from './ExamInterface';
import { ResultsView } from './ResultsView';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Exam } from '../types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    return <ExamCreator onBack={() => setView('manage-exams')} initialExam={selectedExam || undefined} />;
  }

  if (view === 'taking-exam' && selectedExam) {
    return <ExamInterface exam={selectedExam} onFinish={() => setView('dashboard')} />;
  }

  if (view === 'exam-details' && selectedExam) {
    return <ExamDetailsView exam={selectedExam} onBack={() => setView('manage-exams')} />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Layers className="w-6 h-6" />
            AcadEx
          </h1>
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
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
          <h2 className="text-xl font-semibold">
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
              <Button onClick={() => { setSelectedExam(null); setView('create-exam'); }} size="sm">
                <Plus className="mr-2 w-4 h-4" />
                New Exam
              </Button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {profile?.displayName?.[0]}
            </div>
          </div>
        </header>
        
        <div className="p-8">
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
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-card mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </main>
    </div>
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
