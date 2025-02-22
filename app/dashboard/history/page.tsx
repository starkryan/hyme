"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, MessageSquare, Clock, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// You'll need to implement this interface based on your 5sim API response
interface OrderHistory {
  id: number;
  phone: string;
  service: string;
  status: string;
  created_at: string;
  sms_code?: string;
}

const HistoryPage = () => {
  const router = useRouter();
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement fetch history from 5sim API
    const fetchHistory = async () => {
      try {
        // Replace with actual API call
        const response = await fetch('/api/history');
        const data = await response.json();
        setHistory(data);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Order History</CardTitle>
          <CardDescription>Your past virtual number orders</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <span className="loading">Loading...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>No history found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((order) => (
                  <Card key={order.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4" />
                          <span className="font-mono">{order.phone}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>{order.service}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(order.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary"
                        className={`${getStatusColor(order.status)} text-white`}
                      >
                        {order.status}
                      </Badge>
                    </div>
                    {order.sms_code && (
                      <div className="mt-2 p-2 bg-muted rounded">
                        <p className="font-mono">SMS Code: {order.sms_code}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryPage; 