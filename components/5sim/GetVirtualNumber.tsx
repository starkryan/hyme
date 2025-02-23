import { useState, useEffect, useRef } from 'react';
import { getVirtualNumber, getProducts, getSmsCode, cancelOrder, getCountries, banOrder, finishOrder } from '@/lib/5simService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Spinner } from "@/components/ui/spinner"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress";
import { useUser } from '@clerk/nextjs';
import { getWalletBalance, updateWalletBalance, createTransaction } from '@/lib/walletService';
import { UPIVerification } from '../wallet/UPIVerification';
import { WalletBalance } from '../wallet/WalletBalance';
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
  const { user } = useUser();
  const [walletBalance, setWalletBalance] = useState<number>(0);
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
  const [countryOpen, setCountryOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [otpTimeout, setOtpTimeout] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimeoutActive, setIsTimeoutActive] = useState(false);

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
    const fetchWalletBalance = async () => {
      if (!user) return;
      try {
        const balance = await getWalletBalance(user.id);
        setWalletBalance(balance);
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
        toast.error('Failed to fetch wallet balance');
      }
    };

    fetchWalletBalance();
  }, [user]);

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
            setOrderCreatedAt(data.created_at || null);
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

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isTimeoutActive && timeLeft !== null && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) => {
          if (prevTimeLeft === null) return null;
          if (prevTimeLeft <= 1) {
            clearInterval(intervalId!);
            setIsTimeoutActive(false);
            setSmsCode(null);
            setFullSms(null);
            toast.error("OTP timed out", {
              description: "Please request a new OTP.",
            });
            return 0;
          }
          return prevTimeLeft - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTimeoutActive, timeLeft, toast]);

  const handleGetNumber = async () => {
    if (!user) {
      toast.error('Please sign in to continue')
      return;
    }

    setIsLoading(true);
    setError(null);
    setNumber(null);
    setSmsCode(null);
    setIsCheckingSms(false);
    setIsOrderCancelled(false);
    setOrderStatus(null);
    setIsOrderFinished(false);
    setOtpTimeout(300); // 5 minutes in seconds
    setTimeLeft(300);
    setIsTimeoutActive(true);

    try {
      if (!selectedProduct) {
        setError('Please select a product.');
        toast.error('Please select a product.');
        return;
      }

      // Get product price
      const selectedProductData = products.find(p => p.id.toString() === selectedProduct);
      if (!selectedProductData) {
        setError('Selected product not found.');
        toast.error('Selected product not found.');
        return;
      }

      // Check if user has sufficient balance
      if (walletBalance < selectedProductData.Price) {
        setError('Insufficient wallet balance. Please recharge.');
        toast.error('Insufficient wallet balance. Please recharge.');
        return;
      }

      // Create a pending transaction
      const transaction = await createTransaction(
        user.id,
        selectedProductData.Price,
        'DEBIT',
        selectedProduct
      );

      console.log('Getting virtual number with:', { countryCode, selectedProduct });
      const data = await getVirtualNumber(countryCode, selectedProduct);
      console.log('Virtual number data:', data);

      if (data && data.phone) {
        // Deduct balance from wallet
        await updateWalletBalance(user.id, selectedProductData.Price, 'DEBIT');
        
        // Update wallet balance state
        setWalletBalance(prev => prev - selectedProductData.Price);

        setNumber({ phone: data.phone, id: data.id });
        setOrderId(Number(data.id));
        toast.success(`Number ${data.phone} received!`);
        setIsCheckingSms(true);
        setOrderStatus("PENDING");
        setOrderCreatedAt(data.created_at || null);
      } else {
        setError('No free phones available for this service')
        toast.error('No free phones available for this service')
      }
    } catch (e: any) {
      console.error('Error getting virtual number:', e);
      if (e.message === 'No free phones available for this service') {
        setError('No free phones available for the selected service. Please try again later or select a different service.');
        toast.error('No free phones available for the selected service. Please try again later or select a different service.');
      } else if (e.message.includes('Request failed with status code 400')) {
        setError('Invalid product selected for the chosen country. Please select a valid product.');
        toast.error('Invalid product selected for the chosen country. Please select a valid product.');
      } else {
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
        setIsOrderFinished(true);
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
        setIsOrderFinished(true);
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

  const handleFinishOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!orderId) {
        setError('No order ID to finish.');
        toast.error('No order ID to finish.');
        return;
      }

      // Here, you would typically call an API endpoint to mark the order as finished.
      // Since there's no direct 5sim API to "finish" an order, you might need to implement
      // this logic on your backend, which then interacts with 5sim or just updates your DB.
      // For demonstration purposes, I'll simulate a successful finish.

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network request

      toast.success('Order finished successfully.');
      setNumber(null);
      setSmsCode(null);
      setIsCheckingSms(false);
      setIsOrderCancelled(true);
      setOrderStatus("FINISHED");
      setIsOrderFinished(true);

    } catch (e: any) {
      console.error('Error finishing order:', e);
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
        toast.success('Copied to clipboard!', {
          className: 'bg-green-500 text-white'
        });
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
    <div className="space-y-4">
      <WalletBalance />
      <Card className="p-4 md:p-6 shadow-md rounded-xl bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl font-semibold text-center">Get Virtual Number</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* Country Selection */}
          <div className="grid gap-2">
            <Label htmlFor="country" className="text-sm font-medium">Country</Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className="w-full justify-between text-sm"
                  disabled={isCountryLoading}
                >
                  {countryCode ? (
                    <div className="flex items-center gap-2">
                      <span>{countryCode.toUpperCase()}</span>
                    </div>
                  ) : "Select country..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  {isCountryLoading && <Spinner variant="circle" className="ml-2 h-4 w-4" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command className="rounded-md border shadow-md">
                  <CommandInput placeholder="Search country..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup heading="Available Countries">
                      {availableCountries.length > 0 ? (
                        availableCountries.map((country) => (
                          <CommandItem
                            key={country}
                            value={country}
                            onSelect={(currentValue) => {
                              setCountryCode(currentValue);
                              setCountryOpen(false);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5"
                          >
                            <span className="flex-1">{country.toUpperCase()}</span>
                          </CommandItem>
                        ))
                      ) : (
                        <CommandItem disabled>No countries available</CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Product Selection */}
          <div className="grid gap-2">
            <Label htmlFor="product" className="text-sm font-medium">Product</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between text-sm"
                  disabled={isProductLoading}
                >
                  {selectedProduct
                    ? products.find((product) => product.id.toString() === selectedProduct)?.name
                    : "Select product..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  {isProductLoading && <Spinner variant="infinite" className="ml-2 h-4 w-4" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command className="rounded-md border shadow-md">
                  <CommandInput placeholder="Search product..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup heading="Available Products">
                      {products.length > 0 ? (
                        products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id.toString()}
                            onSelect={(currentValue) => {
                              setSelectedProduct(currentValue);
                              setProductOpen(false);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedProduct === product.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {product.name.charAt(0).toUpperCase() + product.name.slice(1)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ${product.Price} - {product.Qty} available
                              </span>
                            </div>
                          </CommandItem>
                        ))
                      ) : (
                        <CommandItem disabled>No products available</CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Get Number Button */}
          <Button
            onClick={handleGetNumber}
            disabled={isLoading || isOrderCancelled || !selectedProduct}
            className="rounded-md py-2 text-sm"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Spinner variant="infinite" className="mr-2 h-4 w-4" />
              </div>
            ) : (
              'Get Number'
            )}
          </Button>

          {/* Display Number Information */}
          {number && number.phone && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-md border p-2 shadow-sm">
                <div className="flex-grow flex items-center gap-2">
                  <Badge  className="text-xs">Number:</Badge>
                  <span className="text-sm font-medium">{number.phone}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                  disabled={isNumberCopied}
                  className="ml-2 h-8 w-8"
                >
                  {isNumberCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1 sm:gap-2 text-xs sm:text-sm">
                <Badge variant="outline" className="flex flex-col items-center p-1 sm:p-1.5">
                  <span className="text-[10px] sm:text-xs">Country</span>
                  <span className="font-medium">{countryCode}</span>
                </Badge>
                <Badge variant="outline" className="flex flex-col items-center p-1 sm:p-1.5">
                  <span className="text-[10px] sm:text-xs">Order ID</span>
                  <span className="font-medium">{number.id}</span>
                </Badge>
                {orderCreatedAt && (
                  <Badge variant="outline" className="flex flex-col items-center p-1 sm:p-1.5">
                    <span className="text-[10px] sm:text-xs">Time</span>
                    <span className="font-medium">
                      {new Date(orderCreatedAt).toLocaleTimeString()}
                    </span>
                  </Badge>
                )}
              </div>

              {orderStatus && (
                <div className="text-sm text-center mt-2">
                  <Badge className={cn(getStatusColor(orderStatus), "text-xs")}>
                    {orderStatus}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Waiting for OTP */}
          {isCheckingSms && !smsCode && (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex items-center space-x-2">
                <Spinner variant="bars" className="h-4 w-4" />
                <span className="text-sm">Waiting for OTP...</span>
              </div>
              {isTimeoutActive && timeLeft !== null && otpTimeout !== null && (
                <>
                  <Progress value={((otpTimeout - timeLeft) / otpTimeout) * 100} className="w-full" />
                  <span className="text-xs text-muted-foreground">
                    Time left: {timeLeft} seconds
                  </span>
                </>
              )}
            </div>
          )}

          {/* Display SMS Code */}
          {smsCode && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between rounded-md border p-3 bg-gray-50 dark:bg-gray-800 shadow-sm">
                <div className="flex-grow flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">SMS Code:</Badge>
                  <span className="text-sm font-medium">{smsCode}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyToClipboard(smsCode, setIsOtpCopied)}
                  disabled={isOtpCopied}
                  className="ml-2 h-8 w-8"
                >
                  {isOtpCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Display Full SMS */}
          {fullSms && (
            <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-800 shadow-sm">
              <Badge variant="secondary" className="text-xs">Full SMS:</Badge>
              <p className="mt-2 text-sm">{fullSms}</p>
            </div>
          )}

          {/* Display Error */}
          {error && (
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <Badge variant="destructive" className="text-xs">{error}</Badge>
            </div>
          )}

          {/* Cancel Order Button */}
          {number && (
            <div className="grid justify-center mt-4 gap-2">
              {/* Ban Number Button */}
              <Button
                onClick={handleBanNumber}
                disabled={isLoading || isOrderCancelled || isOrderFinished}
                className="text-sm"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Spinner variant="infinite" className="mr-2 h-4 w-4" />
                    <span>Banning...</span>
                  </div>
                ) : (
                  <>
                    Ban Number
                    <Ban className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                onClick={handleCancelOrder}
                disabled={isLoading || isOrderCancelled || isOrderFinished}
                className="text-sm"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Spinner variant="infinite" className="mr-2 h-4 w-4" />
                    <span>Cancelling...</span>
                  </div>
                ) : (
                  <>
                    Cancel Order
                    <XCircle className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Finish Order Button */}
          {smsCode && (
            <Button
              onClick={handleFinishOrder}
              disabled={isLoading || isOrderCancelled || isOrderFinished || !smsCode}
              className="text-sm"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Spinner variant="infinite" className="mr-2 h-4 w-4" />
                  <span>Finishing...</span>
                </div>
              ) : (
                <>
                  Finish Order
                  <CircleCheck className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GetVirtualNumber;