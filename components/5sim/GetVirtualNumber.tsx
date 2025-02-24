import { useState, useEffect, useRef } from 'react';
import { 
  getProducts,
  getOperators, 
  getCountries,
  getVirtualNumber,
  getSmsCode,
  cancelOrder,
  banOrder,
  finishOrder,
  retryGetSmsCode,
  reactivateOrder,

} from '@/lib/5simService';

import { 
  getWalletBalance,
  updateWalletBalance,
  createTransaction 
} from '@/lib/walletService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, ChevronsUpDown, RefreshCw } from 'lucide-react';
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
import { WalletBalance } from '../wallet/WalletBalance';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Info } from "lucide-react"

interface SmsMessage {
  created_at: string;
  date: string;
  sender: string;
  text: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface Operator {
  id: string;
  name: string;
  displayName: string;
  cost: number;
  count: number;
  rate: number;
}

interface ServiceProduct {
  id: string;
  displayName: string;
  price: number;
}

type OrderStatus = "PENDING" | "RECEIVED" | "CANCELED" | "TIMEOUT" | "FINISHED" | "BANNED";

const RUB_TO_INR_RATE = 0.89; // Current approximate rate for RUB to INR conversion

const GetVirtualNumber = () => {
  const { user } = useUser();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [countries, setCountries] = useState<Array<{ code: string; name: string; iso: string; prefix: string }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [number, setNumber] = useState<{ phone: string; id: string } | null>(null);
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSms, setIsCheckingSms] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [isCountryLoading, setIsCountryLoading] = useState(false);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetryAttempts] = useState(30);
  const [isReactivating, setIsReactivating] = useState(false);
  const smsCheckInterval = useRef<number | null>(null);
  const [isOrderCancelled, setIsOrderCancelled] = useState(false);
  const [fullSms, setFullSms] = useState<string | null>(null);
  const [isNumberCopied, setIsNumberCopied] = useState(false);
  const [isOtpCopied, setIsOtpCopied] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(true);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [otpTimeout, setOtpTimeout] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimeoutActive, setIsTimeoutActive] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [filteredCountries, setFilteredCountries] = useState(countries);

  const convertToINR = (rubPrice: number): number => {
    return Math.ceil(rubPrice * RUB_TO_INR_RATE);
  };

  useEffect(() => {
    const fetchCountries = async () => {
      setIsCountryLoading(true);
      try {
        const { countries, error } = await getCountries();
        if (error) {
          throw new Error(error);
        }
        if (countries.length === 0) {
          toast.error('No countries available', {
            description: 'Please try again later or contact support.'
          });
          return;
        }
        setCountries(countries);
        setFilteredCountries(countries);
      } catch (error: any) {
        console.error('Error fetching countries:', error);
        toast.error('Failed to fetch countries', {
          description: 'Please check your connection and try again.'
        });
      } finally {
        setIsCountryLoading(false);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      if (selectedCountry) {
        setIsProductLoading(true);
        setProducts([]); // Clear existing products
        setSelectedProduct(''); // Reset product selection
        setOperators([]); // Clear operators
        setSelectedOperator(''); // Reset operator selection
        setError(null); // Clear any previous errors
        
        try {
          const { products, error } = await getProducts(selectedCountry);
          if (error) {
            throw new Error(error);
          }
          if (!products || products.length === 0) {
            throw new Error(`No services available for ${countries.find(c => c.code === selectedCountry)?.name}`);
          }
          setProducts(products);
        } catch (error: any) {
          console.error('Error fetching products:', error);
          const errorMessage = error.message.includes('not supported') 
            ? `${countries.find(c => c.code === selectedCountry)?.name} is currently not supported. Please choose another country.`
            : error.message;
          
          setError(errorMessage);
          toast.error('Service Unavailable', {
            description: errorMessage
          });
          // Reset country selection if it's not supported
          if (error.message.includes('not supported')) {
            setSelectedCountry('');
          }
        } finally {
          setIsProductLoading(false);
        }
      }
    };

    fetchProducts();
  }, [selectedCountry, countries]);

  useEffect(() => {
    const fetchOperators = async () => {
      if (selectedCountry && selectedProduct) {
        setOperators([]); // Clear existing operators
        setSelectedOperator(''); // Reset operator selection
        
        try {
          const { operators, error } = await getOperators(selectedCountry, selectedProduct);
          if (error) {
            throw new Error(error);
          }
          if (operators.length === 0) {
            toast.error('No operators available for this product');
            return;
          }
          setOperators(operators);
        } catch (error: any) {
          console.error('Error fetching operators:', error);
          toast.error('Failed to fetch operators', {
            description: error.message
          });
        }
      }
    };

    fetchOperators();
  }, [selectedCountry, selectedProduct]);

  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!user) return;
      try {
        const balance = await getWalletBalance(user.id);
        setWalletBalance(balance);
      } catch (error: any) {
        console.error('Error fetching wallet balance:', error);
        toast.error(`Failed to fetch wallet balance: ${error.message}`);
      }
    };

    if (user) {
      fetchWalletBalance();
    }
  }, [user]);

  useEffect(() => {
    if (number?.id && isCheckingSms) {
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current);
      }

      const startSmsCheck = async () => {
        setIsRetrying(true);
        setRetryAttempts(0);
        try {
          const response = await retryGetSmsCode(number.id, maxRetryAttempts, 5000);
          if (response) {
            if (response.sms && response.sms.length > 0) {
              const sms = response.sms[0];
              setSmsCode(sms.code);
              setFullSms(sms.text);
              toast.success(`SMS Code: ${sms.code}`);
            }
            setOrderStatus(response.status);
            setOrderCreatedAt(response.created_at || null);

            if (response.status === 'TIMEOUT') {
              toast.error('Order timed out', {
                description: 'The order has timed out. You can try reactivating it.',
              });
              setIsTimeoutActive(false);
            }
          }
        } catch (error: any) {
          console.error('Error checking SMS:', error);
          toast.error('Failed to check SMS status');
          setError(error.message);
        } finally {
          setIsRetrying(false);
          setIsCheckingSms(false);
        }
      };

      startSmsCheck();
    }
  }, [number?.id, isCheckingSms, maxRetryAttempts]);

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
      toast.error('Please sign in to continue', {
        description: "You need to be signed in to get a virtual number"
      });
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
    setOtpTimeout(300);
    setTimeLeft(300);
    setIsTimeoutActive(true);

    try {
      if (!selectedOperator) {
        throw new Error('Please select an operator');
      }

      const selectedOp = operators.find(op => op.id === selectedOperator);
      if (!selectedOp) {
        throw new Error('Selected operator not found');
      }

      const priceInINR = convertToINR(selectedOp.cost);

      if (walletBalance < priceInINR) {
        const shortfall = priceInINR - walletBalance;
        throw new Error(`Insufficient wallet balance. Need ₹${shortfall} more to proceed.`);
      }

      const transaction = await createTransaction(
        user.id,
        priceInINR,
        'DEBIT',
        selectedProduct
      );

      console.log('Getting virtual number with:', { 
        country: selectedCountry, 
        operator: selectedOp.name,
        product: selectedProduct 
      });

      const data = await getVirtualNumber(
        selectedCountry,
        selectedProduct,
        selectedOp.name
      );

      if (!data || !data.phone) {
        throw new Error('Failed to get virtual number');
      }

      await updateWalletBalance(user.id, priceInINR, 'DEBIT');
      setWalletBalance(prev => prev - priceInINR);
      setNumber({ phone: data.phone, id: data.id });
      setOrderId(Number(data.id));
      
      toast.success('Virtual number received!', {
        description: `Your number is: ${data.phone}`
      });
      
      setIsCheckingSms(true);
      setOrderStatus("PENDING");
      setOrderCreatedAt(data.created_at || null);
    } catch (e: any) {
      console.error('Error getting virtual number:', e);
      setError(e.message);
      toast.error('Failed to get virtual number', {
        description: e.message
      });
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

      const data = await banOrder(Number(number.id)); 
      console.log('Ban number response:', data);

      if (data) {
        toast.success('Number banned successfully. This number cannot be used again.');
        setNumber(null);
        setSmsCode(null);
        setIsCheckingSms(false);
        setIsOrderCancelled(true);
        setOrderStatus("BANNED");
        setIsOtpVerified(false); 
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

      await new Promise(resolve => setTimeout(resolve, 1000)); 

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

  const handleReactivate = async () => {
    if (!orderId) return;
    
    setIsReactivating(true);
    try {
      const response = await reactivateOrder(orderId);
      if (response) {
        toast.success('Order reactivated successfully');
        setOrderStatus('PENDING');
        setIsCheckingSms(true);
        setIsTimeoutActive(true);
        setTimeLeft(300); 
        setOtpTimeout(300);
      }
    } catch (error: any) {
      console.error('Error reactivating order:', error);
      toast.error('Failed to reactivate order');
      setError(error.message);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleCopyToClipboard = (text: string, setState: (value: boolean) => void) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setState(true);
        toast.success('Copied to clipboard!', {
          className: 'bg-green-500 text-white'
        });
        setTimeout(() => setState(false), 2000); 
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy text.');
      });
  };

  const handleCountryChange = async (value: string) => {
    try {
      setSelectedCountry(value);
      setError(null);
      setIsLoading(true);

      const products = await getProducts(value);
      if (products.error) {
        throw new Error(products.error);
      }

      setProducts(products.products || []);
      if (products.products?.length === 0) {
        toast.error(`No products available for ${value}`);
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setError(error.message);
      toast.error(error.message);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountrySearch = (value: string) => {
    if (!value) {
      setFilteredCountries(countries);
      return;
    }

    const searchTerm = value.toLowerCase();
    const filtered = countries.filter(country => 
      country.name.toLowerCase().includes(searchTerm) || 
      country.code.toLowerCase().includes(searchTerm) ||
      country.prefix.includes(searchTerm)
    );
    setFilteredCountries(filtered);
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
          <CardTitle className="text-xl md:text-2xl font-semibold text-center flex items-center justify-center gap-2">
            Phone Verification
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get a virtual number for OTP verification</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Select your preferences below to receive a virtual number
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          {/* Selection Section */}
          <div className="space-y-4">
            {/* Country Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                Country
                {isCountryLoading && <Spinner className="h-4 w-4" />}
              </Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-full justify-between"
                    disabled={isCountryLoading}
                  >
                    {isCountryLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedCountry ? (
                      <div className="flex items-center gap-2">
                        <span>{countries.find((country) => country.code === selectedCountry)?.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {countries.find((country) => country.code === selectedCountry)?.code}
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {countries.find((country) => country.code === selectedCountry)?.prefix}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Search and select your country</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Type your country name..." 
                      onChange={(e) => handleCountrySearch(e.target.value)}
                    />
                    <CommandEmpty className="p-4 text-sm text-muted-foreground">
                      <div className="space-y-2">
                        <p>No country found for your search.</p>
                        <p className="text-xs">Try searching with a different name (e.g., "England" for UK).</p>
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandList>
                        {filteredCountries.map((country) => (
                          <CommandItem
                            key={country.code}
                            value={country.name}
                            onSelect={() => {
                              handleCountryChange(country.code);
                              setCountryOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCountry === country.code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span>{country.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {country.code}
                                </Badge>
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {country.prefix}
                                </Badge>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {error && (
                <p className="text-sm text-destructive flex items-center gap-2 mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>

            {/* Product Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">Service for OTP</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between"
                    disabled={!selectedCountry || products.length === 0}
                  >
                    {!selectedCountry ? (
                      "Select country first"
                    ) : products.length === 0 ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedProduct ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="capitalize">
                          {products.find((p) => p.id === selectedProduct)?.name.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          ₹{convertToINR(products.find((p) => p.id === selectedProduct)?.price || 0)}
                        </Badge>
                      </div>
                    ) : (
                      "Select verification service"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search services..." />
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandGroup>
                      <CommandList>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={(currentValue) => {
                              setSelectedProduct(currentValue === selectedProduct ? '' : currentValue);
                              setProductOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProduct === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="capitalize">{product.name.replace(/_/g, ' ')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {product.quantity} available
                                </Badge>
                                <Badge variant="secondary">
                                  ₹{convertToINR(product.price)}
                                </Badge>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Operator Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">Provider</Label>
              <Popover open={operatorOpen} onOpenChange={setOperatorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={operatorOpen}
                    className="w-full justify-between"
                    disabled={!selectedProduct || operators.length === 0}
                  >
                    {!selectedProduct ? (
                      "Select service first"
                    ) : operators.length === 0 ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedOperator ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="capitalize">
                          {operators.find((op) => op.id === selectedOperator)?.displayName}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={operators.find((op) => op.id === selectedOperator)?.rate >= 90 ? "success" : "warning"}>
                            {operators.find((op) => op.id === selectedOperator)?.rate}% success
                          </Badge>
                          <Badge variant="secondary">
                            ₹{convertToINR(operators.find((op) => op.id === selectedOperator)?.cost || 0)}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      "Select provider"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search providers..." />
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup>
                      <CommandList>
                        {operators.map((operator) => (
                          <CommandItem
                            key={operator.id}
                            value={operator.id}
                            onSelect={(currentValue) => {
                              setSelectedOperator(currentValue === selectedOperator ? '' : currentValue);
                              setOperatorOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedOperator === operator.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="capitalize">{operator.displayName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={operator.rate >= 90 ? "success" : "warning"}>
                                  {operator.rate}% success
                                </Badge>
                                <Badge variant="secondary">
                                  ₹{convertToINR(operator.cost)}
                                </Badge>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Separator className="my-4" />

            {/* Action Section */}
            <div className="space-y-4">
              {/* Get Number Button */}
              <Button
                onClick={handleGetNumber}
                disabled={isLoading || isOrderCancelled || !selectedOperator}
                className="w-full rounded-md py-2 text-sm font-medium"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner variant="infinite" className="h-4 w-4" />
                    <span>Getting Number...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Get Virtual Number</span>
                    {selectedOperator && (
                      <Badge variant="secondary" className="ml-2">
                        ₹{convertToINR(operators.find((op) => op.id === selectedOperator)?.cost || 0)}
                      </Badge>
                    )}
                  </div>
                )}
              </Button>

              {/* Display Number Information */}
              {number && number.phone && (
                <div className="space-y-4 bg-accent/10 rounded-lg p-4">
                  <div className="flex items-center justify-between rounded-md border bg-background p-3 shadow-sm">
                    <div className="flex-grow flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-medium">Virtual Number</Badge>
                      <span className="text-sm font-medium tracking-wider">{number.phone}</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                            disabled={isNumberCopied}
                            className="h-8 w-8"
                          >
                            {isNumberCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy number to clipboard</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center p-2 rounded-md border bg-background">
                      <span className="text-xs text-muted-foreground">Country</span>
                      <span className="font-medium text-sm">{selectedCountry}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-md border bg-background">
                      <span className="text-xs text-muted-foreground">Order ID</span>
                      <span className="font-medium text-sm">{number.id}</span>
                    </div>
                    {orderCreatedAt && (
                      <div className="flex flex-col items-center justify-center p-2 rounded-md border bg-background">
                        <span className="text-xs text-muted-foreground">Time</span>
                        <span className="font-medium text-sm">
                          {new Date(orderCreatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {orderStatus && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge className={cn(getStatusColor(orderStatus), "text-xs px-3 py-1")}>
                        {orderStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Waiting for OTP */}
              {(isCheckingSms || isRetrying) && !smsCode && (
                <div className="space-y-3 bg-accent/10 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-2">
                    <Spinner variant="bars" className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isRetrying 
                        ? `Checking for SMS (${retryAttempts + 1}/${maxRetryAttempts})`
                        : 'Waiting for OTP...'}
                    </span>
                  </div>
                  {isTimeoutActive && timeLeft !== null && otpTimeout !== null && (
                    <div className="space-y-2">
                      <Progress 
                        value={((otpTimeout - timeLeft) / otpTimeout) * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-center text-muted-foreground">
                        Expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Display SMS Code */}
              {smsCode && (
                <div className="space-y-3 bg-accent/10 rounded-lg p-4">
                  <div className="flex items-center justify-between rounded-md border bg-background p-3 shadow-sm">
                    <div className="flex-grow flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-medium">OTP Code</Badge>
                      <span className="text-lg font-medium tracking-wider">{smsCode}</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyToClipboard(smsCode, setIsOtpCopied)}
                            disabled={isOtpCopied}
                            className="h-8 w-8"
                          >
                            {isOtpCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy OTP to clipboard</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {fullSms && (
                    <div className="rounded-md border bg-background p-3">
                      <Badge variant="outline" className="text-xs mb-2">Full Message</Badge>
                      <p className="text-sm text-muted-foreground">{fullSms}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border-destructive/20 border">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              {number && (
                <div className="grid grid-cols-2 gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleBanNumber}
                          disabled={isLoading || isOrderCancelled || isOrderFinished}
                          className="w-full"
                        >
                          {isLoading ? (
                            <Spinner variant="infinite" className="h-4 w-4" />
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Ban className="h-4 w-4" />
                              <span>Ban</span>
                            </div>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ban this number if you received spam</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleCancelOrder}
                          disabled={isLoading || isOrderCancelled || isOrderFinished}
                          className="w-full"
                        >
                          {isLoading ? (
                            <Spinner variant="infinite" className="h-4 w-4" />
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <XCircle className="h-4 w-4" />
                              <span>Cancel</span>
                            </div>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cancel this order</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* Reactivate Button */}
              {orderStatus === 'TIMEOUT' && !isOrderFinished && (
                <Button
                  variant="outline"
                  onClick={handleReactivate}
                  disabled={isReactivating}
                  className="w-full"
                >
                  {isReactivating ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner variant="infinite" className="h-4 w-4" />
                      <span>Reactivating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      <span>Reactivate Order</span>
                    </div>
                  )}
                </Button>
              )}

              {/* Finish Button */}
              {smsCode && (
                <Button
                  variant="default"
                  onClick={handleFinishOrder}
                  disabled={isLoading || isOrderCancelled || isOrderFinished}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner variant="infinite" className="h-4 w-4" />
                      <span>Finishing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <CircleCheck className="h-4 w-4" />
                      <span>Complete Order</span>
                    </div>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GetVirtualNumber;