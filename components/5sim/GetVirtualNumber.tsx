"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  getProducts,
  getOperators,
  getCountries,
  getVirtualNumber,
  getSmsCode,
  cancelOrder,
  banOrder,
  finishOrder,
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
import { AlertTriangle, RefreshCw, Wallet } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
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
import { Combobox } from "@/components/ui/combobox"
import { OperatorItem } from "./OperatorItem"
import { ProductItem } from "./ProductItem"
import { CountryItem } from "./CountryItem"

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
const COMMISSION_RATE = 0.50; // 50% commission

const GetVirtualNumber = () => {
  const { user, isLoaded: isUserLoaded } = useUser()
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
  const [isOperatorLoading, setIsOperatorLoading] = useState(false)
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
  const [isCopyingNumber, setIsCopyingNumber] = useState(false)
  const [isCopyingOtp, setIsCopyingOtp] = useState(false)
  const [isOrderIdCopied, setIsOrderIdCopied] = useState(false)
  const [isSmsCodeCopied, setIsSmsCodeCopied] = useState(false)
  const [usingFallbackRate, setUsingFallbackRate] = useState(false);
  const [activeProductName, setActiveProductName] = useState<string | undefined>(undefined);
  
  // Add this query for real-time wallet balance with proper conditioning
  const { 
    data: walletBalance = 0, 
    isLoading: isWalletLoading,
    refetch: refetchBalance
  } = useQuery({
    queryKey: ['walletBalance', user?.id],
    queryFn: () => getWalletBalance(user?.id as string),
    enabled: !!isUserLoaded && !!user?.id,
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

        // Define priority countries to show at the top
        const priorityCountryCodes = [
          "in", // India
          "us", // United States
          "gb", // United Kingdom (England)
          "ca", // Canada
          "cn", // China
          "pk", // Pakistan
          "np", // Nepal
          "bd", // Bangladesh
          "ru", // Russia
          "sg", // Singapore
          "ae", // United Arab Emirates
          "sa", // Saudi Arabia
          "mx", // Mexico
          "br", // Brazil
          "ar", // Argentina
          "ph", // Philippines
          "id", // Indonesia
          "th", // Thailand
          "my", // Malaysia
          "vn", // Vietnam
          "hk", // Hong Kong
              
        ]

        // Sort countries by placing priority countries at the top, 
        // then sorting the remaining alphabetically
        const sortedCountries = formattedCountries.sort((a, b) => {
          const aPriority = priorityCountryCodes.indexOf(a.iso.toLowerCase())
          const bPriority = priorityCountryCodes.indexOf(b.iso.toLowerCase())
          
          // If both are priority countries, sort by their order in the priority list
          if (aPriority !== -1 && bPriority !== -1) {
            return aPriority - bPriority
          }
          
          // If only a is a priority country, it comes first
          if (aPriority !== -1) return -1
          
          // If only b is a priority country, it comes first
          if (bPriority !== -1) return 1
          
          // For non-priority countries, sort alphabetically
          return a.name.localeCompare(b.name)
        })

        console.log("Setting countries state with:", sortedCountries)
        setCountries(sortedCountries)
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
        setIsOperatorLoading(true) // Set loading state

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
        } finally {
          setIsOperatorLoading(false) // Clear loading state
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
          // Set SMS data first to ensure it's displayed immediately
          if (session.sms_code) {
            setSmsCode(session.sms_code)
            setFullSms(session.full_sms || null)
            
            // Show success toast for OTP
            toast.success("OTP Loaded", {
              description: `Your OTP is: ${session.sms_code}`
            })
          }

          setNumber({
            phone: session.phone_number,
            id: session.order_id,
          })
          setOrderId(Number(session.order_id))
          setOrderStatus(session.status as OrderStatus)
          setOrderCreatedAt(new Date(session.created_at))
          
          if (session.service) {
            setActiveProductName(session.service.replace(/_/g, " "))
          }

          // Always start SMS checking for non-final statuses
          if (!["CANCELED", "TIMEOUT", "FINISHED", "BANNED"].includes(session.status)) {
            setIsCheckingSms(true)
            startCheckingSms(session.order_id)
          }
          
          // Sync with 5SIM API
          await syncOrderStatus(session.order_id)
        }
      } catch (error) {
        console.error("Error loading active session:", error)
      }
    }

    loadActiveSession()
  }, [user])

  // Add a new function to synchronize local state with 5SIM API
  const syncOrderStatus = async (orderId: string) => {
    try {
      const result = await getSmsCode(orderId);
      
      if (!result) {
        return null;
      }

      // Update status
      if (result.status) {
        setOrderStatus(result.status as OrderStatus);
        updateOtpData({ orderStatus: result.status });
      }

      // Process SMS if available
      if (result.sms && result.sms.length > 0) {
        const lastSms = result.sms[result.sms.length - 1];
        const smsText = lastSms.text || "";
        
        // Only update if we don't already have an SMS code
        if (!smsCode) {
          setFullSms(smsText);
          
          // Extract OTP using regex
          const otpMatch = smsText.match(/\b\d{4,6}\b/);
          if (otpMatch) {
            setSmsCode(otpMatch[0]);
            updateOtpData({ smsCode: otpMatch[0], fullSms: smsText });
            
            toast.success("OTP Found!", {
              description: `Your OTP is: ${otpMatch[0]}`
            });
          }
        }
      }

      // Update expiry time
      if (result.expires) {
        const expiryDate = new Date(result.expires);
        if (!isNaN(expiryDate.getTime())) {
          const timeoutDuration = expiryDate.getTime() - Date.now();
          if (timeoutDuration > 0) {
            setOtpTimeout(Math.floor(timeoutDuration / 1000));
            setIsTimeoutActive(true);
          }
        }
      }

      return result;
    } catch (error: any) {
      // Handle errors silently during sync
      return null;
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
      // Explicitly set checking flag to true for immediate UI feedback
      setIsCheckingSms(true);
      
      // Start checking for SMS immediately with a short delay to ensure state is updated
      setTimeout(() => {
        startCheckingSms(data.id);
      }, 100);

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
      if (!value) {
        setSelectedCountry("")
        setProducts([])
        return
      }

      console.log("Country selection:", value)
      
      setSelectedCountry(value)
      setError(null)
      setIsLoading(true)

      const { products, error } = await getProducts(value)
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
    setCountries(countries)
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
    if (!orderIdToUse) {
      return;
    }

    try {
      const result = await getSmsCode(String(orderIdToUse));
      
      if (!result) {
        return;
      }
      
      const data = result;

      // Always update status first
      if (data.status) {
        const newStatus = data.status as OrderStatus;
        setOrderStatus(newStatus);
        updateOtpData({ orderStatus: newStatus });
        
        // If status is CANCELED but we have SMS, we still want to process them
        if (newStatus === "CANCELED" && (!data.sms || data.sms.length === 0)) {
          cleanupTimers();
          return;
        }
      }
      
      // Update product name if available
      if (data.product) {
        setActiveProductName(data.product.replace(/_/g, " "));
      }

      // Process SMS messages if they exist
      if (data.sms && data.sms.length > 0) {
        const lastSms = data.sms[data.sms.length - 1];
        let smsText = lastSms.text || "";
        setFullSms(smsText);
        
        // Extract OTP using regex - look for 4-8 digit sequences 
        // This improved regex looks for common OTP patterns
        const otpMatch = smsText.match(/\b\d{4,8}\b/) || smsText.match(/code:?\s*(\d+)/i) || smsText.match(/otp:?\s*(\d+)/i);
        
        if (otpMatch) {
          const extractedOtp = otpMatch[1] || otpMatch[0]; // Use the captured group if it exists
          setSmsCode(extractedOtp);
          updateOtpData({ smsCode: extractedOtp, fullSms: smsText });
          
          // Don't stop checking automatically - let the user decide when to finish
          // Instead, just reduce the frequency of checks
          const checkInterval = 5000; // Check every 5 seconds after OTP is found
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current);
            const intervalId = setInterval(() => checkSms(orderIdToUse), checkInterval);
            smsCheckInterval.current = intervalId as unknown as NodeJS.Timeout;
          }

          // Update order status to RECEIVED if not already
          if (data.status !== "CANCELED") {
            setOrderStatus("RECEIVED");
            updateOtpData({ orderStatus: "RECEIVED" });
          }
          
          toast.success("OTP Received!", {
            description: `Your OTP is: ${extractedOtp}`
          });
        } else {
          // Keep checking if no OTP found in the SMS
          if (!isCheckingSms) {
            setIsCheckingSms(true);
          }
          toast.warning("SMS received but no OTP found", {
            description: "We received an SMS but couldn't detect a valid OTP code."
          });
        }
      } else if (data.status === "RECEIVED") {
        // API reports RECEIVED but no SMS content yet
        if (!isCheckingSms) {
          setIsCheckingSms(true);
        }
        
        if (!hasShownReceivedStatusToast.current) {
          toast.info("SMS status is RECEIVED", {
            description: "The system reports SMS is on the way but content is not available yet. Still waiting..."
          });
          hasShownReceivedStatusToast.current = true;
        }
      }

      // Handle expiry time
      if (data.expires) {
        const expiryDate = new Date(data.expires);
        if (!isNaN(expiryDate.getTime())) {
          const timeoutDuration = expiryDate.getTime() - Date.now();
          if (timeoutDuration > 0) {
            setOtpTimeout(Math.floor(timeoutDuration / 1000));
            setIsTimeoutActive(true);
          }
        }
      }
    } catch (error: any) {
      if (error.message?.includes('order not found')) {
        cleanupTimers();
        return;
      }
      
      if (!isPollingAutomatically.current) {
        if (error.message?.includes('API authentication error') || 
            error.message?.includes('non-JSON response') ||
            error.message?.includes('Failed to parse API response')) {
          setError(error.message || "Error checking for SMS");
          cleanupTimers();
          toast.error("API connection issue", {
            description: "Error communicating with 5sim. Check your API credentials."
          });
        }
      }
    }
  };

  // Now define startCheckingSms to use the checkSms function
  const startCheckingSms = (initialOrderId?: number | string) => {
    // Use the provided initialOrderId, or fall back to the orderId from state
    const orderIdToUse = initialOrderId ? Number(initialOrderId) : orderId;
    
    if (!orderIdToUse) {
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
    
    // Always use 1000ms (1 second) for more frequent checking
    const checkInterval = 1000; 
    
    // Set automatic polling flag to avoid showing error toasts during polling
    isPollingAutomatically.current = true;
    
    // Run checkSms immediately before setting interval
    checkSms(orderIdToUse);
    
    // Set interval with appropriate frequency
    const intervalId = setInterval(() => checkSms(orderIdToUse), checkInterval);
    smsCheckInterval.current = intervalId as unknown as NodeJS.Timeout;
    
    // Set isCheckingSms flag to true to show the waiting UI
    setIsCheckingSms(true);
  };

  // Add a manual SMS check function

  // Handling timeout scenario

  // Add a call to this function in the useEffect where you load the component data
  useEffect(() => {
    if (isUserLoaded && user) {
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
          // Don't throw error, handle gracefully
          toast.error("Error initializing data. Please refresh the page.");
        } finally {
          setIsLoading(false);
        }
      };
      
      loadInitialData();
    }
  }, [isUserLoaded, user]);

  // Create formatted options for combobox components
  const countryOptions = useMemo(() => {
    if (!Array.isArray(countries)) return []
    return countries.map(country => ({
      value: country.code,
      label: country.name.charAt(0).toUpperCase() + country.name.slice(1).toLowerCase(),
    }))
  }, [countries])

  // Add product options for combobox
  const productOptions = useMemo(() => {
    if (!Array.isArray(products)) return []
    return products.map(product => ({
      value: product.id,
      label: product.name.replace(/_/g, " "),
    }))
  }, [products])

  // Add operator options for the combobox
  const operatorOptions = useMemo(() => {
    if (!Array.isArray(operators)) return []
    return operators.map(operator => ({
      value: operator.id,
      label: operator.displayName,
    }))
  }, [operators])

  // Add a new useEffect to start SMS checking for active orders on component load
  useEffect(() => {
    // Check if we have an active order that might be waiting for SMS
    if (isUserLoaded && user && number && orderId && 
        (orderStatus === "PENDING" || orderStatus === "RECEIVED") && 
        !isCheckingSms && !smsCode) {
      console.log("Starting automatic SMS checking for order:", orderId);
      
      // Start checking for SMS
      startCheckingSms(orderId);
      
      // Set checking flag to show proper UI state
      setIsCheckingSms(true);
    }
  }, [isUserLoaded, user, number, orderId, orderStatus, isCheckingSms, smsCode]);

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
                        <Spinner variant="infinite" className="h-3 w-3" />
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
          <Card className="p-4 bg-card/50 border-muted">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Select Service Options</h3>
              <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3">
                {/* Country Selection */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    Country
                    {isCountryLoading && <Spinner variant="infinite" className="h-4 w-4" />}
                  </Label>
                  <Combobox
                    options={countryOptions}
                    value={selectedCountry}
                    onChange={handleCountryChange}
                    placeholder="Select country..."
                    searchPlaceholder="Search countries..."
                    isLoading={isCountryLoading}
                    disabled={isCountryLoading || isLoading}
                    emptyText={isCountryLoading ? "Loading countries..." : "No countries found."}
                    triggerClassName="w-full"
                    contentClassName="w-[280px]"
                    renderOption={(option) => {
                      const country = countries.find(c => c.code === option.value);
                      if (!country) return null;
                      return (
                        <CountryItem
                          country={country}
                          isSelected={selectedCountry === country.code}
                        />
                      );
                    }}
                  />
                  
                </div>

                {/* Product Selection */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    Service
                    {isProductLoading && <Spinner variant="infinite" className="h-4 w-4" />}
                  </Label>
                  <Combobox
                    options={productOptions}
                    value={selectedProduct}
                    onChange={(value) => setSelectedProduct(value)}
                    placeholder="Select service..."
                    searchPlaceholder="Search services..."
                    isLoading={isProductLoading}
                    disabled={isProductLoading || !selectedCountry || isLoading}
                    emptyText={isProductLoading ? "Loading services..." : "No services found."}
                    triggerClassName="w-full"
                    contentClassName="w-[280px]"
                    renderOption={(option) => {
                      const product = products.find(p => p.id === option.value);
                      if (!product) return null;
                      return (
                        <ProductItem
                          product={product}
                          isSelected={selectedProduct === product.id}
                        />
                      );
                    }}
                  />
                  
                </div>

                {/* Operator Selection */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base font-medium">
                    Operator
                    {isOperatorLoading && <Spinner variant="infinite" className="h-4 w-4" />}
                  </Label>
                  <Combobox
                    options={operatorOptions}
                    value={selectedOperator}
                    onChange={(value) => {
                      setSelectedOperator(value);
                      // Also update the selectedOperatorDetails for the button display
                      if (value) {
                        const operator = operators.find(op => op.id === value);
                        if (operator) {
                          setSelectedOperatorDetails(operator);
                        }
                      } else {
                        setSelectedOperatorDetails(null);
                      }
                    }}
                    placeholder="Select operator..."
                    searchPlaceholder="Search operators..."
                    isLoading={isOperatorLoading}
                    disabled={isOperatorLoading || !selectedProduct || isLoading}
                    emptyText={isOperatorLoading ? "Loading operators..." : "No operators found."}
                    triggerClassName="w-full"
                    contentClassName="w-[300px]"
                    renderOption={(option) => {
                      const operator = operators.find(op => op.id === option.value);
                      if (!operator) return null;
                      return (
                        <OperatorItem
                          operator={operator}
                          isSelected={selectedOperator === operator.id}
                          convertToINR={convertToINR}
                        />
                      );
                    }}
                  />
                 
                </div>
              </div>
            </div>
          </Card>
        )}

        <Separator className="my-4" />

        {/* Action Section */}
        <div className="space-y-4">
          {!number ? (
            /* Show get number button when no number is active */
            <>
              <Button
                onClick={handleGetNumber}
                disabled={isLoading || isOrderCancelled || !selectedOperator}
                className="w-full sm:w-auto h-10 text-sm transition-all flex-grow"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner variant="infinite" className="h-4 w-4" />
                    <span>Getting Number...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Get Number</span>
                    {selectedOperatorDetails && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        ₹{convertToINR(selectedOperatorDetails.cost)}
                      </Badge>
                    )}
                  </div>
                )}
              </Button>

              {/* Error Display for selection step */}
              {error && (
                <Card className="bg-destructive/10 border-destructive/20 flex-grow w-full sm:w-auto">
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
              NumberDisplaySkeleton={() => (
                <div className="mt-4 p-4 flex items-center justify-center">
                  <Spinner className="h-8 w-8" />
                </div>
              )}
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