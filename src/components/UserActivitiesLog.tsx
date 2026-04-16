import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { UserActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, FileSpreadsheet, FileText, Checkbox } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const UserActivitiesLog: React.FC = () => {
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<UserActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'user_activities'), orderBy('timestamp', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserActivityLog));
      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredLogs(logs);
      return;
    }
    const lower = searchTerm.toLowerCase();
    setFilteredLogs(logs.filter(log => 
      log.userName.toLowerCase().includes(lower) ||
      log.userEmail.toLowerCase().includes(lower) ||
      log.action.toLowerCase().includes(lower) ||
      log.details.toLowerCase().includes(lower)
    ));
  }, [searchTerm, logs]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLogs(new Set(filteredLogs.map(l => l.id as string)));
    } else {
      setSelectedLogs(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedLogs);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedLogs(next);
  };

  const getLogsToExport = () => {
    if (selectedLogs.size === 0) return filteredLogs; // If none selected, export all filtered
    return filteredLogs.filter(l => selectedLogs.has(l.id as string));
  };

  const exportExcel = () => {
    const dataToExport = getLogsToExport().map(log => ({
      Timestamp: new Date(log.timestamp).toLocaleString(),
      Name: log.userName,
      Email: log.userEmail,
      Action: log.action,
      Details: log.details
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Activities');
    XLSX.writeFile(workbook, `user_activities_${new Date().toISOString()}.xlsx`);
  };

  const exportCSV = () => {
    const dataToExport = getLogsToExport().map(log => ({
      Timestamp: new Date(log.timestamp).toLocaleString(),
      Name: log.userName,
      Email: log.userEmail,
      Action: log.action,
      Details: log.details
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `user_activities_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const dataToExport = getLogsToExport().map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.userName,
      log.userEmail,
      log.action,
      log.details
    ]);

    doc.text('User Activities Log', 14, 15);
    autoTable(doc, {
      head: [['Timestamp', 'User Name', 'Email', 'Action', 'Details']],
      body: dataToExport,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`user_activities_${new Date().toISOString()}.pdf`);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading user activities...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">User Activities</h2>
          <p className="text-muted-foreground">Audit log of system usage and actions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4 text-blue-600" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <FileText className="w-4 h-4 text-red-600" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({filteredLogs.length})</CardTitle>
          <CardDescription>
            {selectedLogs.size > 0 ? `${selectedLogs.size} logs selected for export` : 'Exporting without selection will export all filtered records.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search logs by name, email, action, details..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="border rounded-md overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 w-12 border-b">
                    <input 
                      type="checkbox" 
                      checked={selectedLogs.size === filteredLogs.length && filteredLogs.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="p-3 font-semibold border-b">Timestamp</th>
                  <th className="p-3 font-semibold border-b">User Name</th>
                  <th className="p-3 font-semibold border-b">Action</th>
                  <th className="p-3 font-semibold border-b">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">No logs found.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          checked={selectedLogs.has(log.id as string)}
                          onChange={(e) => handleSelectOne(log.id as string, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{log.userName}</div>
                        <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
