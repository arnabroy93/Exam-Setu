import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { UserActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, FileSpreadsheet, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSystemStats } from '../lib/stats';

export const UserActivitiesLog: React.FC = () => {
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<UserActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [searchBuffer, setSearchBuffer] = useState<UserActivityLog[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const fetchLogs = useCallback(async (newPage: number, force = false) => {
    setLoading(true);
    try {
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.trim().toLowerCase();
        if (!force && searchBuffer && term.startsWith(lastSearchQuery.toLowerCase()) && lastSearchQuery !== '') {
          setLoading(false);
          return;
        }
        
        const { data } = await supabase
          .from('user_activities')
          .select('*')
          .or(`userName.ilike.%${term}%,userEmail.ilike.%${term}%,action.ilike.%${term}%`)
          .order('timestamp', { ascending: false })
          .limit(1000);
          
        setSearchBuffer((data as unknown as UserActivityLog[]) || []);
        setLastSearchQuery(term);
        setCurrentPage(1);
      } else {
        setSearchBuffer(null);
        setLastSearchQuery('');

        const from = (newPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, count } = await supabase
          .from('user_activities')
          .select('*', { count: 'exact' })
          .order('timestamp', { ascending: false })
          .range(from, to);

        if (count !== null) setTotalLogsCount(count);
        setLogs((data as unknown as UserActivityLog[]) || []);
        setFilteredLogs((data as unknown as UserActivityLog[]) || []);
        setCurrentPage(newPage);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, debouncedSearchTerm, searchBuffer, lastSearchQuery, loading]);

  useEffect(() => {
    fetchLogs(1);
  }, [debouncedSearchTerm]);

  const handleRefresh = () => {
    setSearchBuffer(null);
    fetchLogs(1, true);
  };

  const currentDisplayLogs = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    if (term && searchBuffer) {
      const filtered = searchBuffer.filter(log => 
        (log.userName || '').toLowerCase().includes(term) ||
        (log.userEmail || '').toLowerCase().includes(term) ||
        (log.action || '').toLowerCase().includes(term)
      );
      const start = (currentPage - 1) * itemsPerPage;
      return filtered.slice(start, start + itemsPerPage);
    }
    return logs;
  }, [logs, searchBuffer, debouncedSearchTerm, currentPage, itemsPerPage]);

  const totalFilteredCount = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    if (term && searchBuffer) {
      return searchBuffer.filter(log => 
        (log.userName || '').toLowerCase().includes(term) ||
        (log.userEmail || '').toLowerCase().includes(term) ||
        (log.action || '').toLowerCase().includes(term)
      ).length;
    }
    return totalLogsCount;
  }, [totalLogsCount, searchBuffer, debouncedSearchTerm]);
  
  const totalPages = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      return Math.ceil(totalFilteredCount / itemsPerPage);
    }
    return Math.ceil(totalLogsCount / itemsPerPage);
  }, [totalLogsCount, itemsPerPage, debouncedSearchTerm, totalFilteredCount, searchBuffer]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      if (debouncedSearchTerm && searchBuffer) {
        setCurrentPage(newPage);
      } else {
        fetchLogs(newPage);
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLogs(new Set(currentDisplayLogs.map(l => l.id as string)));
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

  const [isExporting, setIsExporting] = useState(false);

  const getLogsToExport = async () => {
    if (selectedLogs.size > 0) {
      return filteredLogs.filter(l => selectedLogs.has(l.id as string));
    }
    
    // Optimization: If search is active and we have a buffer, use it instead of fetching 5000 new docs
    if (debouncedSearchTerm && searchBuffer && searchBuffer.length > 0) {
      return filteredLogs;
    }

    setIsExporting(true);
    try {
      const { data } = await supabase.from('user_activities').select('*').order('timestamp', { ascending: false }).limit(5000);
      let allExportData = (data as unknown as UserActivityLog[]) || [];
      
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        allExportData = allExportData.filter(log => 
          log.userName.toLowerCase().includes(term) ||
          log.userEmail.toLowerCase().includes(term) ||
          log.action.toLowerCase().includes(term)
        );
      }
      return allExportData;
    } catch (error) {
      console.error("Export fetch error:", error);
      return [];
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = async () => {
    const records = await getLogsToExport();
    const dataToExport = records.map(log => ({
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

  const exportCSV = async () => {
    const records = await getLogsToExport();
    const dataToExport = records.map(log => ({
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

  const exportPDF = async () => {
    const records = await getLogsToExport();
    const doc = new jsPDF();
    const dataToExport = records.map(log => [
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

  if (loading && logs.length === 0) {
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
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <Search className="w-4 h-4" /> Refresh
          </Button>
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
                      checked={selectedLogs.size === logs.length && logs.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 font-semibold border-b">Timestamp</th>
                  <th className="p-3 font-semibold border-b">User Name</th>
                  <th className="p-3 font-semibold border-b">Action</th>
                  <th className="p-3 font-semibold border-b">Details</th>
                </tr>
              </thead>
              <tbody>
                {currentDisplayLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">No logs found.</td>
                  </tr>
                ) : (
                  currentDisplayLogs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          checked={selectedLogs.has(log.id as string)}
                          onChange={(e) => handleSelectOne(log.id as string, e.target.checked)}
                          className="rounded border-gray-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground tabular-nums">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{log.userName}</div>
                        <div className="text-[10px] text-muted-foreground">{log.userEmail}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground break-words max-w-xs">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between bg-muted/20 p-2 rounded-lg border border-border">
            <div className="text-xs text-muted-foreground px-2">
              {debouncedSearchTerm && searchBuffer 
                ? `Showing matching logs (${totalFilteredCount} matches)` 
                : `Page ${currentPage} of ${totalPages} (approx ${totalLogsCount} total entries)`
              }
            </div>
            <div className="flex items-center gap-1">
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
                disabled={loading || currentPage >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
