import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, getDocs, updateDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCog, GraduationCap, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';

export const UserManagement: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      // Update local state
      const updatedUser = users.find(u => u.uid === userId);
      
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
      
      if (currentUserProfile && updatedUser) {
        await logUserActivity(currentUserProfile, 'ROLE_CHANGE', `Changed role of user ${updatedUser.email} to ${newRole}`);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role. You might not have permission.');
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-primary" />;
      case 'examiner': return <UserCog className="w-4 h-4 text-blue-500" />;
      case 'student': return <GraduationCap className="w-4 h-4 text-green-500" />;
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          User Management
        </h2>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchUsers} 
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Users
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Registered Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 px-4 font-semibold text-sm">User</th>
                  <th className="py-4 px-4 font-semibold text-sm">Email</th>
                  <th className="py-4 px-4 font-semibold text-sm">Current Role</th>
                  <th className="py-4 px-4 font-semibold text-sm">Assign New Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {user.displayName?.[0]}
                        </div>
                        <span className="font-medium">{user.displayName}</span>
                        {user.uid === currentUserProfile?.uid && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">You</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <span className="capitalize text-sm">{user.role}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Select 
                        value={user.role} 
                        onValueChange={(value: UserRole) => handleRoleChange(user.uid, value)}
                        disabled={user.uid === currentUserProfile?.uid} // Prevent self-demotion for safety
                      >
                        <SelectTrigger className="w-32 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="examiner">Examiner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No users found matching your search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
