"use client"

import { useState, useEffect, useRef } from "react"
import {
  getProducts,
  getOperators,
  getCountries,
  getVirtualNumber,
  getSmsCode,
  cancelOrder,
  banOrder,
  finishOrder,
  normalizeCountryInput,
} from "@/lib/5simService"

import {
  getWalletBalance,
  createVirtualNumberTransaction,
  handleVirtualNumberRefund,
  updateWalletBalance,
  createTransaction,
  updateVirtualNumberStatus,
  canPurchaseNumber,
} from "@/lib/walletService"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Check, AlertTriangle, ChevronsUpDown, RefreshCw, Wallet } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useUser } from "@clerk/nextjs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import * as React from "react"
import { useOtpPersist } from "@/hooks/useOtpPersist"
import { createOtpSession, getActiveOtpSession } from "@/lib/otpSessionService"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from '@tanstack/react-query'
import { ReceivedNumberView } from "./ReceivedNumberView"
import axios from 'axios'
import { supabase } from "@/lib/supabase"

// Replace the image-based CountryFlag component with an emoji-based one
const CountryFlag = ({ iso }: { iso: string }) => {
  // Convert ISO code to regional indicator symbols (emoji flag)
  // Each country's ISO code (2 letters) maps to a pair of regional indicator symbols
  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <span className="text-xl mr-2" role="img" aria-label="flag">
      {getFlagEmoji(iso)}
    </span>
  );
};

interface Product {
  id: string
  name: string
  category: string
  price: number
  quantity: number
}

interface Operator {
  id: string
  name: string
  displayName: string
  cost: number
  count: number
  rate: number
}


type OrderStatus = "PENDING" | "RECEIVED" | "CANCELED" | "TIMEOUT" | "FINISHED" | "BANNED"



interface Country {
  code: string
  name: string
  iso: string
  prefix: string
}

// Add a constant for the commission rate
const COMMISSION_RATE = 0.20; // 20% commission

