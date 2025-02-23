import { useState } from 'react';
import { getSmsCode } from '@/lib/5simService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CheckSMS = () => {
  const [orderId, setOrderId] = useState('');
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckSMS = async () => {
    setIsLoading(true);
    setError(null);
    setSmsCode(null);
    try {
      const data = await getSmsCode(orderId);
      if (data && data.sms && data.sms.length > 0) {
        setSmsCode(data.sms[0].code);
        toast.success(`SMS Code: ${data.sms[0].code}`);
      } else {
        setError('No SMS code found.');
        toast.error('No SMS code found.');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
      toast.error(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check SMS Code</CardTitle>
    </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="orderId" className="text-right">
              Order ID:
            </label>
            <Input
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="col-span-3"
            />
          </div>
          <Button onClick={handleCheckSMS} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Check SMS'}
          </Button>
          {smsCode && (
            <div>
              <Badge variant="secondary">SMS Code:</Badge> {smsCode}
            </div>
          )}
          {error && <Badge variant="destructive">{error}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckSMS; 