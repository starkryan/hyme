import { useState, useEffect, useRef } from 'react';
import { getVirtualNumber, getProducts, getSmsCode, cancelOrder, getCountries, banOrder, finishOrder } from '@/lib/5simService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Copy, Check, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface SmsMessage {
  created_at: string;
  date: string;
  sender: string;
  text: string;
  code: string;
}

interface Product {
  id: number;
  name: string;
  Price: number;
  Qty: number;
}

type OrderStatus = "PENDING" | "RECEIVED" | "CANCELED" | "TIMEOUT" | "FINISHED" | "BANNED";

const GetVirtualNumber = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);
  const [number, setNumber] = useState<{ phone: string; id: string } | null>(null);
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string>("india");
  const [isCheckingSms, setIsCheckingSms] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isCountryLoading, setIsCountryLoading] = useState(false);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const smsCheckInterval = useRef<number | null>(null);
  const [isOrderCancelled, setIsOrderCancelled] = useState(false);
  const [fullSms, setFullSms] = useState<string | null>(null);
  const [isNumberCopied, setIsNumberCopied] = useState(false);
  const [isOtpCopied, setIsOtpCopied] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(true);

  useEffect(() => {
    const fetchAvailableCountries = async () => {
      setIsCountryLoading(true);
      setError(null);
      try {
        const data = await getCountries();
        console.log('Fetched countries:', data);
        if (data && typeof data === 'object') {
          const countries = Object.keys(data);
          console.log('Available countries:', countries);
          setAvailableCountries(countries);
        } else {
          setError('Failed to fetch countries: Invalid data format.');
          toast.error('Failed to fetch countries: Invalid data format.');
        }
      } catch (e: any) {
        console.error('Error fetching countries:', e);
        setError(e.message || 'An unexpected error occurred.');
        toast.error(e.message || 'An unexpected error occurred.');
      } finally {
        setIsCountryLoading(false);
      }
    };

    fetchAvailableCountries();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsProductLoading(true);
      setError(null);
      try {
        const data = await getProducts(countryCode);
        console.log('Fetched products:', data);
        if (data && Array.isArray(data)) {
          setProducts(data);
          console.log('All products:', data);
        } else {
          setError('Failed to fetch products: Invalid data format.');
          toast.error('Failed to fetch products: Invalid data format.');
        }
      } catch (e: any) {
        console.error('Error fetching products:', e);
        setError(e.message || 'An unexpected error occurred.');
        toast.error(e.message || 'An unexpected error occurred.');
      } finally {
        setIsProductLoading(false);
      }
    };

    fetchProducts();
  }, [countryCode]);

  useEffect(() => {
    if (number?.id && isCheckingSms) {
      // Clear any existing interval
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current);
      }

      smsCheckInterval.current = window.setInterval(async () => {
        try {
          const data = await getSmsCode(number.id);
          console.log(`SMS data for order ID ${number.id}:`, data);
          if (data && data.sms && data.sms.length > 0) {
            const sms: SmsMessage = data.sms[0];
            setSmsCode(sms.code);
            setFullSms(sms.text); // Store the full SMS message
            console.log(`SMS code received for order ID ${number.id}:`, sms.code);
            toast.success(`SMS Code: ${sms.code}`);
            setIsCheckingSms(false);
            setOrderStatus(data.status as OrderStatus);
            if (smsCheckInterval.current) {
              clearInterval(smsCheckInterval.current);
              smsCheckInterval.current = null; // Clear the interval ID
            }
          } else {
            console.log('Waiting for SMS...');
            setOrderStatus(data?.status as OrderStatus);
          }
        } catch (e: any) {
          console.error(`Error fetching SMS code for order ID ${number.id}:`, e);
          setError(e.message || 'An unexpected error occurred.');
          toast.error(e.message || 'An unexpected error occurred.');
          setIsCheckingSms(false);
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current);
            smsCheckInterval.current = null; // Clear the interval ID
          }
        }
      }, 5000); // Check every 5 seconds

      // Cleanup interval on unmount or when dependencies change
      return () => {
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current);
          smsCheckInterval.current = null; // Clear the interval ID
        }
      };
    }
  }, [number?.id, isCheckingSms]);

  const handleGetNumber = async () => {
    setIsLoading(true);
    setError(null);
    setNumber(null);
    setSmsCode(null);
    setIsCheckingSms(false);
    setIsOrderCancelled(false);
    setOrderStatus(null);

    try {
      if (!selectedProduct) {
        setError('Please select a product.');
        toast.error('Please select a product.');
        return;
      }

      console.log('Getting virtual number with:', { countryCode, selectedProduct });
      const data = await getVirtualNumber(countryCode, selectedProduct);
      console.log('Virtual number data:', data);

      if (data) {
        if (data.phone) {
          setNumber({ phone: data.phone, id: data.id });
          setOrderId(Number(data.id));
          toast.success(`Number ${data.phone} received!`);
          setIsCheckingSms(true); // Start checking for SMS
          setOrderStatus("PENDING");
        } else {
          setError('Phone number not received from the service.');
          toast.error('Phone number not received from the service.');
        }
      } else {
        setError('No free phones available for this service');
        toast.error('No free phones available for this service');
      }
    } catch (e: any) {
      console.error('Error getting virtual number:', e);
      if (e.message === 'No free phones available for this service') {
        setError('No free phones available for the selected service. Please try again later or select a different service.');
        toast.error('No free phones available for the selected service. Please try again later or select a different service.');
      }
       else if (e.message.includes('Request failed with status code 400')) {
        setError('Invalid product selected for the chosen country. Please select a valid product.');
        toast.error('Invalid product selected for the chosen country. Please select a valid product.');
      }
      else {
        setError(e.message || 'An unexpected error occurred.');
        toast.error(e.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!orderId) {
        setError('No order ID to cancel.');
        toast.error('No order ID to cancel.');
        return;
      }

      console.log('Cancelling order with ID:', orderId);
      const data = await cancelOrder(orderId);
      console.log('Cancel order response:', data);
      if (data) {
        toast.success('Order cancelled successfully.');
        setNumber(null);
        setSmsCode(null);
        setIsCheckingSms(false);
        setIsOrderCancelled(true);
        setOrderStatus("CANCELED");
      } else {
        setError('Failed to cancel order.');
        toast.error('Failed to cancel order.');
      }
    } catch (e: any) {
      console.error('Error cancelling order:', e);
      setError(e.message || 'An unexpected error occurred.');
      toast.error(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanNumber = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!number?.id) {
        setError('No number ID to ban.');
        toast.error('No number ID to ban.');
        return;
      }

      const data = await banOrder(Number(number.id)); // Call the banNumber API
      console.log('Ban number response:', data);

      if (data) {
        toast.success('Number banned successfully. This number cannot be used again.');
        setNumber(null);
        setSmsCode(null);
        setIsCheckingSms(false);
        setIsOrderCancelled(true);
        setOrderStatus("BANNED");
        setIsOtpVerified(false); // Disable complete and ban options
      } else {
        setError('Failed to ban number.');
        toast.error('Failed to ban number.');
      }

    } catch (e: any) {
      console.error('Error banning number:', e);
      setError(e.message || 'An unexpected error occurred.');
      toast.error(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = (text: string, setState: (value: boolean) => void) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setState(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setState(false), 2000); // Reset state after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy text.');
      });
  };

  const getStatusColor = (status: OrderStatus | null): string => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "RECEIVED":
        return "bg-blue-100 text-blue-800";
      case "CANCELED":
        return "bg-gray-100 text-gray-800";
      case "TIMEOUT":
        return "bg-orange-100 text-orange-800";
      case "FINISHED":
        return "bg-green-100 text-green-800";
      case "BANNED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-50 text-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get Virtual Number</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="country" className="text-right">
              Country:
            </Label>
            <Select onValueChange={setCountryCode} defaultValue={countryCode}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {isCountryLoading ? (
                  <SelectItem disabled>Loading countries...</SelectItem>
                ) : availableCountries.length > 0 ? (
                  availableCountries.map((country, index) => (
                    <SelectItem key={index} value={country}>
                      {country}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled>No countries available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product" className="text-right">
              Product:
            </Label>
            <Select onValueChange={setSelectedProduct} key={products.length}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {isProductLoading ? (
                  <SelectItem disabled>Loading products...</SelectItem>
                ) : products.length > 0 ? (
                  products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name} - ${product.Price} - {product.Qty}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled>No products available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGetNumber} disabled={isLoading || isOrderCancelled} className="col-span-4">
            {isLoading ? 'Loading...' : 'Get Number'}
          </Button>
          {number && number.phone && (
            <>
              <div className="col-span-4 flex items-center justify-between rounded-md border p-2">
                <div className="flex-grow">
                  <Badge variant="secondary">Number:</Badge> {number.phone}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                  disabled={isNumberCopied}
                >
                  {isNumberCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {orderStatus && (
                <div className="col-span-4">
                  <Badge className={getStatusColor(orderStatus)}>
                    {orderStatus}
                  </Badge>
                </div>
              )}
            </>
          )}
          {isCheckingSms && !smsCode && (
            <div className="col-span-4 flex items-center space-x-2">
              <Clock className="h-4 w-4 animate-spin" />
              <span>Waiting for OTP...</span>
            </div>
          )}
          {smsCode && (
            <div className="col-span-4">
              <div className="col-span-4 flex items-center justify-between rounded-md border p-2">
                <div className="flex-grow">
                  <Badge variant="secondary">SMS Code:</Badge> {smsCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyToClipboard(smsCode, setIsOtpCopied)}
                  disabled={isOtpCopied}
                >
                  {isOtpCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          {fullSms && (
            <div className="col-span-4 rounded-md border p-4">
              <Badge variant="secondary">Full SMS:</Badge>
              <p className="mt-2">{fullSms}</p>
            </div>
          )}
          {error && (
            <div className="col-span-4 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <Badge variant="destructive">{error}</Badge>
            </div>
          )}
          {number && (
            <Button onClick={handleCancelOrder} disabled={isLoading} className="col-span-4">
              Cancel Order
            </Button>
          )}
          {number && (
            <Button onClick={handleBanNumber} disabled={isLoading} className="col-span-4">
              Ban Number
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GetVirtualNumber; 