const GetVirtualNumber = () => {
  const { user } = useUser()
  const { otpData, updateOtpData, clearOtpData } = useOtpPersist("virtual-number-otp")
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [selectedOperator, setSelectedOperator] = useState<string>("")
  const [selectedOperatorDetails, setSelectedOperatorDetails] = useState<Operator | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [number, setNumber] = useState<{ phone: string; id: string } | null>(null)
  const [smsCode, setSmsCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingSms, setIsCheckingSms] = useState(false)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [isCountryLoading, setIsCountryLoading] = useState(false)
  const [isProductLoading, setIsProductLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryAttempts, setRetryAttempts] = useState(0)
  const [maxRetryAttempts] = useState(30) // 5 minutes with 10s interval
  const [retryInterval] = useState(10000) // 10 seconds between retries
  const [orderTimeout] = useState(900000) // 15 minutes in milliseconds
  const [timeoutTimer, setTimeoutTimer] = useState<NodeJS.Timeout | null>(null)
  const [isReactivating, setIsReactivating] = useState(false)
  const smsCheckInterval = useRef<NodeJS.Timeout | null>(null)
  // Add refs for tracking toast notification state
  const hasShownReceivedStatusToast = useRef<boolean>(false)
  const isPollingAutomatically = useRef<boolean>(false)
  const [isOrderCancelled, setIsOrderCancelled] = useState(false)
  const [fullSms, setFullSms] = useState<string | null>(null)
  const [isNumberCopied, setIsNumberCopied] = useState(false)
  const [isOtpCopied, setIsOtpCopied] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [isOtpVerified, setIsOtpVerified] = useState(true)
  const [orderCreatedAt, setOrderCreatedAt] = useState<Date | null>(null)
  const [isOrderFinished, setIsOrderFinished] = useState(false)
  const [otpTimeout, setOtpTimeout] = useState<number | null>(300) // 5 minutes in seconds
  const [timeLeft, setTimeLeft] = useState<number | null>(300)
  const [isTimeoutActive, setIsTimeoutActive] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [operatorOpen, setOperatorOpen] = useState(false)
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([])
  const [countrySearchQuery, setCountrySearchQuery] = useState("")
  const [serviceSearchQuery, setServiceSearchQuery] = useState("")
  const [isCopyingNumber, setIsCopyingNumber] = useState(false)
  const [isCopyingOtp, setIsCopyingOtp] = useState(false)
  const [isOrderIdCopied, setIsOrderIdCopied] = useState(false)
  const [isSmsCodeCopied, setIsSmsCodeCopied] = useState(false)
  const [usingFallbackRate, setUsingFallbackRate] = useState(false);
  const [activeProductName, setActiveProductName] = useState<string | undefined>(undefined);
  
  // Add this query for real-time wallet balance
  const { 
    data: walletBalance = 0, 
    isLoading: isWalletLoading,
    refetch: refetchBalance
  } = useQuery({
    queryKey: ['walletBalance', user?.id],
    queryFn: () => getWalletBalance(user?.id as string),
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
  
  // Helper function to force a wallet balance update and ensure UI reflects the change
  const forceBalanceUpdate = async () => {
    console.log("Forcing wallet balance update");
    
    try {
      // First invalidate the cache to ensure fresh data
      const result = await refetchBalance();
      console.log("Balance refetch result:", result.data);
      
      // Small delay to ensure state updates have time to propagate
      setTimeout(() => {
        // Second refetch to be extra sure
        refetchBalance().catch(err => {
          console.log("Secondary refetch error (non-critical):", err.message);
        });
      }, 500);
      
      return result.data;
    } catch (error) {
      console.error("Balance update failed:", error);
      // Return current balance from cache instead of failing
      return walletBalance;
    }
  }

  // Timers and state references
  const savedTransaction = useRef<{ id: string } | null>(null)

  // Add this line near other useRefs
  const retryAttemptsRef = useRef(0)

  // Add this query to fetch real-time exchange rate with improved fallback
  const { 
    data: exchangeRate = 0.99  } = useQuery({
    queryKey: ['exchangeRate', 'RUB_INR'],
    queryFn: async () => {
      try {
        // Try to get saved rate from localStorage as initial fallback
        const savedRate = localStorage.getItem('rub_inr_rate');
        const savedTimestamp = localStorage.getItem('rub_inr_timestamp');
        const savedRateAge = savedTimestamp ? (Date.now() - parseInt(savedTimestamp)) / (1000 * 60 * 60) : 24; // Age in hours
        
        // Free currency API - try primary source first
        const response = await axios.get('https://open.er-api.com/v6/latest/RUB', {
          timeout: 5000 // 5 second timeout
        });
        
        if (response.data && response.data.rates && response.data.rates.INR) {
          const inrRate = response.data.rates.INR;
          console.log('Fetched RUB to INR rate:', inrRate);
          
          // Save successful rate to localStorage
          localStorage.setItem('rub_inr_rate', inrRate.toString());
          localStorage.setItem('rub_inr_timestamp', Date.now().toString());
          
          setUsingFallbackRate(false);
          return inrRate;
        }
        
        // If API response is invalid but we have a recent saved rate (less than 24 hours old)
        if (savedRate && savedRateAge < 24) {
          console.log('Using saved exchange rate:', savedRate);
          setUsingFallbackRate(true);
          return parseFloat(savedRate);
        }
        
        // Final fallback
        console.log('Using default exchange rate');
        setUsingFallbackRate(true);
        return 0.99;
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        
        // Try backup API if primary fails
        try {
          console.log('Trying backup exchange rate API...');
          const backupResponse = await axios.get('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/rub/inr.json', {
            timeout: 5000
          });
          
          if (backupResponse.data && backupResponse.data.inr) {
            const backupRate = backupResponse.data.inr;
            console.log('Fetched backup RUB to INR rate:', backupRate);
            
            // Save successful backup rate
            localStorage.setItem('rub_inr_rate', backupRate.toString());
            localStorage.setItem('rub_inr_timestamp', Date.now().toString());
            
            setUsingFallbackRate(true); // Still mark as fallback since it's not the primary source
            return backupRate;
          }
        } catch (backupError) {
          console.error('Backup exchange rate API also failed:', backupError);
        }
        
        // Try to use saved rate if available
        const savedRate = localStorage.getItem('rub_inr_rate');
        if (savedRate) {
          console.log('Using previously saved exchange rate:', savedRate);
          setUsingFallbackRate(true);
          return parseFloat(savedRate);
        }
        
        // Ultimate fallback
        setUsingFallbackRate(true);
        return 0.99;
      }
    },
    staleTime: 1000 * 60 * 60, // Consider data fresh for 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Update the convertToINR function to include the commission
  const convertToINR = (rubPrice: number): number => {
    const basePrice = rubPrice * exchangeRate;
    const withCommission = basePrice * (1 + COMMISSION_RATE);
    return Math.ceil(withCommission);
  }

  // Add this helper function to get the base price (for display purposes)

  // Add this to calculate the commission amount (for display purposes)

  // Add a comprehensive reset function to reset the UI state
  const resetUIState = async (skipCancellation: boolean = false) => {
    console.log("Resetting UI state to allow new selection...")
    
    // Auto-cancel any active order that's not already cancelled or finished
    // Skip cancellation if explicitly requested (when called from handleFinishOrder)
    if (!skipCancellation && orderId && orderStatus && !isOrderCancelled && !isOrderFinished && 
        (orderStatus === "PENDING" || orderStatus === "RECEIVED")) {
      try {
        console.log(`Auto-cancelling active order ${orderId} before resetting...`);
        // Show toast for auto-cancellation
        toast.info("Cancelling your active order...", {
          duration: 3000
        });
        
        // Try to cancel the order on 5sim
        await cancelOrder(orderId.toString());
        
        // If there's a transaction, process the refund
        const transactionIdToUse = savedTransaction.current?.id || 
          localStorage.getItem('lastVirtualNumberTransaction');
          
        if (transactionIdToUse && user) {
          console.log(`Processing refund for cancelled order transaction ${transactionIdToUse}`);
          await handleVirtualNumberRefund(user.id, transactionIdToUse, "CANCELED");
        }
        
        // Force a wallet balance update
        await forceBalanceUpdate();
      } catch (error) {
        console.error("Error auto-cancelling order during reset:", error);
        // Continue with reset even if cancellation fails
      }
    }
    
    // Provide user feedback
    toast.success("Ready to get a new number", {
      description: "Select country, service and operator to continue"
    })
    
    // Reset selection state
    setSelectedProduct("")
    setSelectedOperator("")
    setSelectedOperatorDetails(null)
    
    // Reset order state
    setNumber(null)
    setSmsCode(null)
    setFullSms(null)
    setOrderId(null)
    setOrderStatus(null as any)
    setOrderCreatedAt(null)
    setIsOtpVerified(false)
    
    // Reset UI state flags
    setIsOrderCancelled(false)
    setIsOrderFinished(false)
    setIsCheckingSms(false)
    setIsTimeoutActive(false)
    setActiveProductName("") // Reset the active product name
    
    // Clear timers
    if (smsCheckInterval.current) {
      clearInterval(smsCheckInterval.current);
      smsCheckInterval.current = null;
    }
    
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      setTimeoutTimer(null);
    }
    
    // Clear any errors
    setError(null);
    
    // Clear persisted OTP data
    clearOtpData();
  }

  // Add this new function after resetUIState
  const cleanupStuckTransactions = async () => {
    if (!user) return;
    
    try {
      console.log("Checking for stuck transactions...");
      
      // Get all PENDING transactions for this user
      const { data: pendingTransactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'PENDING')
        .eq('type', 'DEBIT');
        
      if (error) {
        console.error("Error fetching pending transactions:", error);
        return;
      }
      
      if (!pendingTransactions || pendingTransactions.length === 0) {
        console.log("No pending transactions found.");
        return;
      }
      
      console.log(`Found ${pendingTransactions.length} pending transactions to check.`);
      
      // For each pending transaction, check if there's a valid OTP session
      for (const transaction of pendingTransactions) {
        if (!transaction.order_id) continue;
        
        // Check if there's an active OTP session
        const { data: session } = await supabase
          .from('otp_sessions')
          .select('status')
          .eq('order_id', transaction.order_id)
          .maybeSingle();
          
        // If no session or session is in CANCELED/TIMEOUT/BANNED/FINISHED state, update transaction
        if (!session || 
            (session.status !== 'PENDING' && session.status !== 'RECEIVED')) {
          console.log(`Cleaning up stuck transaction ${transaction.id} for order ${transaction.order_id}`);
          
          // Update transaction status
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ 
              status: 'FAILED',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
            
          if (updateError) {
            console.error(`Error updating stuck transaction ${transaction.id}:`, updateError);
          } else {
            console.log(`Successfully updated stuck transaction ${transaction.id} to FAILED status`);
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up stuck transactions:", error);
    }
  }

  useEffect(() => {
    const fetchCountries = async () => {
      setIsCountryLoading(true)
      try {
        console.log("Fetching countries...")
        const { countries: countriesData, error } = await getCountries()

        console.log("Countries API Response:", {
          data: countriesData,
          error: error,
        })

        if (error) {
          throw new Error(error)
        }

        if (!countriesData || typeof countriesData !== "object") {
          throw new Error("Invalid countries data received")
        }

        console.log("Transforming countries data...")
        const formattedCountries = Object.values(countriesData).map((country: any) => ({
          code: country.code,
          name: country.name,
          iso: country.iso,
          prefix: country.prefix,
        }))

        console.log("Formatted countries:", formattedCountries)

        if (formattedCountries.length === 0) {
          throw new Error("No countries available after transformation")
        }

        // Sort countries by name for better UX
        const sortedCountries = formattedCountries.sort((a, b) => a.name.localeCompare(b.name))

        console.log("Setting countries state with:", sortedCountries)
        setCountries(sortedCountries)
        setFilteredCountries(sortedCountries)
      } catch (error: any) {
        console.error("Error in fetchCountries:", {
          error: error,
          message: error.message,
          stack: error.stack,
        })
        toast.error("Failed to fetch countries", {
          description: error.message || "Please check your connection and try again.",
        })
        setCountries([])
        setFilteredCountries([])
      } finally {
        setIsCountryLoading(false)
      }
    }

    fetchCountries()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      if (selectedCountry) {
        setIsProductLoading(true)
        setProducts([]) // Clear existing products
        setSelectedProduct("") // Reset product selection
        setOperators([]) // Clear operators
        setSelectedOperator("") // Reset operator selection
        setError(null) // Clear any previous errors

        try {
          const { products, error } = await getProducts(selectedCountry)
          if (error) {
            throw new Error(error)
          }
          if (!products || products.length === 0) {
            throw new Error(`No services available for ${countries.find((c) => c.code === selectedCountry)?.name}`)
          }
          setProducts(products)
        } catch (error: any) {
          console.error("Error fetching products:", error)
          const errorMessage = error.message.includes("not supported")
            ? `${countries.find((c) => c.code === selectedCountry)?.name} is currently not supported. Please choose another country.`
            : error.message

          setError(errorMessage)
          toast.error("Service Unavailable", {
            description: errorMessage,
          })
          // Reset country selection if it's not supported
          if (error.message.includes("not supported")) {
            setSelectedCountry("")
          }
        } finally {
          setIsProductLoading(false)
        }
      }
    }

    fetchProducts()
  }, [selectedCountry, countries])

  useEffect(() => {
    const fetchOperators = async () => {
      if (selectedCountry && selectedProduct) {
        setOperators([]) // Clear existing operators
        setSelectedOperator("") // Reset operator selection

        try {
          console.log("Fetching operators for:", { country: selectedCountry, product: selectedProduct })
          const { operators, error } = await getOperators(selectedCountry, selectedProduct)

          console.log("Received operators:", operators)

          if (error) {
            throw new Error(error)
          }
          if (operators.length === 0) {
            toast.error("No operators available for this product")
            return
          }

          console.log("Setting operators state:", operators)
          setOperators(operators)
        } catch (error: any) {
          console.error("Error fetching operators:", error)
          toast.error("Failed to fetch operators", {
            description: error.message,
          })
        }
      }
    }

    fetchOperators()
  }, [selectedCountry, selectedProduct])

  useEffect(() => {
    const loadActiveSession = async () => {
      if (!user) return

      try {
        const session = await getActiveOtpSession(user.id)
        if (session) {
          setSmsCode(session.sms_code || null)
          setFullSms(session.full_sms || null)
          setNumber({
            phone: session.phone_number,
            id: session.order_id,
          })
          setOrderId(Number(session.order_id))
          setOrderStatus(session.status as OrderStatus)
          setOrderCreatedAt(new Date(session.created_at))
          
          // Store the service name for display
          if (session.service) {
            // Format the service name from database (replace underscores with spaces)
            setActiveProductName(session.service.replace(/_/g, " "))
          }

          // If session is PENDING, restart SMS checking
          if (session.status === "PENDING") {
            setIsCheckingSms(true)
          }
          
          // Synchronize with the actual order status from 5SIM API
          syncOrderStatus(session.order_id)
        }
      } catch (error) {
        console.error("Error loading active session:", error)
      }
    }

    loadActiveSession()
  }, [user])

  // Add a new function to synchronize local state with 5SIM API
  const syncOrderStatus = async (orderId: string) => {
    // Removed console.log for deployment
    
    try {
      setIsCheckingSms(true);
      
      const response = await getSmsCode(orderId);
      // Removed console.log for deployment
      
      // Handle response being undefined
      if (!response) {
        // Removed console.warn for deployment
        return null;
      }
      
      // Update state with order details
      setOrderStatus(response.status);
      setOrderCreatedAt(new Date(response.created_at));
      
      // Update product name from API response if available
      if (response.product) {
        // Removed console.log for deployment
        setActiveProductName(response.product.replace(/_/g, " "));
      }
      
      // Check if SMS has been received
      if (response?.sms && response.sms.length > 0) {
        // Get the latest SMS
        const latestSms = response.sms[response.sms.length - 1];
        setSmsCode(latestSms?.code || null);
        setFullSms(latestSms?.text || null);
        
        // Stop checking for SMS since we've received it
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current);
          smsCheckInterval.current = null;
        }
        
        // Stop the timeout timer
        setIsTimeoutActive(false);
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          setTimeoutTimer(null); // Fix: Use the setter function instead of direct assignment
        }
        
        // Update balance after SMS received
        await forceBalanceUpdate();
      }

      return response;
    } catch (error: any) {
      // Removed console.error for deployment
      
      // Handle "order not found" errors gracefully
      if (error.message?.includes('order not found')) {
        // If order is not found, it may have been cancelled or completed
        // Just stop checking and don't show error toast
        cleanupTimers();
        return null;
      }
      
      // Handle different types of errors with helpful messages
      // For deployment, only show these if not in automatic polling mode
      if (!isPollingAutomatically.current) {
        if (error.message?.includes('non-JSON response')) {
          setError("API authentication error. Please check your API credentials in the environment variables.");
          toast.error("API authentication error", {
            description: "Your 5sim API key may be invalid or expired."
          });
        } else if (error.message?.includes('Failed to parse API response')) {
          setError("Error reading response from 5sim. The service might be experiencing issues.");
          toast.error("Could not read 5sim response", {
            description: "Try again later or contact support if this persists."
          });
        } else if (error.message?.includes('Authentication error')) {
          setError("API authentication error. Please check your credentials.");
          toast.error("Authentication error", {
            description: "Please ensure your API key is correct."
          });
        } else {
          // Don't show generic error toasts during automatic polling
          setError("Failed to check order status. Please try again.");
        }
      }
      
      return null;
    } finally {
      setIsCheckingSms(false);
    }
  };

  // Helper function to clean up timers
  const cleanupTimers = () => {
    if (isCheckingSms) {
      setIsCheckingSms(false);
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current);
        smsCheckInterval.current = null;
      }
    }
  };

  useEffect(() => {
    if (orderId && isCheckingSms) {
      // Only start checking if we have an orderId and isCheckingSms is true
      // This makes the process more defensive
      if (!smsCheckInterval.current) {
        // Removed console.log for deployment
        startCheckingSms(orderId);
      }
    } else if (!orderId && isCheckingSms) {
      // If we're supposed to be checking but have no orderId, log and stop
      // Removed console.log for deployment
      setIsCheckingSms(false);
    } else if (orderId && orderStatus === "RECEIVED" && !smsCode && !smsCheckInterval.current) {
      // Special case: if we have RECEIVED status but no SMS content, and not already checking
      // Removed console.log for deployment
      setIsCheckingSms(true);
      startCheckingSms(orderId);
    }
  }, [orderId, isCheckingSms, orderStatus, smsCode]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isTimeoutActive && timeLeft !== null && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) => {
          if (prevTimeLeft === null) return null
          if (prevTimeLeft <= 1) {
            if (intervalId) clearInterval(intervalId)
            setIsTimeoutActive(false)
            setSmsCode(null)
            setFullSms(null)
            return 0
          }
          return prevTimeLeft - 1
        })
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isTimeoutActive, timeLeft])

  useEffect(() => {
    if (selectedOperator && operators.length > 0) {
      const operatorDetails = operators.find((op) => op.id === selectedOperator)
      setSelectedOperatorDetails(operatorDetails || null)
    } else {
      setSelectedOperatorDetails(null)
    }
  }, [selectedOperator, operators])

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current)
      }
    }
  }, [timeoutTimer])

  // Add a new useEffect to initialize from persisted state (right after state declarations)
  useEffect(() => {
    if (otpData && otpData.orderId) {
      // Initialize state from persisted data
      setOrderId(Number(otpData.orderId));
      
      if (otpData.phoneNumber) {
        setNumber({ phone: otpData.phoneNumber, id: otpData.orderId });
      }
      
      if (otpData.smsCode) {
        setSmsCode(otpData.smsCode);
      }
      
      if (otpData.fullSms) {
        setFullSms(otpData.fullSms);
      }
      
      if (otpData.orderStatus) {
        setOrderStatus(otpData.orderStatus as OrderStatus);
      }

      if (otpData.createdAt) {
        setOrderCreatedAt(new Date(otpData.createdAt));
      }
      
      // Start SMS checking in these scenarios:
      // 1. Order status is PENDING - normal checking
      // 2. Order status is RECEIVED but no SMS code - aggressive checking
      if ((otpData.orderStatus === 'PENDING' || 
          (otpData.orderStatus === 'RECEIVED' && !otpData.smsCode)) && 
          !smsCheckInterval.current) {
        
        // Removed console.logs for deployment
        
        setIsCheckingSms(true);
        startCheckingSms(otpData.orderId);
      }
    }
  }, [otpData]);

  // Update handleGetNumber to create OTP session
  const handleGetNumber = async () => {
    if (!user || !user.id) {
      toast.error("Please sign in to continue", {
        description: "You need to be signed in to get a virtual number",
      })
      return
    }

    // Reset all state in one batch to avoid multiple re-renders
    resetUIState();
    setIsLoading(true);

    try {
      // 1. Calculate price and check wallet balance in one step
      const selectedOp = selectedOperator ? operators.find((op) => op.id === selectedOperator) : null;
      if (!selectedOp) {
        throw new Error("Please select a specific operator to continue.");
      }
      
      const priceInINR = convertToINR(selectedOp.cost);
      
      if (priceInINR <= 0) {
        throw new Error("Invalid price calculation. Please try again.");
      }

      // Check if user can purchase - this validates both balance and pending transactions
      const canPurchase = await canPurchaseNumber(user.id, priceInINR);
      if (!canPurchase) {
        throw new Error("Insufficient balance or pending transaction exists. Please recharge and try again.");
      }

      // 2. Purchase number with optimized error handling
      // No more fallback to "auto" - require explicit operator selection
      const operatorToUse = selectedOperator;
      
      const data = await getVirtualNumber(selectedCountry, selectedProduct, operatorToUse);

      // Comprehensive error handling
      if (!data) {
        throw new Error("No response from number provider");
      }
      
      if (data.error) {
        // Check if this is an error about unavailable numbers
        if (data.error.includes("missing phone number") || 
            data.error.includes("no free phones") || 
            data.error.includes("out of stock")) {
          throw new Error("No phone numbers available for this service/country. Please try another service or country.");
        }
        throw new Error(data.error);
      }

      if (!data.phone || !data.id) {
        throw new Error("No phone numbers available for this service/country. Please try another service or country.");
      }

      // 3. Update state early to provide fast user feedback
      const numericOrderId = Number(data.id);
      setOrderId(numericOrderId);
      setNumber({ phone: data.phone, id: data.id });
      setOrderCreatedAt(new Date());
      setOrderStatus("PENDING");
      
      // Removed console.log for deployment
      
      // 4. Create transaction and session records in parallel
      const transactionRes = await createVirtualNumberTransaction(
        user.id,
        priceInINR,
        data.id,
        data.phone,
        selectedProduct
      );

      // Store transaction reference for later use
      savedTransaction.current = { id: transactionRes.id };
      // Also store in localStorage for resilience
      localStorage.setItem('lastVirtualNumberTransaction', transactionRes.id);

      // Create OTP session with transaction ID
      await createOtpSession(
        user.id,
        data.id,
        data.phone,
        selectedProduct,
        transactionRes.id
      );

      // 6. Persist the order data locally for resilience
      updateOtpData({
        orderId: data.id.toString(),
        phoneNumber: data.phone,
        orderStatus: "PENDING",
        createdAt: new Date().toISOString()
      });
      
      // 7. Show success notification before starting SMS check for better perceived performance
      toast.success(`Virtual number purchased: ${data.phone}`, {
        description: "Waiting for SMS code...",
      });

      // 8. Start checking for SMS in the background
      // Removed console.log for deployment
      setIsCheckingSms(true);
      startCheckingSms(data.id);

      // 9. Refresh wallet balance asynchronously (don't await)
      refetchBalance().catch(err => 
        console.error("Error refreshing wallet balance:", err)
      );

      // 10. Set up order timeout with improved error handling
      const timer = setTimeout(async () => {
        if (!orderId || !user) return;
        
        try {
          const transactionIdToUse = savedTransaction.current?.id || 
                                  localStorage.getItem('lastVirtualNumberTransaction');
          
          if (!transactionIdToUse) {
            console.error("No transaction ID found for timeout refund");
            toast.error("Order timed out, but refund failed", {
              description: "Missing transaction details. Please contact support."
            });
            return;
          }
          
          // Check if SMS was already received before refunding
          if (smsCode || orderStatus === "RECEIVED") {
            console.log("Order timed out but SMS was already received, skipping refund");
            setOrderStatus("FINISHED");
            updateOtpData({ orderStatus: "FINISHED" });
            return;
          }
          
          // Process the refund with the found transaction ID
          await handleVirtualNumberRefund(user.id, transactionIdToUse, "TIMEOUT");
          
          // Update UI state in one batch
          setOrderStatus("TIMEOUT");
          updateOtpData({ orderStatus: "TIMEOUT" });
          setIsCheckingSms(false);
          
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current);
            smsCheckInterval.current = null;
          }
          
          toast.error("Order timed out", {
            description: "The order has expired after 15 minutes. Your funds have been refunded.",
          });
          
          // Refresh wallet balance after refund
          refetchBalance().catch(err => 
            console.error("Error refreshing wallet balance after timeout refund:", err)
          );
        } catch (error) {
          console.error("Error handling timeout refund:", error);
          toast.error("Error processing timeout refund", {
            description: "Please contact support if the issue persists.",
          });
        }
      }, orderTimeout);

      setTimeoutTimer(timer);

      // After storing the transaction data, add this to save the transaction ID separately
      if (transactionRes.id) {
        localStorage.setItem('lastTransactionId', transactionRes.id);
      }
    } catch (error: any) {
      console.error("Error getting virtual number:", error);
      
      // Extract and format error message
      let errorMessage = "An unexpected error occurred";
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Categorized error handling
      if (error.response?.status === 429) {
        toast.error("Rate limit exceeded", {
          description: "Please wait a moment and try again later."
        });
      } else if (error.response?.status === 403) {
        toast.error("Access denied", {
          description: "Please check your authentication and try again."
        });
      } else if (error.response?.status === 400) {
        toast.error("Invalid request", {
          description: errorMessage || "Please check your input and try again."
        });
      } else if (error.message?.includes("balance")) {
        toast.error("Insufficient balance", {
          description: "Please recharge your wallet and try again."
        });
      } else {
        toast.error("Failed to get virtual number", {
          description: errorMessage
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Update cancel handler to update OTP session
  const handleCancelOrder = async () => {
    setIsLoading(true);
    try {
      if (!number?.id) {
        setError("No order ID to cancel.");
        setIsLoading(false);
        return;
      }
      
      if (!user) {
        setError("User not authenticated.");
        setIsLoading(false);
        return;
      }
      
      console.log("Starting cancel process for order:", number.id);
      
      // Ensure we're using a string for the order ID
      const orderId = number.id.toString();
      
      // Check for transaction ID first
      const transactionId = savedTransaction.current?.id;
      console.log("Transaction ID from context:", transactionId);
      
      // Fallback to localStorage if needed
      const fallbackTransactionId = localStorage.getItem('lastVirtualNumberTransaction');
      console.log("Fallback transaction ID from localStorage:", fallbackTransactionId);
      
      // IMPORTANT: Check if SMS has been received already
      // Only consider SMS received if we have actual SMS content
      const hasReceivedSms = smsCode !== null;
      console.log("Has received SMS content:", hasReceivedSms);
      console.log("Order status:", orderStatus);
      
      // Attempt to cancel the number in 5sim
      let data;
      let cancelApiError = false;
      let smsReceivedError = false;
      
      try {
        data = await cancelOrder(orderId);
        console.log("Cancellation successful:", data);
      } catch (cancelError: any) {
        console.error("Error cancelling number in 5sim:", cancelError);
        cancelApiError = true;
        
        // Check if this is an SMS received error
        if (cancelError.message && (
            cancelError.message.includes("SMS was already received") || 
            cancelError.message.toLowerCase().includes("cannot cancel order"))) {
          smsReceivedError = true;
          toast.error("Cannot cancel this number", {
            description: "The number cannot be cancelled because the SMS was already received."
          });
        } else {
          toast.error("Could not cancel number in 5sim", {
            description: "Will still attempt to update status locally."
          });
        }
        // Continue with refund process even if 5sim API fails
      }

      // Update UI state first for responsive UX
      setNumber(null);
      setSmsCode(null);
      setIsCheckingSms(false);
      setIsOrderCancelled(true);
      
      // If we couldn't cancel because SMS was received, mark as FINISHED instead of CANCELED
      if (smsReceivedError || hasReceivedSms) {
        setOrderStatus("FINISHED");
        toast.info("Order marked as completed", {
          description: "The number received an SMS and has been marked as completed."
        });
      } else {
        setOrderStatus("CANCELED");
      }
      
      setIsOtpVerified(false);
      setIsOrderFinished(false);
      
      // Stop SMS check timer if active
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current);
        smsCheckInterval.current = null;
      }
      
      // We should only process refund if SMS was NOT received
      const shouldProcessRefund = !hasReceivedSms && !smsReceivedError;
      
      if (shouldProcessRefund) {
        let refundProcessed = false;
        
        console.log(`Starting refund process for order ${number.id}, transaction ${transactionId}`);
        
        // First try with the saved transaction ID
        if (transactionId) {
          try {
            console.log("Processing refund with saved transaction ID:", transactionId);
            await handleVirtualNumberRefund(user.id, transactionId, "CANCELED");
            refundProcessed = true;
            toast.success("Order cancelled and balance refunded successfully");
            
            // Refresh wallet balance to reflect the refund immediately
            await refetchBalance();
          } catch (refundError) {
            console.error("Error processing refund with saved transaction ID:", refundError);
            // Will try fallback method next
          }
        }
        
        // Try with the lastVirtualNumberTransaction from localStorage as fallback
        if (!refundProcessed && fallbackTransactionId) {
          try {
            console.log("Processing refund with fallback transaction ID:", fallbackTransactionId);
            await handleVirtualNumberRefund(user.id, fallbackTransactionId, "CANCELED");
            refundProcessed = true;
            toast.success("Order cancelled and balance refunded successfully");
            
            // Refresh wallet balance
            await refetchBalance();
          } catch (fallbackError) {
            console.error("Error processing refund with fallback transaction ID:", fallbackError);
            // Will try direct wallet update next
          }
        }
        
        // As a final fallback, try a direct wallet update
        if (!refundProcessed) {
          // Try a direct wallet balance update as last resort
          try {
            // Calculate approximate refund amount from the operator cost
            const operatorCost = selectedOperatorDetails?.cost || 0;
            const refundAmount = convertToINR(operatorCost);
            
            console.log(`Attempting direct wallet balance update with amount: ₹${refundAmount}`);
            
            // Only attempt if we have a non-zero amount
            if (refundAmount > 0) {
              // Add to wallet directly
              await updateWalletBalance(user.id, refundAmount, 'CREDIT');
              
              // Create a transaction record
              await createTransaction(
                user.id,
                refundAmount,
                'CREDIT',
                `REFUND_CANCELED_${number.id}`
              );
              
              refundProcessed = true;
              toast.success(`Order cancelled and ₹${refundAmount} refunded to wallet`);
              
              // Refresh wallet balance
              await refetchBalance();
            } else {
              console.warn("Skipping direct wallet update due to zero amount");
            }
          } catch (directError) {
            console.error("Direct wallet update failed:", directError);
            toast.warning("Order cancelled. Refund may be delayed", {
              description: "Your balance will be updated shortly."
            });
          }
        }
      }
      
      if (!shouldProcessRefund) {
        // No refund given because service was already used
        toast.info("Order cancelled but no refund issued", {
          description: "Service was already provided (SMS received), so no refund is applicable."
        });
      }
      
      // Update status in database without additional refund attempt
      try {
        // IMPORTANT: Skip refund if SMS was received or there was an SMS received error
        // Pass true to skipRefund when we DON'T want a refund to happen
        await updateVirtualNumberStatus(user.id, number.id, 'CANCELED', undefined, undefined, !shouldProcessRefund);
        // Clear persisted data
        clearOtpData();
      } catch (dbError) {
        console.error("Error updating database, but number was cancelled in 5sim:", dbError);
        // Still clear OTP data
        clearOtpData();
      }
      
      // Reset UI state to allow new selection
      resetUIState(true); // Skip auto-cancellation since we're already cancelling
    } catch (e: any) {
      console.error("Error cancelling order:", e);
      setError(e.message || "An unexpected error occurred.");
      toast.error(e.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleBanNumber = async () => {
    setIsLoading(true)
    try {
      if (!number?.id) {
        setError("No order ID to ban.")
        setIsLoading(false)
        return
      }
      
      if (!user) {
        setError("User not authenticated.")
        setIsLoading(false)
        return
      }

      console.log("Starting ban process for order:", number.id);
      
      // Check for transaction ID first
      const transactionId = savedTransaction.current?.id;
      console.log("Transaction ID from context:", transactionId);
      
      // IMPORTANT: Check if SMS has been received already
      // Only consider SMS received if we have actual SMS content
      const hasReceivedSms = smsCode !== null;
      console.log("Has received SMS content:", hasReceivedSms);
      console.log("Order status:", orderStatus);
      
      // Attempt to ban the number in 5sim
      let data;
      let banApiError = false;
      let smsReceivedError = false;
      
      try {
        data = await banOrder(Number(number.id));
        console.log("Ban successful:", data);
      } catch (banError: any) {
        console.error("Error banning number in 5sim:", banError);
        banApiError = true;
        
        // Check if this is an SMS received error
        if (banError.message && (
            banError.message.includes("SMS was already received") || 
            banError.message.toLowerCase().includes("cannot ban order"))) {
          smsReceivedError = true;
          toast.error("Cannot ban this number", {
            description: "The number cannot be banned because the SMS was already received."
          });
        } else {
          toast.error("Could not ban number in 5sim", {
            description: "Will still attempt to update status locally."
          });
        }
        // Continue with refund process even if 5sim API fails
      }

      // Update UI state first
      setNumber(null)
      setSmsCode(null)
      setIsCheckingSms(false)
      setIsOrderCancelled(true)
      
      // If we couldn't ban because SMS was received, mark as FINISHED instead of BANNED
      if (smsReceivedError || hasReceivedSms) {
        setOrderStatus("FINISHED")
        toast.info("Order marked as completed", {
          description: "The number received an SMS and has been marked as completed."
        });
      } else {
        setOrderStatus("BANNED")
      }
      
      setIsOtpVerified(false)
      setIsOrderFinished(true)
      
      // We should only process refund if SMS was NOT received
      const shouldProcessRefund = !hasReceivedSms && !smsReceivedError;
      
      if (shouldProcessRefund) {
        let refundProcessed = false;
        
        console.log(`Starting refund process for order ${number.id}, transaction ${transactionId}`);
        
        // First try with the saved transaction ID
        if (transactionId) {
          try {
            console.log("Processing refund with saved transaction ID:", transactionId);
            await handleVirtualNumberRefund(user.id, transactionId, "BANNED");
            refundProcessed = true;
            toast.success("Number banned and balance refunded successfully");
            
            // Refresh wallet balance to reflect the refund immediately
            await refetchBalance();
          } catch (refundError) {
            console.error("Error processing refund with saved transaction ID:", refundError);
            // Will try fallback method next
          }
        } else {
          console.warn("No transaction ID found in context for refund during ban operation");
          // Try with the lastVirtualNumberTransaction from localStorage as fallback
          const fallbackTransactionId = localStorage.getItem('lastVirtualNumberTransaction');
          console.log("Fallback transaction ID from localStorage:", fallbackTransactionId);
          
          if (fallbackTransactionId) {
            try {
              console.log("Processing refund with fallback transaction ID:", fallbackTransactionId);
              await handleVirtualNumberRefund(user.id, fallbackTransactionId, "BANNED");
              refundProcessed = true;
              toast.success("Number banned and balance refunded successfully");
              
              // Refresh wallet balance
              await refetchBalance();
            } catch (fallbackError) {
              console.error("Error processing refund with fallback transaction ID:", fallbackError);
              // Will try direct wallet update next
            }
          }
        }
        
        // As a final fallback, try a direct wallet update
        if (!refundProcessed) {
          // Try a direct wallet balance update as last resort
          try {
            // Calculate approximate refund amount from the operator cost
            const operatorCost = selectedOperatorDetails?.cost || 0;
            const refundAmount = convertToINR(operatorCost);
            
            console.log(`Attempting direct wallet balance update with amount: ₹${refundAmount}`);
            
            // Only attempt if we have a non-zero amount
            if (refundAmount > 0) {
              // Add to wallet directly
              await updateWalletBalance(user.id, refundAmount, 'CREDIT');
              
              // Create a transaction record
              await createTransaction(
                user.id,
                refundAmount,
                'CREDIT',
                `REFUND_BANNED_${number.id}`
              );
              
              refundProcessed = true;
              toast.success(`Number banned and ₹${refundAmount} refunded to wallet`);
              
              // Refresh wallet balance
              await refetchBalance();
            } else {
              console.warn("Skipping direct wallet update due to zero amount");
            }
          } catch (directError) {
            console.error("Direct wallet update failed:", directError);
            toast.warning("Number banned. Refund may be delayed", {
              description: "Your balance will be updated shortly."
            });
          }
        }
      }
      
      if (!shouldProcessRefund) {
        // No refund given because service was already used
        toast.info("Number banned but no refund issued", {
          description: "Service was already provided (SMS received), so no refund is applicable."
        });
      }
      
      // Update status in database without additional refund attempt
      try {
        // IMPORTANT: Skip refund if SMS was received or there was an SMS received error
        // Pass true to skipRefund when we DON'T want a refund to happen
        await updateVirtualNumberStatus(user.id, number.id, 'BANNED', undefined, undefined, !shouldProcessRefund);
        // Clear persisted data
        clearOtpData()
      } catch (dbError) {
        console.error("Error updating database, but number was banned in 5sim:", dbError)
        // Still clear OTP data
        clearOtpData()
      }
      
      // Reset UI state to allow new selection
      resetUIState()
    } catch (e: any) {
      console.error("Error banning number:", e)
      setError(e.message || "An unexpected error occurred.")
      toast.error(e.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  // Add refresh function to handle out-of-sync state
  const refreshComponent = async () => {
    console.log("Refreshing component state...")
    setError(null)
    
    // Only attempt to refresh if we have a user and an order ID
    if (user && orderId) {
      try {
        // Get latest order status from API
        await syncOrderStatus(orderId.toString())
        
        // Also refresh the wallet balance
        await refetchBalance()
        
        toast.success("Status refreshed")
      } catch (error) {
        console.error("Error refreshing state:", error)
        toast.error("Could not refresh status")
      }
    }
  }

  const handleFinishOrder = async () => {
    setIsLoading(true)
    try {
      if (!orderId || !user) {
        setError("No order ID to finish or user not found.")
        return
      }

      // Add a lock to prevent multiple submissions
      if (isOrderFinished) {
        return
      }
      
      // Check if SMS was received - important for preventing refund
      const hasReceivedSms = smsCode !== null || orderStatus === "RECEIVED";
      console.log("Has received SMS before finishing:", hasReceivedSms);
      
      // First check the current status of the order
      const orderCheck = await getSmsCode(orderId.toString())
      console.log("Current order status check:", orderCheck)
      
      // If the order is already finished (possibly from admin panel)
      if (orderCheck && (orderCheck.status === "FINISHED" || orderCheck.status === "BANNED")) {
        console.log("Order already completed with status:", orderCheck.status)
        
        // Update UI state first
        toast.success(`Order already marked as ${orderCheck.status.toLowerCase()} in the system.`)
        setOrderStatus(orderCheck.status as OrderStatus)
        setIsOrderFinished(true)
        
        // Clear any timers
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number)
          smsCheckInterval.current = null
        }
        
        // Update status in database, but don't block UI
        try {
          await updateVirtualNumberStatus(user.id, orderId.toString(), orderCheck.status, smsCode || undefined, fullSms || undefined, true)
          // Clear persisted data
          clearOtpData()
        } catch (dbError) {
          console.error("Error updating database for already completed order:", dbError)
          // Still clear OTP data
          clearOtpData()
        }
        
        // Reset UI state immediately instead of delayed
        resetUIState(true)
        return
      }

      try {
        // Finish order in 5sim
        const data = await finishOrder(orderId)
        console.log("Finish order response:", data)

        if (data) {
          // Update UI state first
          toast.success("Order marked as finished successfully.")
          setOrderStatus("FINISHED")
          setIsOrderFinished(true)
          
          // Clear any timers
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current as unknown as number)
            smsCheckInterval.current = null
          }
          
          // Update status in database
          try {
            // If SMS was received, no refund should happen
            console.log("Updating status to FINISHED, SMS received:", hasReceivedSms)
            await updateVirtualNumberStatus(user.id, orderId.toString(), 'FINISHED', smsCode || undefined, fullSms || undefined, true)
            // Clear persisted data
            clearOtpData()
          } catch (dbError) {
            console.error("Error updating database after finishing order:", dbError)
            // Still clear OTP data
            clearOtpData()
          }
          
          // Reset UI state immediately instead of with delay
          resetUIState(true)
          return
        }
      } catch (finishError: any) {
        // Handle specific 5sim API errors
        console.error("Error from 5sim finish API:", finishError);
        
        // Check if this is an "order not found" error which likely means it was already finished
        const errorMessage = finishError.message || "";
        if (errorMessage.includes("order not found") || errorMessage.includes("400")) {
          console.log("Order likely already completed, rechecking status...");
        } else {
          // Re-throw for the outer catch block if not an expected error
          throw finishError;
        }
      }
        
      // Handle the case where finishing fails but it could be already finished
      // Check status again
      const recheckedOrder = await getSmsCode(orderId.toString())
      
      if (recheckedOrder && (recheckedOrder.status === "FINISHED" || recheckedOrder.status === "BANNED")) {
        // Order is already finished, so update our UI to match
        toast.success(`Order was already ${recheckedOrder.status.toLowerCase()}.`)
        setOrderStatus(recheckedOrder.status as OrderStatus)
        setIsOrderFinished(true)
        
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number)
          smsCheckInterval.current = null
        }
        
        // Try to update database status
        try {
          await updateVirtualNumberStatus(user.id, orderId.toString(), recheckedOrder.status, smsCode || undefined, fullSms || undefined, true)
          clearOtpData()
        } catch (dbError) {
          console.error("Error updating database for rechecked order:", dbError)
          clearOtpData()
        }
        
        // Reset UI state immediately
        resetUIState(true)
      } else {
        setError("Failed to finish order. Please try again or refresh the page.")
        toast.error("Failed to finish order.")
        
        // Try to refresh the component state
        await refreshComponent()
      }
    } catch (e: any) {
      console.error("Error finishing order:", e)
      
      // Special handling for common errors
      if (e.message && (e.message.includes("already finished") || e.message.includes("order not found"))) {
        toast.success("Order was already completed.")
        setOrderStatus("FINISHED")
        setIsOrderFinished(true)
        
        // Also update in the database
        try {
          if (user && orderId) {
            await updateVirtualNumberStatus(user.id, orderId.toString(), 'FINISHED', smsCode || undefined, fullSms || undefined, true)
            clearOtpData()
          }
        } catch (dbError) {
          console.error("Error updating database for already finished order:", dbError)
          clearOtpData()
        }
        
        // Clear any timers
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number)
          smsCheckInterval.current = null
        }
        
        // Reset UI state immediately
        resetUIState(true)
      } else {
        // For other errors, show the error but don't reset UI
        setError(e.message || "An unexpected error occurred.")
        toast.error(e.message || "An unexpected error occurred.")
      }
    } finally {
      setIsLoading(false)
    }
  }


  const handleCopyToClipboard = async (text: string, setState: (value: boolean) => void) => {
    const setLoadingState = text === number?.phone ? setIsCopyingNumber : setIsCopyingOtp
    setLoadingState(true)
    try {
      await navigator.clipboard.writeText(text)
      setState(true)
      toast.success("Copied to clipboard!")
      setTimeout(() => setState(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
      toast.error("Failed to copy text.")
    } finally {
      setLoadingState(false)
    }
  }

  const handleCountryChange = async (value: string) => {
    try {
      const normalizedCountry = normalizeCountryInput(value)
      console.log("Country selection:", {
        original: value,
        normalized: normalizedCountry,
      })

      setSelectedCountry(normalizedCountry)
      setError(null)
      setIsLoading(true)

      const { products, error } = await getProducts(normalizedCountry)
      if (error) {
        throw new Error(error)
      }

      if (!products || products.length === 0) {
        throw new Error(`No products available for ${countries.find((c) => c.code === value)?.name}`)
      }

      setProducts(products)
    } catch (error: any) {
      console.error("Error fetching products:", error)
      setError(error.message)
      toast.error(error.message)
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }


  useEffect(() => {
    setFilteredCountries(countries)
  }, [countries])

  const getStatusColor = (status: OrderStatus | null): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return "outline"
    
    switch (status) {
      case "PENDING":
        return "secondary" // Default yellow/orange for pending
      case "RECEIVED":
        return "default" // Default green for received (success)
      case "FINISHED":
        return "outline" // Grey outline for finished
      case "BANNED":
      case "CANCELED":
      case "TIMEOUT":
        return "destructive" // Red for banned/canceled/timeout
      default:
        return "outline" // Default is outline
    }
  }

  // Add loading skeleton for the selection section
  const SelectionSkeleton = () => (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1 sm:space-y-2">
          <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
          <Skeleton className="h-9 sm:h-10 w-full" />
        </div>
      ))}
    </div>
  )

  // Add loading skeleton for the number display
  const NumberDisplaySkeleton = () => (
    <Card className="mt-2 sm:mt-4">
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-4 rounded-lg border gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12 sm:w-16" />
            <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 sm:h-16 rounded-md" />
          <Skeleton className="h-14 sm:h-16 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )

  // Define checkSms function 
  const checkSms = async (orderIdToUse: number) => {
    // Removed console.log for deployment
    if (!orderIdToUse) {
      // Removed console.error for deployment
      return;
    }

    try {
      const result = await getSmsCode(String(orderIdToUse));
      // Removed console.log for deployment

      // Ensure we have a valid data object
      if (!result) {
        // Removed console.log for deployment
        return;
      }
      
      // Now we can safely access the data properties
      const data = result; // For clarity in the code

      if (data.status) {
        setOrderStatus(data.status as OrderStatus);
        updateOtpData({ orderStatus: data.status });
      }
      
      // Update product name from API response if available
      if (data.product) {
        // Removed console.log for deployment
        setActiveProductName(data.product.replace(/_/g, " "));
        // Don't update OTP data as service field doesn't exist in OtpData interface
      }

      if (data.sms && data.sms.length > 0) {
        // We have actual SMS content
        // Removed console.log for deployment
        
        // Process SMS: Extract OTP code
        const lastSms = data.sms[data.sms.length - 1];
        let smsText = lastSms.text || "";
        setFullSms(smsText);
        
        // Extract OTP using regex
        const otpMatch = smsText.match(/\b\d{4,6}\b/);
        if (otpMatch) {
          setSmsCode(otpMatch[0]);
          updateOtpData({ smsCode: otpMatch[0], fullSms: smsText });
          
          // Stop checking SMS since we found one
          setIsCheckingSms(false);
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current);
            smsCheckInterval.current = null;
          }

          // Update order status to RECEIVED if not already
          if (orderStatus !== "RECEIVED") {
            setOrderStatus("RECEIVED");
            updateOtpData({ orderStatus: "RECEIVED" });
          }
          
          toast.success("OTP Received!", {
            description: `Your OTP is: ${otpMatch[0]}`
          });
        } else {
          // SMS received but no OTP detected
          // Removed console.log for deployment
          toast.warning("SMS received but no OTP found", {
            description: "We received an SMS but couldn't detect a valid OTP code."
          });
        }
      } else if (data.status === "RECEIVED") {
        // Special case: API reports RECEIVED but no SMS content yet
        // Removed console.log for deployment
        
        // Keep checking in case the SMS content arrives later
        if (!isCheckingSms) {
          setIsCheckingSms(true);
        }
        
        // Don't set smsCode since we don't have actual content yet
        // For deployment, only show this toast once per session to avoid spam
        if (!hasShownReceivedStatusToast.current) {
          toast.info("SMS status is RECEIVED", {
            description: "The system reports SMS is on the way but content is not available yet. Still waiting..."
          });
          hasShownReceivedStatusToast.current = true;
        }
      }

      // Update status display with rich HTML
      if (data.expires) {
        const expiryDate = new Date(data.expires);
        if (!isNaN(expiryDate.getTime())) {
          const timeoutDuration = expiryDate.getTime() - Date.now();
          if (timeoutDuration > 0) {
            // Set timeout timer
            setOtpTimeout(Math.floor(timeoutDuration / 1000));
            setIsTimeoutActive(true);
          }
        }
      }
    } catch (error: any) {
      // Removed console.error for deployment
      
      // For order not found or already completed errors, handle gracefully
      if (error.message?.includes('order not found')) {
        // If order is not found, it may have been cancelled or completed
        // Just stop checking and don't show error toast
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current);
          smsCheckInterval.current = null;
          setIsCheckingSms(false);
        }
        return;
      }
      
      // Don't show toast errors on every interval check unless it's a critical error
      // This prevents too many error notifications during automatic polling
      if (
        error.message?.includes('API authentication error') || 
        error.message?.includes('non-JSON response') ||
        error.message?.includes('Failed to parse API response') 
      ) {
        // Only update the error state without showing toast for polling
        setError(error.message || "Error checking for SMS");
        
        // Stop the interval to prevent repeated errors
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current);
          smsCheckInterval.current = null;
          setIsCheckingSms(false);
          
          // Only show one toast for this critical error
          // For deployment, only show if not in automatic polling mode
          if (!isPollingAutomatically.current) {
            toast.error("API connection issue", {
              description: "Error communicating with 5sim. Check your API credentials."
            });
          }
        }
      }
    }
  };

  // Now define startCheckingSms to use the checkSms function
  const startCheckingSms = (initialOrderId?: number | string) => {
    // Use the provided initialOrderId, or fall back to the orderId from state
    const orderIdToUse = initialOrderId ? Number(initialOrderId) : orderId;
    
    if (!orderIdToUse) {
      // Removed console.error for deployment
      setIsCheckingSms(false);
      return;
    }
    
    // Reset retry counter when starting checks
    retryAttemptsRef.current = 0;
    setRetryAttempts(0);
    
    // Clear any existing interval first to prevent duplicates
    if (smsCheckInterval.current) {
      clearInterval(smsCheckInterval.current as unknown as number);
      smsCheckInterval.current = null;
    }
    
    // Check if we already know status is RECEIVED (from state)
    const checkInterval = orderStatus === "RECEIVED" ? 3000 : 10000; // 3s for RECEIVED status, 10s for others
    
    // Removed console.log for deployment
    
    // Set automatic polling flag to avoid showing error toasts during polling
    isPollingAutomatically.current = true;
    
    // Run checkSms immediately before setting interval
    checkSms(orderIdToUse);
    
    // Set interval with appropriate frequency
    const intervalId = setInterval(() => checkSms(orderIdToUse), checkInterval);
    smsCheckInterval.current = intervalId as unknown as NodeJS.Timeout;
  };

  // Add a manual SMS check function

  // Handling timeout scenario

  // Add a call to this function in the useEffect where you load the component data
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      
      // Use the correctly scoped functions
      const loadInitialData = async () => {
        try {
          // Call cleanup separately since it's a new function
          await cleanupStuckTransactions();
          
          // Call force balance update to refresh the wallet amount
          await forceBalanceUpdate();
        } catch (error) {
          console.error("Error during startup cleanup:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadInitialData();
    }
  }, [user]);

  return (
    <Card className="w-full ">
      <CardHeader className="sticky top-0 bg-background z-10 border-b px-4 py-3 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <CardTitle className="text-xl sm:text-2xl font-bold">Virtual Number Service</CardTitle>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "font-mono transition-all duration-200",
                      isWalletLoading && "opacity-70"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                      {isWalletLoading ? (
                        <Spinner className="h-3 w-3" />
                      ) : (
                        <span>₹{walletBalance.toFixed(2)}</span>
                      )}
                    </div>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Current wallet balance</p>
                  <p className="text-xs text-muted-foreground">Auto-updates every 30s</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2" 
                    onClick={() => refetchBalance()}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Refresh Now
                  </Button>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6">
        {/* Selection Section */}
        {isCountryLoading || isProductLoading ? (
          <SelectionSkeleton />
        ) : (
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
            {/* Country Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                Country
                {isCountryLoading && <Spinner className="h-4 w-4" />}
              </Label>
              <Popover
                open={countryOpen}
                onOpenChange={(open) => {
                  setCountryOpen(open)
                  if (!open) setCountrySearchQuery("")
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-full justify-between h-10 px-3 text-sm"
                    disabled={isCountryLoading}
                  >
                    {isCountryLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedCountry ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center truncate">
                          {(() => {
                            const country = countries.find((c) => c.code === selectedCountry);
                            return country ? (
                              <>
                                <CountryFlag iso={country.iso} />
                                <span className="truncate">
                                  {country.name.charAt(0).toUpperCase() + country.name.slice(1).toLowerCase()}
                                </span>
                              </>
                            ) : (
                              selectedCountry
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select country</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0" 
                  align="start"
                  side="bottom"
                  sideOffset={5}
                  alignOffset={0}
                  avoidCollisions={true}
                  sticky="always"
                >
                  <Command className="w-full">
                    <CommandInput
                      placeholder="Search countries..."
                      value={countrySearchQuery}
                      onValueChange={setCountrySearchQuery}
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No countries found</CommandEmpty>
                      <CommandGroup>
                        {Array.isArray(filteredCountries) &&
                          filteredCountries.map((country) => (
                            <CommandItem
                              key={country.code}
                              value={country.code}
                              onSelect={() => {
                                handleCountryChange(country.code)
                                setCountryOpen(false)
                              }}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Check
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    selectedCountry === country.prefix ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <CountryFlag iso={country.iso} />
                                <span className="truncate capitalize">
                                  {country.name.charAt(0).toUpperCase() + country.name.slice(1).toLowerCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {country.prefix}
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Service Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">Service for OTP</Label>
              <Popover
                open={productOpen}
                onOpenChange={(open) => {
                  setProductOpen(open)
                  if (!open) setServiceSearchQuery("")
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between h-10 px-3 text-sm"
                    disabled={!selectedCountry || products.length === 0}
                  >
                    {!selectedCountry ? (
                      "Select country first"
                    ) : products.length === 0 ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedProduct ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="capitalize truncate">
                          {products.find((p) => p.id === selectedProduct)?.name.replace(/_/g, " ")}
                        </span>
                        <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap ml-1">
                          {products.find((p) => p.id === selectedProduct)?.quantity || 0} avl
                        </Badge>
                      </div>
                    ) : (
                      "Select service"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 z-50 max-h-[70vh] overflow-auto"
                  align="start"
                  side="bottom"
                  sideOffset={5}
                  alignOffset={0}
                  avoidCollisions={true}
                  collisionPadding={{ top: 10, bottom: 70, left: 10, right: 10 }}
                  sticky="always"
                >
                  <Command>
                    <CommandInput
                      placeholder="Search services..."
                      value={serviceSearchQuery}
                      onValueChange={setServiceSearchQuery}
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No service found.</CommandEmpty>
                      <CommandGroup className="max-h-[50vh] overflow-auto">
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => {
                              setSelectedProduct(product.id === selectedProduct ? "" : product.id)
                              setProductOpen(false)
                            }}
                            className="text-xs sm:text-sm py-1 sm:py-2"
                          >
                            <div className="flex items-center justify-between w-full min-w-0">
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    "h-3 w-3 sm:h-4 sm:w-4 shrink-0",
                                    selectedProduct === product.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="capitalize truncate">{product.name.replace(/_/g, " ")}</span>
                              </div>
                              <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap">
                                {product.quantity} avl
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Operator Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">Operator</Label>
              <Popover open={operatorOpen} onOpenChange={setOperatorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={operatorOpen}
                    className="w-full justify-between h-10 px-3 text-sm"
                    disabled={!selectedProduct || operators.length === 0}
                  >
                    {!selectedProduct ? (
                      "Select service first"
                    ) : operators.length === 0 ? (
                      <Spinner className="h-4 w-4" />
                    ) : selectedOperatorDetails ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="capitalize truncate">{selectedOperatorDetails.displayName}</span>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
                          <Badge variant={selectedOperatorDetails.rate >= 90 ? "secondary" : "outline"} className="font-mono text-xs whitespace-nowrap">
                            {selectedOperatorDetails.rate}%
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap">
                            ₹{convertToINR(selectedOperatorDetails.cost)}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      "Select provider"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 z-50 max-h-[70vh] overflow-auto"
                  align="start"
                  side="bottom"
                  sideOffset={5}
                  alignOffset={0}
                  avoidCollisions={true}
                  collisionPadding={{ top: 10, bottom: 70, left: 10, right: 10 }}
                  sticky="always"
                >
                  <Command className="w-full">
                    <CommandInput className="w-full text-sm" placeholder="Search providers..." />
                    <CommandList className="w-full">
                      <CommandEmpty>No provider found.</CommandEmpty>
                      <CommandGroup className="max-h-[50vh] overflow-auto">
                        {operators.map((operator) => (
                          <CommandItem
                            key={operator.id}
                            value={operator.id}
                            onSelect={() => {
                              setSelectedOperator(operator.id === selectedOperator ? "" : operator.id)
                              setOperatorOpen(false)
                            }}
                            className="flex items-center justify-between text-xs sm:text-sm py-1 sm:py-2"
                          >
                            <div className="flex items-center">
                              <Check
                                className={cn(
                                  "mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4",
                                  selectedOperator === operator.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="capitalize truncate">{operator.displayName}</span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                              <Badge variant={operator.rate >= 90 ? "secondary" : "outline"} className="font-mono text-xs whitespace-nowrap">
                                {operator.rate}%
                              </Badge>
                              <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap">
                                ₹{convertToINR(operator.cost)}
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Action Section */}
        <div className="space-y-4">
          {!number ? (
            /* Show get number button when no number is active */
            <>
              {isLoading ? (
                <Skeleton className="h-10 w-full md:w-40" />
              ) : (
                <Button
                  onClick={handleGetNumber}
                  disabled={isLoading || isOrderCancelled || !selectedOperator}
                  className="w-full md:w-auto h-10 text-sm"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4" />
                      <span>Getting Number...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Get Virtual Number</span>
                      {selectedOperatorDetails && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          ₹{convertToINR(selectedOperatorDetails.cost)}
                        </Badge>
                      )}
                    </div>
                  )}
                </Button>
              )}

              {/* Error Display for selection step */}
              {error && (
                <Card className="bg-destructive/10 border-destructive/20">
                  <CardContent className="flex items-center gap-2 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm break-words text-destructive">{error}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* If a number is received, show the ReceivedNumberView component */
            <ReceivedNumberView 
              number={number}
              orderId={orderId}
              orderStatus={orderStatus}
              orderCreatedAt={orderCreatedAt}
              smsCode={smsCode}
              fullSms={fullSms}
              isLoading={isLoading}
              isOrderCancelled={isOrderCancelled}
              isOrderFinished={isOrderFinished}
              isNumberCopied={isNumberCopied}
              isOrderIdCopied={isOrderIdCopied}
              isSmsCodeCopied={isSmsCodeCopied}
              isOtpCopied={isOtpCopied}
              isRetrying={isRetrying}
              isCheckingSms={isCheckingSms}
              retryAttempts={retryAttempts}
              maxRetryAttempts={maxRetryAttempts}
              timeLeft={timeLeft}
              otpTimeout={otpTimeout}
              isTimeoutActive={isTimeoutActive}
              handleBanNumber={handleBanNumber}
              handleCancelOrder={handleCancelOrder}
              handleFinishOrder={handleFinishOrder}
              handleCopyToClipboard={handleCopyToClipboard}
              setIsNumberCopied={setIsNumberCopied}
              setIsOrderIdCopied={setIsOrderIdCopied}
              setIsSmsCodeCopied={setIsSmsCodeCopied}
              setIsOtpCopied={setIsOtpCopied}
              refreshComponent={refreshComponent}
              getStatusColor={getStatusColor}
              error={error}
              NumberDisplaySkeleton={NumberDisplaySkeleton}
              resetUIState={resetUIState}
              productName={activeProductName || (selectedProduct ? products.find((p) => p.id === selectedProduct)?.name.replace(/_/g, " ") : undefined)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default GetVirtualNumber
