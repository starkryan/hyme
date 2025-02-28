"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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

// Component props
interface BugReportDetailsProps {
  report: BugReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BugReportDetails({ report, isOpen, onClose }: BugReportDetailsProps) {
  if (!report) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">{report.title}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${severityColors[report.severity]} text-white`}>
                {report.severity}
              </Badge>
              <Badge variant="outline" className={`${statusColors[report.status]} text-white`}>
                {statusLabels[report.status]}
              </Badge>
            </div>
          </div>
          <DialogDescription>
            Submitted on {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString()}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
              <p className="whitespace-pre-wrap">{report.description}</p>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Steps to Reproduce</h3>
              <p className="whitespace-pre-wrap">{report.steps_to_reproduce}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Expected Behavior</h3>
                <p className="whitespace-pre-wrap">{report.expected_behavior || 'Not provided'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Actual Behavior</h3>
                <p className="whitespace-pre-wrap">{report.actual_behavior}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Browser</h3>
                <p>{report.browser || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Device</h3>
                <p>{report.device || 'Not specified'}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h3>
              <p>{new Date(report.updated_at).toLocaleDateString()} at {new Date(report.updated_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-6">
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 