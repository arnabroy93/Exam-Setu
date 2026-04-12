import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, Bell, Moon, Sun, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const SettingsView: React.FC = () => {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'security'>('profile');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [emailNotifications, setEmailNotifications] = useState(profile?.settings?.emailNotifications ?? true);
  const [theme, setTheme] = useState<'light' | 'dark'>(profile?.settings?.theme ?? 'light');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSaving(true);
    setMessage(null);

    try {
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
        'settings.emailNotifications': emailNotifications,
        'settings.theme': theme
      });
      
      // Apply theme locally
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage({ type: 'error', text: 'Failed to update settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="space-y-1">
          <button 
            onClick={() => setActiveSection('profile')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'profile' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button 
            onClick={() => setActiveSection('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'notifications' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
          <button 
            onClick={() => setActiveSection('security')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'security' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4" />
            Security
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          {activeSection === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details and how others see you.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        value={profile?.email || ''} 
                        disabled 
                        className="pl-10 bg-muted/50 cursor-not-allowed" 
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Email cannot be changed as it is linked to your Google account.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="displayName" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)} 
                        placeholder="Your Name"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Account Role</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize px-3 py-1">
                        {profile?.role}
                      </Badge>
                      <p className="text-xs text-muted-foreground">Contact an administrator to change your role.</p>
                    </div>
                  </div>

                  {message && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                      message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                      {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {message.text}
                    </div>
                  )}

                  <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? 'Saving...' : (
                      <>
                        <Save className="mr-2 w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified about exam updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates about your exams and results.</p>
                  </div>
                  <div 
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${emailNotifications ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${emailNotifications ? 'right-1' : 'left-1'}`} />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Notification Settings'}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security and authentication.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <p className="text-sm font-medium">Google Authentication</p>
                  <p className="text-xs text-muted-foreground mt-1">Your account is secured via Google. Password management is handled by your Google Account settings.</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => window.open('https://myaccount.google.com/security', '_blank')}>
                  Go to Google Security Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Preferences Section (Theme) */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme Mode</Label>
                  <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
                </div>
                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                  <Button 
                    variant={theme === 'light' ? 'default' : 'ghost'} 
                    size="sm" 
                    className={`h-8 w-8 p-0 ${theme === 'light' ? 'shadow-sm' : 'text-muted-foreground opacity-50'}`}
                    onClick={() => toggleTheme('light')}
                  >
                    <Sun className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={theme === 'dark' ? 'default' : 'ghost'} 
                    size="sm" 
                    className={`h-8 w-8 p-0 ${theme === 'dark' ? 'shadow-sm' : 'text-muted-foreground opacity-50'}`}
                    onClick={() => toggleTheme('dark')}
                  >
                    <Moon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSaving} variant="outline">
                {isSaving ? 'Saving...' : 'Apply Theme Permanently'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
