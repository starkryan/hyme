"use client";

import { useState, useEffect } from 'react';
import { redirect, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { checkRoleClient } from '@/lib/roles-client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Clock, X, Eye, RefreshCw, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Status colors for badges
const statusColors: Record<string, string> = {
  'new': 'bg-blue-500',
  'in_progress': 'bg-yellow-500',
  'resolved': 'bg-green-500',
  'closed': 'bg-gray-500',
  'wont_fix': 'bg-red-500',
};

// Severity colors
const severityColors: Record<string, string> = {
  'low': 'bg-blue-400',
  'medium': 'bg-yellow-400',
  'high': 'bg-orange-500',
  'critical': 'bg-red-600',
};

// Status labels for display
const statusLabels: Record<string, string> = {
  'new': 'New',
  'in_progress': 'In Progress',
  'resolved': 'Resolved',
  'closed': 'Closed',
  'wont_fix': 'Won\'t Fix',
};

// Bug report type definition
type BugReport = {
  id: string;
  title: string;
  description: string;
  steps_to_reproduce: string;
  expected_behavior: string | null;
  actual_behavior: string;
  browser: string | null;
  device: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id: string;
  email: string;
  username: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  created_at: string;
  updated_at: string;
};

export default function AdminBugReportsPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        toast.error('Please sign in to access this page');
        router.push('/signin');
        return;
      }

      if (!user) {
        toast.error('User data not available');
        router.push('/');
        return;
      }

      const isAdmin = checkRoleClient('admin', user);
      if (!isAdmin) {
        toast.error('You do not have permission to access this page');
        router.push('/');
        return;
      }

      setIsAuthorized(true);
      fetchBugReports();
    };

    checkAuthorization();
  }, [isLoaded, isSignedIn, router, user]);

  const fetchBugReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Apply filters if set
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      if (severityFilter) {
        query = query.eq('severity', severityFilter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        toast.error(`Failed to load bug reports: ${error.message}`);
        return;
      }
      
      if (!data) {
        toast.error('No data received from the server');
        return;
      }

      // Type guard to ensure data matches BugReport type
      const isValidBugReport = (item: any): item is BugReport => {
        return (
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.description === 'string' &&
          typeof item.steps_to_reproduce === 'string' &&
          typeof item.actual_behavior === 'string' &&
          ['low', 'medium', 'high', 'critical'].includes(item.severity) &&
          ['new', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(item.status)
        );
      };

      const validReports = data.filter(isValidBugReport);
      if (validReports.length !== data.length) {
        console.warn('Some bug reports had invalid data structure');
      }

      setBugReports(validReports);
    } catch (error) {
      console.error('Error fetching bug reports:', error);
      toast.error('An unexpected error occurred while loading bug reports');
    } finally {
      setLoading(false);
    }
  };

  const updateBugStatus = async (id: string, newStatus: string) => {
    try {
      // Validate status before making the request
      if (!['new', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(newStatus)) {
        throw new Error('Invalid status value');
      }

      // Store the previous state for rollback
      const previousReports = [...bugReports];
      const previousSelected = selectedReport ? { ...selectedReport } : null;

      // Optimistically update the UI
      const updatedAt = new Date().toISOString();
      setBugReports(prevReports =>
        prevReports.map(report =>
          report.id === id ? { ...report, status: newStatus as BugReport['status'], updated_at: updatedAt } : report
        )
      );

      if (selectedReport?.id === id) {
        setSelectedReport(prev => 
          prev ? { ...prev, status: newStatus as BugReport['status'], updated_at: updatedAt } : null
        );
      }

      // Show optimistic toast
      const toastId = toast.loading(`Updating status to ${statusLabels[newStatus]}...`);

      // First verify the bug report exists
      const { data: existingReport, error: checkError } = await supabase
        .from('bug_reports')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (checkError) {
        // Rollback on error
        setBugReports(previousReports);
        setSelectedReport(previousSelected);
        console.error('Supabase error:', checkError);
        toast.error(`Failed to verify bug report: ${checkError.message}`, { id: toastId });
        return;
      }

      if (!existingReport) {
        // Rollback if report doesn't exist
        setBugReports(previousReports);
        setSelectedReport(previousSelected);
        toast.error('Bug report not found', { id: toastId });
        return;
      }

      // Update the status
      const { error: updateError } = await supabase
        .from('bug_reports')
        .update({ 
          status: newStatus, 
          updated_at: updatedAt 
        })
        .eq('id', id);

      if (updateError) {
        // Rollback on error
        setBugReports(previousReports);
        setSelectedReport(previousSelected);
        console.error('Supabase error:', updateError);
        toast.error(`Failed to update status: ${updateError.message}`, { id: toastId });
        return;
      }

      // Success toast
      toast.success(`Status updated to ${statusLabels[newStatus]}`, { id: toastId });
    } catch (error) {
      console.error('Error updating bug status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
      // Refresh the bug reports to ensure UI is in sync with database
      fetchBugReports();
    }
  };

  const deleteBugReport = async (id: string) => {
    try {
      // First check if the report exists
      const { data: existingReport, error: checkError } = await supabase
        .from('bug_reports')
        .select('id, title')
        .eq('id', id)
        .single();

      if (checkError) {
        console.error('Error checking bug report:', checkError);
        toast.error('Failed to verify bug report');
        return;
      }

      if (!existingReport) {
        toast.error('Bug report not found');
        return;
      }

      // Show confirmation with report title
      if (!confirm(`Are you sure you want to delete the bug report "${existingReport.title}"? This action cannot be undone.`)) {
        return;
      }

      const { error: deleteError } = await supabase
        .from('bug_reports')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.error('Error deleting bug report:', deleteError);
        toast.error(`Failed to delete bug report: ${deleteError.message}`);
        return;
      }
      
      // Update local state
      setBugReports(prevReports => prevReports.filter(report => report.id !== id));
      
      // Close details dialog if open for this report
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setDetailsOpen(false);
      }
      
      toast.success('Bug report deleted successfully');
    } catch (error) {
      console.error('Unexpected error deleting bug report:', error);
      toast.error('An unexpected error occurred while deleting the bug report');
      
      // Refresh the bug reports to ensure UI is in sync with database
      fetchBugReports();
    }
  };

  const viewReportDetails = (report: BugReport) => {
    setSelectedReport(report);
    setDetailsOpen(true);
  };

  const closeReportDetails = () => {
    setDetailsOpen(false);
  };

  const applyFilters = () => {
    fetchBugReports();
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setSeverityFilter(null);
    setTimeout(() => {
      fetchBugReports();
    }, 100);
  };

  const getStatusActionButton = (status: string, reportId: string) => {
    switch (status) {
      case 'new':
        return (
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-600 border-yellow-500/20"
            onClick={() => updateBugStatus(reportId, 'in_progress')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Accept
          </Button>
        );
      case 'in_progress':
        return (
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600 border-green-500/20"
            onClick={() => updateBugStatus(reportId, 'resolved')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Resolve
          </Button>
        );
      default:
        return (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => updateBugStatus(reportId, 'in_progress')}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reopen
          </Button>
        );
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading bug reports...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // The useEffect will handle the redirect
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Bug Reports Management</CardTitle>
              <CardDescription>Review and manage user-submitted bug reports</CardDescription>
            </div>
            <Button onClick={fetchBugReports} className="shrink-0">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:flex gap-4">
              <Select value={statusFilter || undefined} onValueChange={value => setStatusFilter(value === 'all' ? null : value)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={severityFilter || undefined} onValueChange={value => setSeverityFilter(value === 'all' ? null : value)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={applyFilters}>Apply Filters</Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
              </div>
            </div>
          </div>
          
          {bugReports.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No bug reports found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {statusFilter || severityFilter ? 'Try changing your filters' : 'There are no bug reports submitted yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Submitted By</TableHead>
                    <TableHead className="hidden md:table-cell">Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bugReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1">{report.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {report.username || report.email || 'Anonymous'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`${severityColors[report.severity]} text-white`}>
                          {report.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusColors[report.status]} text-white`}>
                          {statusLabels[report.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => viewReportDetails(report)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {getStatusActionButton(report.status, report.id)}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <span className="sr-only">Open menu</span>
                                <span className="h-1 w-1 rounded-full bg-foreground"></span>
                                <span className="h-1 w-1 rounded-full bg-foreground"></span>
                                <span className="h-1 w-1 rounded-full bg-foreground"></span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateBugStatus(report.id, 'new')}>
                                Mark as New
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateBugStatus(report.id, 'in_progress')}>
                                Mark as In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateBugStatus(report.id, 'resolved')}>
                                Mark as Resolved
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateBugStatus(report.id, 'closed')}>
                                Mark as Closed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateBugStatus(report.id, 'wont_fix')}>
                                Mark as Won't Fix
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive" 
                                onClick={() => deleteBugReport(report.id)}
                              >
                                Delete Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Bug Report Details Dialog */}
      {selectedReport && (
        <Dialog open={detailsOpen} onOpenChange={closeReportDetails}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <DialogTitle className="text-xl font-semibold">{selectedReport.title}</DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${severityColors[selectedReport.severity]} text-white`}>
                    {selectedReport.severity}
                  </Badge>
                  <Badge variant="outline" className={`${statusColors[selectedReport.status]} text-white`}>
                    {statusLabels[selectedReport.status]}
                  </Badge>
                </div>
              </div>
              <DialogDescription>
                Submitted by {selectedReport.username || selectedReport.email || 'Anonymous'} on{' '}
                {new Date(selectedReport.created_at).toLocaleDateString()} at{' '}
                {new Date(selectedReport.created_at).toLocaleTimeString()}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                  <p className="whitespace-pre-wrap">{selectedReport.description}</p>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Steps to Reproduce</h3>
                  <p className="whitespace-pre-wrap">{selectedReport.steps_to_reproduce}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Expected Behavior</h3>
                    <p className="whitespace-pre-wrap">{selectedReport.expected_behavior || 'Not provided'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Actual Behavior</h3>
                    <p className="whitespace-pre-wrap">{selectedReport.actual_behavior}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Browser</h3>
                    <p>{selectedReport.browser || 'Not specified'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Device</h3>
                    <p>{selectedReport.device || 'Not specified'}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">User Details</h3>
                  <p><strong>User ID:</strong> {selectedReport.user_id}</p>
                  <p><strong>Email:</strong> {selectedReport.email || 'Not provided'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h3>
                  <p>{new Date(selectedReport.updated_at).toLocaleDateString()} at {new Date(selectedReport.updated_at).toLocaleTimeString()}</p>
                </div>
              </div>
            </ScrollArea>
            
            <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                {selectedReport.status === 'new' && (
                  <Button className="flex-1" onClick={() => updateBugStatus(selectedReport.id, 'in_progress')}>
                    <Clock className="h-4 w-4 mr-2" />
                    Accept Report
                  </Button>
                )}
                
                {selectedReport.status === 'in_progress' && (
                  <Button className="flex-1" onClick={() => updateBugStatus(selectedReport.id, 'resolved')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
                
                {(selectedReport.status === 'resolved' || selectedReport.status === 'closed' || selectedReport.status === 'wont_fix') && (
                  <Button className="flex-1" variant="outline" onClick={() => updateBugStatus(selectedReport.id, 'in_progress')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reopen Report
                  </Button>
                )}
              </div>
              
              <Select 
                defaultValue={selectedReport.status}
                onValueChange={(value) => updateBugStatus(selectedReport.id, value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={closeReportDetails}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 