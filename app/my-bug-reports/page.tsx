"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { AlertCircle, Bug, RefreshCw, FileEdit, Eye } from 'lucide-react';
import Link from 'next/link';
import { BugReportDetails } from './BugReportDetails';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Status badge colors
const statusColors: Record<string, string> = {
  'new': 'bg-blue-500',
  'in_progress': 'bg-yellow-500',
  'resolved': 'bg-green-500',
  'closed': 'bg-gray-500',
  'wont_fix': 'bg-red-500',
};

// Severity badge colors
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

export default function MyBugReportsPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<string[]>([]);

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/signin');
      toast.error('You must be logged in to view your bug reports');
    }
  }, [isLoaded, isSignedIn, router]);

  // Fetch user's bug reports with auto-refresh
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      fetchUserBugReports();
      
      // Set up periodic refresh every 15 seconds
      const refreshInterval = setInterval(() => {
        fetchUserBugReports(false); // Silent refresh without loading indicator
      }, 15000);
      
      // Cleanup interval on unmount
      return () => clearInterval(refreshInterval);
    }
  }, [isLoaded, isSignedIn, user]);

  const fetchUserBugReports = async (showLoading = true) => {
    if (!user?.id) return;
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      let query = supabase
        .from('bug_reports')
        .select('*')
        .eq('user_id', user.id);
      
      // Apply status filter if selected
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Get the results ordered by creation date
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Check for status changes
      const updatedIds = [];
      if (bugReports.length > 0 && data) {
        for (const newReport of data) {
          const oldReport = bugReports.find(r => r.id === newReport.id);
          if (oldReport && oldReport.status !== newReport.status) {
            updatedIds.push(newReport.id);
            // Show toast notification for status change
            toast.success(`Bug "${newReport.title}" status changed from ${statusLabels[oldReport.status]} to ${statusLabels[newReport.status]}`);
          }
        }
      }
      
      setBugReports(data as BugReport[]);
      
      // Set recently updated IDs for highlighting
      if (updatedIds.length > 0) {
        setRecentlyUpdatedIds(updatedIds);
        // Clear highlights after 5 seconds
        setTimeout(() => {
          setRecentlyUpdatedIds([]);
        }, 5000);
      }
      
      // Update refresh time
      setLastRefreshTime(new Date().toLocaleTimeString());
      
      // Log to help debug
      console.log('Fetched bug reports:', data);
    } catch (error) {
      console.error('Error fetching bug reports:', error);
      if (showLoading) {
        toast.error('Failed to load your bug reports');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  // Re-fetch reports when status filter changes
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id) {
      fetchUserBugReports();
    }
  }, [statusFilter, isLoaded, isSignedIn, user]);

  const viewReportDetails = (report: BugReport) => {
    setSelectedReport(report);
    setIsDetailsOpen(true);
  };

  const closeReportDetails = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedReport(null), 300); // Clear after animation completes
  };

  // Handle loading state
  if (!isLoaded || (isLoaded && !isSignedIn)) {
    return (
      <div className="flex justify-center items-center p-12">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Bug className="h-6 w-6 text-primary" />
            <CardTitle>My Bug Reports</CardTitle>
          </div>
          <CardDescription>
            Track the status of your submitted bug reports
            {lastRefreshTime && ` · Last updated at ${lastRefreshTime}`}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="w-full md:w-1/3">
              <Select 
                value={statusFilter} 
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
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
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter === 'all' 
                  ? `Showing all ${bugReports.length} reports` 
                  : `Showing ${bugReports.length} ${statusFilter.replace('_', ' ')} reports`}
              </p>
            </div>
            <div className="flex gap-4">
              <Button 
                onClick={() => fetchUserBugReports()} 
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Link href="/bug-report">
                <Button size="sm" className="flex items-center gap-2">
                  <FileEdit className="h-4 w-4" />
                  Report New Bug
                </Button>
              </Link>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-12">
              <p>Loading your bug reports...</p>
            </div>
          ) : bugReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-md bg-muted/20">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground mb-4">You haven't reported any bugs yet</p>
              <Link href="/bug-report">
                <Button>Report a Bug</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bugReports.map((report) => (
                    <TableRow key={report.id} className={`group hover:bg-muted/50 ${recentlyUpdatedIds.includes(report.id) ? "bg-yellow-50 dark:bg-yellow-900/20 transition-colors duration-500" : ""}`}>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${severityColors[report.severity]} text-white`}>
                          {report.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusColors[report.status]} text-white`}>
                          {statusLabels[report.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(report.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(report.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewReportDetails(report)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline-block">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col items-start border-t p-6">
          <h3 className="text-base font-medium mb-2">Status Meaning</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${statusColors['new']} text-white`}>
                New
              </Badge>
              <span className="text-sm">Your report has been received</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${statusColors['in_progress']} text-white`}>
                In Progress
              </Badge>
              <span className="text-sm">We're working on this issue</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${statusColors['resolved']} text-white`}>
                Resolved
              </Badge>
              <span className="text-sm">Issue has been fixed</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${statusColors['closed']} text-white`}>
                Closed
              </Badge>
              <span className="text-sm">Report is closed</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${statusColors['wont_fix']} text-white`}>
                Won't Fix
              </Badge>
              <span className="text-sm">Issue won't be addressed</span>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Detail dialog */}
      <BugReportDetails 
        report={selectedReport} 
        isOpen={isDetailsOpen} 
        onClose={closeReportDetails} 
      />
    </div>
  );
} 