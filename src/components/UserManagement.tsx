import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, writeBatch, query, orderBy, limit, startAfter, endBefore, limitToLast, getCountFromServer, where } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCog, GraduationCap, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '../hooks/useDebounce';
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
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  
  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async (direction?: 'next' | 'prev' | 'first') => {
    setLoading(true);
    try {
      const usersCol = collection(db, 'users');
      let q;

      // Get count if on first page or refresh or search
      if (direction === 'first' || !direction) {
        const countSnap = await getCountFromServer(usersCol);
        setTotalUsersCount(countSnap.data().count);
      }

      const baseConstraints = [orderBy('createdAt', 'desc'), limit(itemsPerPage)];

      if (searchTerm) {
        // Fetch more for search and filter on client to avoid complex index requirements
        // and because server-side search in firestore is limited to prefix
        q = query(usersCol, ...baseConstraints); 
      } else {
        if (direction === 'next' && lastDoc) {
          q = query(usersCol, ...baseConstraints, startAfter(lastDoc));
        } else if (direction === 'prev' && firstDoc) {
          q = query(usersCol, orderBy('createdAt', 'desc'), limitToLast(itemsPerPage), endBefore(firstDoc));
        } else {
          q = query(usersCol, ...baseConstraints);
        }
      }

      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      
      setUsers(usersData);
      setFirstDoc(snapshot.docs[0]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      
      if (!direction || direction === 'first') setCurrentPage(1);
      else if (direction === 'next') setCurrentPage(prev => prev + 1);
      else if (direction === 'prev') setCurrentPage(prev => prev - 1);

    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [itemsPerPage, debouncedSearchTerm, lastDoc, firstDoc]);

  useEffect(() => {
    fetchUsers('first');
  }, [debouncedSearchTerm]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers('first');
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      
      const updatedUser = users.find(u => u.uid === userId);
      if (currentUserProfile && updatedUser) {
        await logUserActivity(currentUserProfile, 'ROLE_CHANGE', `Changed role of user ${updatedUser.email} to ${newRole}`);
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
      const user = users.find(u => u.uid === userToDelete);
      await deleteDoc(doc(db, 'users', userToDelete));
      
      if (currentUserProfile && user) {
        await logUserActivity(currentUserProfile, 'DELETE_USER', `Deleted user account: ${user.email} (${user.displayName})`);
      }
      
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
      setSelectedUserIds(prev => prev.filter(id => id !== userToDelete));
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
      const batch = writeBatch(db);
      const deletedEmails: string[] = [];
      
      selectedUserIds.forEach(userId => {
        // Prevent deleting self in bulk
        if (userId === currentUserProfile?.uid) return;
        
        const user = users.find(u => u.uid === userId);
        if (user) deletedEmails.push(user.email);
        batch.delete(doc(db, 'users', userId));
      });
      
      await batch.commit();
      
      if (currentUserProfile) {
        await logUserActivity(currentUserProfile, 'BULK_DELETE_USERS', `Deleted ${deletedEmails.length} user accounts: ${deletedEmails.join(', ')}`);
      }
      
      setSelectedUserIds([]);
      setIsBulkDelete(false);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Failed to perform bulk delete.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const toggleSelectAll = () => {
    // Select all CURRENTLY VISIBLE filtered users (not just on current page, or maybe just on current page?)
    // User said "bulk user" usually implies across the filtered list
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      // Don't include self in selection for deletion
      setSelectedUserIds(filteredUsers.filter(u => u.uid !== currentUserProfile?.uid).map(u => u.uid));
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
          <CardTitle className="text-lg">User Directory</CardTitle>
          <CardDescription>
            Showing {Math.min(filteredUsers.length, itemsPerPage)} of {filteredUsers.length} total users
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[50px] px-4">
                    <Checkbox 
                      checked={selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.filter(u => u.uid !== currentUserProfile?.uid).length}
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
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-12 h-12 text-muted-foreground/20" />
                        <p>No users found matching your search.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.uid} className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedUserIds.includes(user.uid) ? 'bg-primary/5' : ''}`}>
                      <TableCell className="px-4">
                        <Checkbox 
                          checked={selectedUserIds.includes(user.uid)} 
                          onCheckedChange={() => toggleSelectUser(user.uid)}
                          disabled={user.uid === currentUserProfile?.uid}
                        />
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3 py-1">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {user.displayName?.[0]}
                          </div>
                          <div>
                            <span className="font-semibold block">{user.displayName}</span>
                            {user.uid === currentUserProfile?.uid && (
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
                          onValueChange={(value: UserRole) => handleRoleChange(user.uid, value)}
                          disabled={user.uid === currentUserProfile?.uid}
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                          onClick={() => {
                            setIsBulkDelete(false);
                            setUserToDelete(user.uid);
                            setIsDeleteDialogOpen(true);
                          }}
                          disabled={user.uid === currentUserProfile?.uid}
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
              {searchTerm 
                ? `Search results shown (limited)` 
                : `Page ${currentPage} (approx ${totalUsersCount} total users)`
              }
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchUsers('first')}
                disabled={currentPage === 1 || loading}
                className="px-3"
              >
                First
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchUsers('prev')}
                disabled={currentPage === 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium px-2">Page {currentPage}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchUsers('next')}
                disabled={users.length < itemsPerPage || loading}
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
                : `Are you sure you want to delete the user account for "${users.find(u => u.uid === userToDelete)?.displayName || 'this user'}"? This action cannot be undone.`}
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
    </div>
  );
};
