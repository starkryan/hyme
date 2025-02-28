"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBug, IconBrowser, IconDeviceDesktop } from '@tabler/icons-react';

// Form schema using Zod for validation
const formSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(1000, 'Description must be less than 1000 characters'),
  stepsToReproduce: z.string().min(10, 'Steps must be at least 10 characters').max(500, 'Steps must be less than 500 characters'),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().min(10, 'Actual behavior must be at least 10 characters'),
  browser: z.string().optional(),
  device: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

// Define the type for the form data
type BugReportFormValues = z.infer<typeof formSchema>;

export default function BugReportPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize the form
  const form = useForm<BugReportFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      stepsToReproduce: '',
      expectedBehavior: '',
      actualBehavior: '',
      browser: '',
      device: '',
      severity: 'medium',
    },
  });

  async function onSubmit(values: BugReportFormValues) {
    if (!isSignedIn) {
      toast.error('You must be logged in to report a bug');
      router.push('/signin');
      return;
    }

    setIsSubmitting(true);

    try {
      // Add user info to the bug report
      const reportData = {
        ...values,
        userId: user?.id,
        email: user?.primaryEmailAddress?.emailAddress,
        username: user?.username || user?.firstName,
        status: 'new',
        createdAt: new Date().toISOString(),
      };

      // Submit to your API
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit bug report');
      }

      // Show success message
      toast.success('Bug report submitted successfully! Thank you for your feedback.');
      
      // Reset the form
      form.reset();
      
      // Redirect to my-bug-reports page after a short delay
      setTimeout(() => {
        router.push('/my-bug-reports');
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting bug report:', error);
      toast.error('Failed to submit bug report. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center space-x-2">
            <IconBug className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">Report a Bug</CardTitle>
          </div>
          <CardDescription>
            Found an issue with our service? Help us improve by submitting a bug report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bug Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Briefly describe the issue" {...field} />
                    </FormControl>
                    <FormDescription>
                      A short, descriptive title for the bug.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the bug"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide as much detail as possible about the issue.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="browser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Browser</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <IconBrowser className="h-5 w-5 text-muted-foreground mt-2" />
                          <Input placeholder="Chrome, Firefox, etc." {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="device"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <IconDeviceDesktop className="h-5 w-5 text-muted-foreground mt-2" />
                          <Input placeholder="Desktop, iPhone, etc." {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the severity level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low - Minor issue, doesn't affect core functionality</SelectItem>
                        <SelectItem value="medium">Medium - Affects functionality but has workarounds</SelectItem>
                        <SelectItem value="high">High - Major functionality is broken</SelectItem>
                        <SelectItem value="critical">Critical - Service is unusable</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stepsToReproduce"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steps to Reproduce</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="1. Go to page X&#10;2. Click on Y&#10;3. Observe Z"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      List the steps needed to reproduce the bug.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="expectedBehavior"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Behavior</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What should have happened?"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actualBehavior"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Behavior</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What actually happened?"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <CardFooter className="px-0 flex justify-end">
                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Bug Report'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 