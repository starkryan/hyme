import { useEffect, useState } from 'react';
import { getBalance } from '@/lib/5simService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const Balance = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getBalance();
        if (data) {
          setBalance(data.balance);
        } else {
          setError('Failed to fetch balance.');
          toast.error('Failed to fetch balance.');
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.');
        toast.error(e.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Badge variant="secondary">Loading...</Badge>
        ) : error ? (
          <Badge variant="destructive">{error}</Badge>
        ) : (
          <div>
            Current Balance: <Badge variant="outline">${balance}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Balance; 