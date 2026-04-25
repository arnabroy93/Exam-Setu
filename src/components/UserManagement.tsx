import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCog, GraduationCap, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight, AlertTriangle, FileSpreadsheet, FileText, File as FilePdf, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';
import { updateStat, getSystemStats } from '../lib/stats';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '../hooks/useDebounce';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const UserManagement: React.FC = () => {
  const { profile: currentUserProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [searchBuffer, setSearchBuffer] = useState<UserProfile[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  
  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchUsers = useCallback(async (newPage: number, force = false) => {
    setLoading(true);
    try {
      // Optimisation: Search Buffer logic
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.trim();
        if (!force && searchBuffer && term.toLowerCase().startsWith(lastSearchQuery.toLowerCase()) && lastSearchQuery !== '') {
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
        
        const { data } = await supabase
          .from('users')
          .select('*')
          .or(`displayName.ilike.%${term}%,email.ilike.%${term}%`)
          .order('createdAt', { ascending: false })
          .limit(1000);
          
        setSearchBuffer((data as unknown as UserProfile[]) || []);
        setLastSearchQuery(term);
        setCurrentPage(1);
      } else {
        setSearchBuffer(null);
        setLastSearchQuery('');

        const from = (newPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, count } = await supabase
          .from('users')
          .select('*', { count: 'exact' })
          .order('createdAt', { ascending: false })
          .range(from, to);

        if (count !== null) setTotalUsersCount(count);
        setUsers((data as unknown as UserProfile[]) || []);
        setCurrentPage(newPage);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [itemsPerPage, debouncedSearchTerm, isRefreshing, searchBuffer, lastSearchQuery]); 

  useEffect(() => {
    fetchUsers(1);
  }, [debouncedSearchTerm]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers(1, true);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const user = users.find(u => u.uid === userId || u.id === userId);
      await supabase.from('users').update({ role: newRole }).eq('id', userId);
      
      if (user && user.role !== newRole) {
        if (currentUserProfile && user) {
          await logUserActivity(currentUserProfile, 'ROLE_CHANGE', `Changed role of user ${user.email} to ${newRole}`);
        }
        setUsers(users.map(u => (u.uid === userId || u.id === userId) ? { ...u, role: newRole } : u));
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role.');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const user = users.find(u => u.uid === userToDelete || u.id === userToDelete);
      await supabase.from('users').delete().eq('id', userToDelete);
      
      if (currentUserProfile && user) {
        await logUserActivity(currentUserProfile, 'DELETE_USER', `Deleted user account: ${user.email} (${user.displayName})`);
      }
      
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
      setSelectedUserIds(prev => prev.filter(id => id !== userToDelete));
      fetchUsers(currentPage, true);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setIsDeleting(true);
    try {
      const deletedEmails: string[] = [];
      const validIds = selectedUserIds.filter(id => id !== currentUserProfile?.uid);
      
      validIds.forEach(id => {
        const u = users.find(user => (user.uid === id || user.id === id));
        if (u) deletedEmails.push(u.email);
      });
      
      await supabase.from('users').delete().in('id', validIds);
      
      if (currentUserProfile) {
        await logUserActivity(currentUserProfile, 'BULK_DELETE_USERS', `Deleted ${deletedEmails.length} user accounts.`);
      }
      
      setSelectedUserIds([]);
      setIsBulkDelete(false);
      setIsDeleteDialogOpen(false);
      fetchUsers(1, true);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Failed to perform bulk delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;
    setLoading(true);
    try {
      // Use the RPC function created in the SQL Step
      const { error } = await supabase.rpc('reset_user_password', {
        target_user_id: String(userToReset.uid || (userToReset as any).id),
        new_password: 'Default1234'
      });

      if (error) throw error;

      if (currentUserProfile) {
        await logUserActivity(currentUserProfile, 'ADMIN_RESET_PASSWORD', `Admin reset password for user: ${userToReset.email}`);
      }

      setIsResetPasswordOpen(false);
      setUserToReset(null);
      alert(`Password for ${userToReset.email} has been reset to "Default1234" and they will be forced to change it on next login.`);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = (debouncedSearchTerm || searchTerm).trim().toLowerCase();
    if (!term) return users;
    
    if (debouncedSearchTerm && searchBuffer) {
      return searchBuffer.filter(user => 
        (user.displayName || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term)
      );
    }
    
    return users.filter(user => 
      (user.displayName || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term)
    );
  }, [users, searchBuffer, debouncedSearchTerm, searchTerm]);

  const mainPaginatedUsers = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredUsers.slice(start, start + itemsPerPage);
    }
    return users;
  }, [users, filteredUsers, currentPage, itemsPerPage, debouncedSearchTerm, searchBuffer]);

  const totalPages = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      return Math.ceil(filteredUsers.length / itemsPerPage);
    }
    return Math.ceil(totalUsersCount / itemsPerPage);
  }, [totalUsersCount, itemsPerPage, debouncedSearchTerm, filteredUsers.length, searchBuffer]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      if (debouncedSearchTerm && searchBuffer) {
        setCurrentPage(newPage);
      } else {
        fetchUsers(newPage);
      }
    }
  };

  const getExportData = async () => {
    setIsExporting(true);
    try {
      let allUsers: UserProfile[] = [];

      if (debouncedSearchTerm && searchBuffer && searchBuffer.length > 0) {
        allUsers = filteredUsers;
      } else {
        const { data } = await supabase.from('users').select('*').limit(5000);
        allUsers = (data as unknown as UserProfile[]) || [];
      }

      if (selectedUserIds.length > 0) {
        allUsers = allUsers.filter(u => selectedUserIds.includes(u.uid || (u as any).id));
      }

      return allUsers.map(user => ({
        'Name': user.displayName,
        'Email': user.email,
        'Role': user.role.charAt(0).toUpperCase() + user.role.slice(1),
        'Joined Date': new Date(user.createdAt).toLocaleDateString()
      }));
    } catch (error) {
      console.error('Error fetching export data:', error);
      return [];
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    const data = await getExportData();
    if (data.length === 0) return;

    const fileName = `User_Management_${new Date().toISOString()}`;

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Users");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute('download', `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text('User Management Export', 14, 15);
      const headers = Object.keys(data[0]);
      const body = data.map(row => Object.values(row));
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 20,
      });
      doc.save(`${fileName}.pdf`);
    }
  };

  // If we are searching, we display all filtered results (from the 100 fetched)
  // If we are NOT searching, we display the current page of paged users
  const displayUsers = mainPaginatedUsers;

  const toggleSelectAll = () => {
    if (selectedUserIds.length === displayUsers.length) {
      setSelectedUserIds([]);
    } else {
      // Don't include self or arnab in selection for deletion
      setSelectedUserIds(displayUsers.filter(u => (u.uid || u.id) !== currentUserProfile?.uid && u.email !== 'arnab.roy@anudip.org').map(u => (u.uid! || u.id!)));
    }
  };

  const toggleSelectUser = (id: string) => {
    if (id === currentUserProfile?.uid) return;
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Shield className="w-3 h-3 text-primary" />;
      case 'examiner': return <UserCog className="w-3 h-3 text-blue-500" />;
      case 'student': return <GraduationCap className="w-3 h-3 text-green-500" />;
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading user database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            User Management
          </h2>
          <p className="text-muted-foreground text-sm">Assign roles and manage user accounts across the system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
            />
          </div>
          {selectedUserIds.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-2 animate-in zoom-in duration-200"
              onClick={() => {
                setIsBulkDelete(true);
                setUserToDelete(null);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedUserIds.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="border-2 border-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">User Directory</CardTitle>
              <CardDescription>
                {searchTerm 
                  ? `Found ${displayUsers.length} matching users` 
                  : `Showing ${displayUsers.length} of approx ${totalUsersCount} users`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={isExporting}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={isExporting}>
                <FileText className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={isExporting}>
                <FilePdf className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[50px] px-4">
                    <Checkbox 
                      checked={selectedUserIds.length > 0 && selectedUserIds.length === displayUsers.filter(u => (u.uid || u.id) !== currentUserProfile?.uid).length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="px-4">Name</TableHead>
                  <TableHead className="px-4">Email</TableHead>
                  <TableHead className="px-4">Current Role</TableHead>
                  <TableHead className="px-4">Change Role</TableHead>
                  <TableHead className="px-4 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-12 h-12 text-muted-foreground/20" />
                        <p>No users found matching your search.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayUsers.map((user) => (
                    <tr key={user.uid || user.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedUserIds.includes(user.uid! || user.id!) ? 'bg-primary/5' : ''}`}>
                      <TableCell className="px-4">
                        <Checkbox 
                          checked={selectedUserIds.includes(user.uid! || user.id!)} 
                          onCheckedChange={() => toggleSelectUser(user.uid! || user.id!)}
                          disabled={(user.uid || user.id) === currentUserProfile?.uid}
                        />
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3 py-1">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {user.displayName?.[0]}
                          </div>
                          <div>
                            <span className="font-semibold block">{user.displayName}</span>
                            {(user.uid || user.id) === currentUserProfile?.uid && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 leading-none mt-1">You (System)</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <span className="text-sm font-medium">{user.email}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-white shadow-sm border-border/50">
                          {getRoleIcon(user.role)}
                          <span className="capitalize">{user.role}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        <Select 
                          value={user.role} 
                          onValueChange={(value: UserRole) => handleRoleChange(user.uid! || user.id!, value)}
                          disabled={(user.uid || user.id) === currentUserProfile?.uid}
                        >
                          <SelectTrigger className="w-32 h-9 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="examiner">Examiner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-primary hover:bg-primary/10 h-8 w-8"
                            onClick={() => {
                              setUserToReset(user);
                              setIsResetPasswordOpen(true);
                            }}
                            disabled={(user.uid || user.id) === currentUserProfile?.uid || user.email === 'arnab.roy@anudip.org'}
                            title="Reset Password to Default"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                            onClick={() => {
                              setIsBulkDelete(false);
                              setUserToDelete(user.uid! || user.id!);
                              setIsDeleteDialogOpen(true);
                            }}
                            disabled={(user.uid || user.id) === currentUserProfile?.uid || user.email === 'arnab.roy@anudip.org'}
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          <div className="p-4 border-t flex items-center justify-between bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {debouncedSearchTerm && searchBuffer ? totalPages : Math.ceil(totalUsersCount / itemsPerPage)} (Total matching: {filteredUsers.length})
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || loading}
                className="px-3"
              >
                First
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium px-2">Page {currentPage}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={loading || (debouncedSearchTerm && searchBuffer ? currentPage >= totalPages : currentPage >= totalPages)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              {isBulkDelete 
                ? `Are you sure you want to delete ${selectedUserIds.length} selected user accounts? This action will permanently remove their profiles and all associated exam history from the system.`
                : `Are you sure you want to delete the user account for "${users.find(u => u.uid === userToDelete || u.id === userToDelete)?.displayName || 'this user'}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={isBulkDelete ? handleBulkDelete : handleDeleteUser}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-primary mb-2">
              <RefreshCw className="w-5 h-5" />
              <AlertDialogTitle>Reset User Password</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This will reset the password for <strong>{userToReset?.email}</strong> to <strong>Default1234</strong>. 
              The user will be required to change their password immediately upon their next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

