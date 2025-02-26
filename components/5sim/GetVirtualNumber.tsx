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
  reactivateOrder,
  normalizeCountryInput,
} from "@/lib/5simService"

import {
  getWalletBalance,
  createVirtualNumberTransaction,
  handleSuccessfulOTP,
  handleVirtualNumberRefund,
  canPurchaseNumber,
  updateVirtualNumberStatus,
} from "@/lib/walletService"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, ChevronsUpDown, RefreshCw, Wallet } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useUser } from "@clerk/nextjs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import * as React from "react"
import { useOtpPersist } from "@/hooks/useOtpPersist"
import { createOtpSession, updateOtpSession, getActiveOtpSession, deleteOtpSession } from "@/lib/otpSessionService"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from '@tanstack/react-query'


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

const RUB_TO_INR_RATE = 0.99 // Current approximate rate for RUB to INR conversion


interface Country {
  code: string
  name: string
  iso: string
  prefix: string
}


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
  })

  // Timers and state references
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedTransaction = useRef<{ id: string } | null>(null)

  // Add this line near other useRefs
  const retryAttemptsRef = useRef(0)

  const convertToINR = (rubPrice: number): number => {
    return Math.ceil(rubPrice * RUB_TO_INR_RATE)
  }

  // Add a comprehensive reset function to reset the UI state
  const resetUIState = () => {
    console.log("Resetting UI state to allow new selection...")
    
    // Reset selection state
    setSelectedProduct("")
    setSelectedOperator("")
    setSelectedOperatorDetails(null)
    
    // Reset order state
    setNumber(null)
    setSmsCode(null)
    setFullSms(null)
    setOrderId(null)
    setOrderStatus(null)
    setOrderCreatedAt(null)
    
    // Reset UI flags
    setIsCheckingSms(false)
    setIsOrderCancelled(false)
    setIsOrderFinished(false)
    setIsOtpVerified(true)
    setIsOtpCopied(false)
    setIsNumberCopied(false)
    setIsReactivating(false)
    setIsRetrying(false)
    setRetryAttempts(0)
    retryAttemptsRef.current = 0
    
    // Reset timers
    setOtpTimeout(300)
    setTimeLeft(300)
    setIsTimeoutActive(false)
    
    // Clear any active intervals
    if (smsCheckInterval.current) {
      clearInterval(smsCheckInterval.current as unknown as number)
      smsCheckInterval.current = null
    }
    
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      setTimeoutTimer(null)
    }
    
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    
    // Clear any saved transaction reference
    savedTransaction.current = null
    
    // Clear any errors
    setError(null)
    
    // Keep countries, products, and operators data loaded
    // but we'll reset operators when product changes anyway
    
    toast.success("Ready for a new order", {
      description: "You can now select a new service"
    })
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
    try {
      // Get the current status from 5SIM API
      const orderCheck = await getSmsCode(orderId.toString())
      console.log("Syncing order status:", orderCheck)
      
      if (!orderCheck) return
      
      const currentStatus = orderCheck.status as OrderStatus
      
      // Update UI state based on status
      setOrderStatus(currentStatus)
      console.log("Updating status from API:", currentStatus)
      
      // Persist the updated status
      updateOtpData({
        orderStatus: currentStatus
      })
      
      // Handle different statuses
      switch (currentStatus) {
        case "FINISHED":
        case "BANNED":
          setIsOrderFinished(true)
          // Stop checking for SMS if we were still doing that
          if (isCheckingSms) {
            setIsCheckingSms(false)
            if (smsCheckInterval.current) {
              clearInterval(smsCheckInterval.current as unknown as number)
              smsCheckInterval.current = null
            }
          }
          break;
          
        case "CANCELED":
          setIsOrderCancelled(true)
          // Stop checking for SMS if we were still doing that
          if (isCheckingSms) {
            setIsCheckingSms(false)
            if (smsCheckInterval.current) {
              clearInterval(smsCheckInterval.current as unknown as number)
              smsCheckInterval.current = null
            }
          }
          break;
          
        case "RECEIVED":
          // If we have SMS data but didn't capture it
          if (orderCheck.sms && orderCheck.sms.length > 0) {
            const latestSms = orderCheck.sms[orderCheck.sms.length - 1]
            setSmsCode(latestSms.code)
            setFullSms(latestSms.text)
            
            // Persist the SMS data
            updateOtpData({
              smsCode: latestSms.code,
              fullSms: latestSms.text
            })
            
            toast.success("SMS Code Found!", {
              description: `Your verification code is: ${latestSms.code}`,
            });
            
            // Stop checking for SMS since we now have the SMS data
            if (isCheckingSms) {
              setIsCheckingSms(false)
              if (smsCheckInterval.current) {
                clearInterval(smsCheckInterval.current as unknown as number)
                smsCheckInterval.current = null
              }
            }
          } else {
            // Status is RECEIVED but SMS array is empty - we need to check more aggressively
            console.log("Status is RECEIVED but SMS array is empty, continuing to check for SMS content")
            
            // Make sure we're checking with higher frequency
            if (smsCheckInterval.current) {
              // Already checking - but we'll adjust frequency
              clearInterval(smsCheckInterval.current as unknown as number)
              console.log("Adjusting interval to check more frequently")
              const moreFrequentInterval = setInterval(() => checkSms(Number(orderId)), 3000)
              smsCheckInterval.current = moreFrequentInterval as unknown as NodeJS.Timeout
            } else {
              // Not checking yet - start checking with high frequency
              console.log("Starting more frequent SMS checking")
              setIsCheckingSms(true)
              retryAttemptsRef.current = 0
              setRetryAttempts(0)
              // Start with immediate check followed by interval
              checkSms(Number(orderId))
              const moreFrequentInterval = setInterval(() => checkSms(Number(orderId)), 3000)
              smsCheckInterval.current = moreFrequentInterval as unknown as NodeJS.Timeout
            }
            
            // Notify user
            toast.info("Provider confirmed OTP sent! Waiting for content to be available...")
          }
          break;
      }
      
      // Update database status if user is available
      if (user) {
        try {
          await updateVirtualNumberStatus(
            user.id, 
            orderId, 
            currentStatus,
            currentStatus === "RECEIVED" && orderCheck.sms && orderCheck.sms.length > 0 
              ? orderCheck.sms[orderCheck.sms.length - 1].code 
              : undefined,
            currentStatus === "RECEIVED" && orderCheck.sms && orderCheck.sms.length > 0
              ? orderCheck.sms[orderCheck.sms.length - 1].text
              : undefined
          )
        } catch (dbError) {
          console.error("Error updating database during syncOrderStatus:", dbError)
          // Non-critical, UI is already updated
        }
      }
      
    } catch (error) {
      console.error("Error syncing order status:", error)
    }
  }

  useEffect(() => {
    if (orderId && isCheckingSms) {
      // Only start checking if we have an orderId and isCheckingSms is true
      // This makes the process more defensive
      if (!smsCheckInterval.current) {
        console.log("Starting SMS check from useEffect with orderId:", orderId);
        startCheckingSms(orderId);
      }
    } else if (!orderId && isCheckingSms) {
      // If we're supposed to be checking but have no orderId, log and stop
      console.log("Cannot start SMS checking - no orderId available");
      setIsCheckingSms(false);
    } else if (orderId && orderStatus === "RECEIVED" && !smsCode && !smsCheckInterval.current) {
      // Special case: if we have RECEIVED status but no SMS content, and not already checking
      // This handles cases where the status was updated but checking stopped for some reason
      console.log("Status is RECEIVED but no SMS content - resuming checking");
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
        
        console.log(`Resuming SMS checking for ${otpData.orderStatus} order: ${otpData.orderId}`);
        console.log(`SMS content available: ${Boolean(otpData.smsCode)}`);
        
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

    setIsLoading(true)
    setError(null)
    setNumber(null)
    setSmsCode(null)
    setIsCheckingSms(false)
    setIsOrderCancelled(false)
    setOrderStatus(null)
    setIsOrderFinished(false)
    setOtpTimeout(300) // 5 minutes timeout for no SMS
    setTimeLeft(300)
    setIsTimeoutActive(true)

    try {
      // Check if user can purchase
      const selectedOp = selectedOperator ? operators.find((op) => op.id === selectedOperator) : null
      const priceInINR = selectedOp ? convertToINR(selectedOp.cost) : 0

      const canPurchase = await canPurchaseNumber(user.id, priceInINR)
      if (!canPurchase) {
        throw new Error("Insufficient balance. Recharge now")
      }

      // Get virtual number - use 'auto' if no operator is selected
      const data = await getVirtualNumber(selectedCountry, selectedProduct, selectedOperator || "auto")

      if (data.error) {
        throw new Error(data.error)
      }

      // Verify we have phone and id
      if (!data.phone || !data.id) {
        throw new Error("Failed to get phone number")
      }

      console.log("Got virtual number:", { phone: data.phone, id: data.id })

      // Store orderId immediately for SMS checking to use
      const numericOrderId = Number(data.id);
      setOrderId(numericOrderId);

      // Create transaction record
      const transactionRes = await createVirtualNumberTransaction(
        user.id,
        priceInINR,
        data.id,
        data.phone,
        selectedProduct
      )

      // Store transaction reference for later use
      savedTransaction.current = { id: transactionRes.id }

      // Create OTP session
      await createOtpSession(
        user.id,
        data.id,
        data.phone,
        selectedProduct,
        transactionRes.id
      )

      // Set UI state
      setNumber({ phone: data.phone, id: data.id })
      setOrderCreatedAt(new Date())
      setOrderStatus("PENDING")
      
      // Persist the order data
      updateOtpData({
        orderId: data.id.toString(),
        phoneNumber: data.phone,
        orderStatus: "PENDING",
        createdAt: new Date().toISOString()
      })
      
      // Start checking for SMS - but only after setting orderId and other state
      console.log("Starting SMS check for order ID:", data.id);
      setIsCheckingSms(true)
      startCheckingSms(data.id)

      toast.success(`Virtual number purchased: ${data.phone}`, {
        description: "Waiting for SMS code...",
      })

      // After successful purchase, refresh wallet balance
      await refetchBalance()

      // Set timeout for the entire order (15 minutes)
      const timer = setTimeout(async () => {
        if (orderId && user) {
          try {
            await handleVirtualNumberRefund(user.id, transactionRes.id, "TIMEOUT")
            setOrderStatus("TIMEOUT")
            updateOtpData({ orderStatus: "TIMEOUT" })
            setIsCheckingSms(false)
            if (smsCheckInterval.current) {
              clearInterval(smsCheckInterval.current)
            }
            toast.error("Order timed out", {
              description: "The order has expired after 15 minutes. Your funds have been refunded.",
            })
          } catch (error) {
            console.error("Error handling timeout refund:", error)
            toast.error("Error processing refund", {
              description: "Please contact support if the issue persists.",
            })
          }
        }
      }, orderTimeout)

      setTimeoutTimer(timer)
    } catch (error: any) {
      console.error("Error getting virtual number:", error)
      setError(error.message || "An unexpected error occurred")
      // Add more specific error handling
      if (error.response?.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.")
      } else if (error.response?.status === 403) {
        toast.error("Access denied. Please check your authentication.")
      } else {
        toast.error(error.message || "An unexpected error occurred")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Update cancel handler to update OTP session
  const handleCancelOrder = async () => {
    setIsLoading(true);
    try {
      if (!orderId || !user) {
        setError("No order ID to cancel or user not found.");
        return;
      }
      
      console.log("Starting cancellation process for order:", orderId);
      
      // Check for transaction ID first
      const transactionId = savedTransaction.current?.id;
      console.log("Transaction ID from context:", transactionId);

      // Cancel order in 5sim first
      let data;
      let cancelSuccessful = false;
      try {
        data = await cancelOrder(orderId);
        if (data) {
          console.log("5sim cancel operation successful:", data);
          cancelSuccessful = true;
        } else {
          console.warn("Empty response when cancelling order in 5sim");
          toast.warning("Order cancellation sent but no confirmation received");
        }
      } catch (cancelError) {
        console.error("Error cancelling order in 5sim:", cancelError);
        toast.error("Could not cancel order in 5sim", {
          description: "Will still attempt to update status locally."
        });
        // Continue with refund process even if 5sim API fails
      }

      // Update UI state first, so even if database update fails, the UI reflects reality
      setNumber(null);
      setSmsCode(null);
      setIsCheckingSms(false);
      setIsOrderCancelled(true);
      setOrderStatus("CANCELED");
      setIsOtpVerified(false);
      setIsOrderFinished(false);

      // Process the refund to wallet
      let refundProcessed = false;
      
      // First try with the saved transaction ID
      if (savedTransaction.current?.id) {
        try {
          console.log("Processing refund with saved transaction ID:", savedTransaction.current.id);
          await handleVirtualNumberRefund(user.id, savedTransaction.current.id, "CANCELED");
          refundProcessed = true;
          toast.success(cancelSuccessful ? 
            "Order cancelled and balance refunded successfully" : 
            "Order marked as cancelled locally and balance refunded");
          
          // Refresh wallet balance to reflect the refund immediately
          await refetchBalance();
        } catch (refundError) {
          console.error("Error processing refund with saved transaction ID:", refundError);
          // Will try fallback method next
        }
      } else {
        console.warn("No transaction ID found in context for refund during cancellation");
      }
      
      // Fallback: Try to find the transaction by order ID if direct refund failed
      if (!refundProcessed) {
        try {
          console.log("Attempting fallback refund method with updateVirtualNumberStatus");
          // Use updateVirtualNumberStatus which will look up the transaction and handle the refund
          await updateVirtualNumberStatus(user.id, orderId.toString(), 'CANCELED');
          refundProcessed = true;
          toast.success(cancelSuccessful ? 
            "Order cancelled and balance refunded successfully" : 
            "Order marked as cancelled locally and balance refunded");
          
          // Refresh wallet balance again
          await refetchBalance();
        } catch (statusError) {
          console.error("Error updating status and processing refund:", statusError);
          toast.warning("Order cancelled. Refund may be delayed", {
            description: "Your balance will be updated shortly."
          });
        }
      }
      
      if (!refundProcessed) {
        console.warn("All refund methods failed, will need manual intervention");
        toast.warning("Order cancelled, but refund could not be processed", {
          description: "Please contact support for assistance with your refund."
        });
      }

      // Update status in database, but don't block the UI on this
      try {
        // Update the status in persisted data before clearing
        updateOtpData({
          orderStatus: "CANCELED"
        });
        
        await updateVirtualNumberStatus(user.id, orderId.toString(), 'CANCELED');
        // Clear persisted data
        clearOtpData();
      } catch (dbError) {
        console.error("Error updating database, but order was cancelled in 5sim:", dbError);
        // Still clear the OTP data
        clearOtpData();
      }
      
      // Reset UI state to allow new selection
      resetUIState();
    } catch (e: any) {
      console.error("Error cancelling order:", e);
      setError(e.message || "An unexpected error occurred.");
      toast.error("Error cancelling order", {
        description: e.message || "An unexpected error occurred."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanNumber = async () => {
    setIsLoading(true)
    try {
      if (!number?.id || !user) {
        setError("No number to ban")
        return
      }

      console.log("Starting ban process for order:", number.id);
      
      // Check for transaction ID first
      const transactionId = savedTransaction.current?.id;
      console.log("Transaction ID from context:", transactionId);
      
      // Attempt to ban the number in 5sim
      let data;
      try {
        data = await banOrder(Number(number.id))
        if (!data) {
          console.error("Empty response when banning number in 5sim");
          toast.warning("Ban request sent but no confirmation received");
        }
      } catch (banError) {
        console.error("Error banning number in 5sim:", banError);
        toast.error("Could not ban number in 5sim", {
          description: "Will still attempt to update status locally."
        });
        // Continue with refund process even if 5sim API fails
      }

      // Update UI state first
      setNumber(null)
      setSmsCode(null)
      setIsCheckingSms(false)
      setIsOrderCancelled(true)
      setOrderStatus("BANNED")
      setIsOtpVerified(false)
      setIsOrderFinished(true)
      
      // Process the refund to wallet
      let refundProcessed = false;
      
      // First try with the saved transaction ID
      if (savedTransaction.current?.id) {
        try {
          console.log("Processing refund with saved transaction ID:", savedTransaction.current.id);
          await handleVirtualNumberRefund(user.id, savedTransaction.current.id, "BANNED");
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
      }
      
      // Fallback: Try to find the transaction by order ID if direct refund failed
      if (!refundProcessed) {
        try {
          console.log("Attempting fallback refund method with updateVirtualNumberStatus");
          // Use updateVirtualNumberStatus which will look up the transaction and handle the refund
          await updateVirtualNumberStatus(user.id, number.id, 'BANNED')
          refundProcessed = true;
          toast.success("Number banned and balance refunded successfully");
          
          // Refresh wallet balance again
          await refetchBalance();
        } catch (statusError) {
          console.error("Error updating status and processing refund:", statusError);
          toast.warning("Number banned. Refund may be delayed", {
            description: "Your balance will be updated shortly."
          });
        }
      }
      
      if (!refundProcessed) {
        console.warn("All refund methods failed, will need manual intervention");
        toast.warning("Number banned, but refund could not be processed", {
          description: "Please contact support for assistance with your refund."
        });
      }
      
      // Update status in database, but don't block UI on this
      try {
        await updateVirtualNumberStatus(user.id, number.id, 'BANNED')
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
          await updateVirtualNumberStatus(user.id, orderId.toString(), orderCheck.status)
          // Clear persisted data
          clearOtpData()
        } catch (dbError) {
          console.error("Error updating database for already completed order:", dbError)
          // Still clear OTP data
          clearOtpData()
        }
        
        // Reset UI state after a short delay
        setTimeout(() => resetUIState(), 2000);
        
        return
      }

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
          await updateVirtualNumberStatus(user.id, orderId.toString(), 'FINISHED')
          // Clear persisted data
          clearOtpData()
        } catch (dbError) {
          console.error("Error updating database after finishing order:", dbError)
          // Still clear OTP data
          clearOtpData()
        }
        
        // Reset UI state after a short delay
        setTimeout(() => resetUIState(), 2000);
      } else {
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
            await updateVirtualNumberStatus(user.id, orderId.toString(), recheckedOrder.status)
            clearOtpData()
          } catch (dbError) {
            console.error("Error updating database for rechecked order:", dbError)
            clearOtpData()
          }
          
          // Reset UI state after a short delay
          setTimeout(() => resetUIState(), 2000);
        } else {
          setError("Failed to finish order. Please try again or refresh the page.")
          toast.error("Failed to finish order.")
          
          // Try to refresh the component state
          await refreshComponent()
        }
      }
    } catch (e: any) {
      console.error("Error finishing order:", e)
      
      // Special handling for common errors
      if (e.message && e.message.includes("already finished")) {
        toast.success("Order was already completed.")
        setOrderStatus("FINISHED")
        setIsOrderFinished(true)
        
        // Also update in the database
        try {
          if (user && orderId) {
            await updateVirtualNumberStatus(user.id, orderId.toString(), 'FINISHED')
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
        
        // Reset UI state after a short delay
        setTimeout(() => resetUIState(), 2000);
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReactivate = async () => {
    setIsReactivating(true)
    try {
      if (!orderId || !user) {
        setError("No order ID to reactivate")
        return
      }

      const data = await reactivateOrder(orderId)

      if (data) {
        // Update UI state first
        setOrderStatus("PENDING")
        setIsCheckingSms(true)
        setRetryAttempts(0)
        setIsOtpVerified(false)
        setIsOrderFinished(false)
        setIsOrderCancelled(false)
        setOrderCreatedAt(new Date())
        
        toast.success("Order reactivated successfully. Waiting for SMS...")
        
        // Start checking for SMS again
        startCheckingSms(orderId)
        
        // Update status in database
        try {
          await updateVirtualNumberStatus(user.id, orderId.toString(), 'PENDING')
        } catch (dbError) {
          console.error("Error updating database after reactivating order:", dbError)
          // This is not critical for functionality, so just log it
        }
      } else {
        setError("Failed to reactivate order")
        toast.error("Failed to reactivate order")
      }
    } catch (e: any) {
      console.error("Error reactivating order:", e)
      setError(e.message || "An unexpected error occurred")
      toast.error(e.message || "An unexpected error occurred")
    } finally {
      setIsReactivating(false)
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
    switch (status) {
      case "PENDING":
        return "secondary"
      case "RECEIVED":
        return "default"
      case "CANCELED":
        return "outline"
      case "TIMEOUT":
        return "destructive"
      case "FINISHED":
        return "secondary"
      case "BANNED":
        return "destructive"
      default:
        return "outline"
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
    // Safety check for orderIdToUse at the beginning
    if (!orderIdToUse) {
      console.error("Lost orderIdToUse during SMS check");
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current as unknown as number);
        smsCheckInterval.current = null;
        setIsCheckingSms(false);
      }
      return;
    }

    retryAttemptsRef.current += 1;
    // Update state for UI display
    setRetryAttempts(retryAttemptsRef.current);
    
    try {
      console.log(`[${retryAttemptsRef.current}] Checking SMS for order ${orderIdToUse}`);
      const response = await getSmsCode(orderIdToUse.toString());
      console.log("API response:", response);
      
      if (!response) {
        console.log("No response from API, continuing to check...");
        return;
      }
      
      // Update order status based on response
      if (response.status) {
        setOrderStatus(response.status as OrderStatus);
        
        // Stop checking if order is cancelled or banned
        if (response.status === "CANCELED") {
          setIsOrderCancelled(true);
          setIsCheckingSms(false);
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current as unknown as number);
            smsCheckInterval.current = null;
          }
          
          toast.info("Order was cancelled");
          
          // Update local storage
          updateOtpData({
            orderStatus: "CANCELED"
          });
          
          // Update database status - but don't stop on error
          if (user) {
            try {
              await updateVirtualNumberStatus(
                user.id, 
                orderIdToUse.toString(), 
                "CANCELED"
              );
            } catch (dbError) {
              console.error("Error updating database after cancel:", dbError);
              // Continue execution - non-critical database error
            }
          }
          
          return;
        }
        
        if (response.status === "BANNED") {
          setIsOrderCancelled(true);
          setIsCheckingSms(false);
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current as unknown as number);
            smsCheckInterval.current = null;
          }
          
          toast.error("Number was banned");
          
          // Update local storage
          updateOtpData({
            orderStatus: "BANNED"
          });
          
          // Update database status - but don't stop on error
          if (user) {
            try {
              await updateVirtualNumberStatus(
                user.id, 
                orderIdToUse.toString(), 
                "BANNED"
              );
            } catch (dbError) {
              console.error("Error updating database after ban:", dbError);
              // Continue execution - non-critical database error
            }
          }
          
          return;
        }
      }
      
      // Check if SMS found
      if (response.sms && response.sms.length > 0) {
        const sms = response.sms[0];
        console.log("SMS found:", sms);
        
        setSmsCode(sms.code);
        setFullSms(sms.text);
        setOrderStatus("RECEIVED");
        setIsCheckingSms(false);
        
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number);
          smsCheckInterval.current = null;
        }
        
        toast.success("SMS Code Found!", {
          description: `Your verification code is: ${sms.code}`,
        });
        
        // Update local storage
        updateOtpData({
          smsCode: sms.code,
          fullSms: sms.text,
          orderStatus: "RECEIVED"
        });
        
        // Update database status - don't stop on error
        if (user) {
          try {
            await updateVirtualNumberStatus(
              user.id, 
              orderIdToUse.toString(), 
              "RECEIVED", 
              sms.code, 
              sms.text
            );
          } catch (dbError) {
            console.error("Error updating database after SMS received:", dbError);
            // Still consider the SMS received for UI purposes
          }
          
          // Mark transaction as successful - don't stop on error
          if (savedTransaction.current?.id) {
            try {
              // The balance was already deducted during purchase, this just confirms the transaction as COMPLETED
              console.log("Finalizing transaction for SMS received:", {
                transactionId: savedTransaction.current.id,
                orderId: orderIdToUse.toString()
              });
              
              await handleSuccessfulOTP(user.id, savedTransaction.current.id, orderIdToUse.toString());
              
              // Refresh wallet balance to ensure UI is updated
              await refetchBalance();
            } catch (otpError) {
              console.error("Error marking transaction as successful:", otpError);
              // Non-critical for UI
            }
          }
        }
      } else if (response.status === "RECEIVED") {
        // Status is RECEIVED but SMS array is empty - continue checking with higher frequency
        console.log("Status is RECEIVED but SMS array is empty, continuing to check more aggressively...");
        
        // Update UI to show RECEIVED status
        setOrderStatus("RECEIVED");
        
        // Update localStorage to reflect RECEIVED status
        updateOtpData({
          orderStatus: "RECEIVED"
        });
        
        // Adjust check interval to check more frequently (every 3 seconds)
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number);
          const moreFrequentInterval = setInterval(() => checkSms(orderIdToUse), 3000); // Check every 3 seconds
          smsCheckInterval.current = moreFrequentInterval as unknown as NodeJS.Timeout;
        }
        
        // Only show toast notification periodically to avoid spamming
        if (retryAttemptsRef.current % 3 === 0) {
          toast.info("Provider confirmed OTP sent! Waiting for content...", {
            description: "The system is actively checking for your verification code"
          });
        }
        
        // Update database status, but don't set smsCode or fullSms yet
        // And don't stop execution on database error
        if (user) {
          try {
            await updateVirtualNumberStatus(
              user.id, 
              orderIdToUse.toString(), 
              "RECEIVED"
            );
          } catch (dbError) {
            console.error("Error updating database to RECEIVED status:", dbError);
            // Continue checking - database error is non-critical for this flow
          }
        }
        
        // Don't limit retries when status is RECEIVED - keep trying until we get the SMS
        // Reset counter to avoid hitting maximum retries
        retryAttemptsRef.current = Math.min(retryAttemptsRef.current, 10);
      }
      
      // Check if we've exceeded max retries and status isn't RECEIVED
      // (If status is RECEIVED we keep checking regardless of retry count)
      if (retryAttemptsRef.current > 60 && response.status !== "RECEIVED") {
        console.log("Max retry attempts reached");
        setIsCheckingSms(false);
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number);
          smsCheckInterval.current = null;
        }
        toast.error("No SMS received after multiple attempts", {
          description: "Please try again or contact support if the issue persists"
        });
      }
    } catch (error) {
      console.error("Error checking SMS:", error);
      
      // Don't stop checking on error, but log it
      if (retryAttemptsRef.current > 60) {
        console.log("Max retry attempts reached after errors");
        setIsCheckingSms(false);
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current as unknown as number);
          smsCheckInterval.current = null;
        }
        toast.error("Error checking SMS after multiple attempts", {
          description: "Please try again or contact support if the issue persists"
        });
      }
    }
  };

  // Now define startCheckingSms to use the checkSms function
  const startCheckingSms = (initialOrderId?: number | string) => {
    // Use the provided initialOrderId, or fall back to the orderId from state
    const orderIdToUse = initialOrderId ? Number(initialOrderId) : orderId;
    
    if (!orderIdToUse) {
      console.error("Cannot start SMS check - no orderId available");
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
    
    console.log(`Starting SMS check for order ${orderIdToUse} with interval ${checkInterval}ms`);
    
    // Run checkSms immediately before setting interval
    checkSms(orderIdToUse);
    
    // Set interval with appropriate frequency
    const intervalId = setInterval(() => checkSms(orderIdToUse), checkInterval);
    smsCheckInterval.current = intervalId as unknown as NodeJS.Timeout;
  };

  // Add a manual SMS check function
  const manualSmsCheck = async () => {
    if (!orderId) {
      toast.error("No order ID available");
      return;
    }
    
    setIsLoading(true);
    try {
      // Use our existing checkSms function to perform the check
      await checkSms(orderId);
      
      // If after the check we still don't have SMS content, but status is RECEIVED
      if (!smsCode && orderStatus === "RECEIVED") {
        toast.info("Status is RECEIVED but no SMS content is available yet. Will keep checking.");
        
        // Make sure we're still checking for SMS
        if (!isCheckingSms) {
          setIsCheckingSms(true);
          startCheckingSms(orderId);
        }
      }
    } catch (error) {
      console.error("Error in manual SMS check:", error);
      toast.error("Failed to check SMS manually");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto overflow-hidden">
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
                        <span className="truncate">
                          {(() => {
                            const country = countries.find((c) => c.code === selectedCountry);
                            return country ? 
                              country.name.charAt(0).toUpperCase() + country.name.slice(1).toLowerCase() :
                              selectedCountry;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select country</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command className="w-full">
                    <CommandInput
                      placeholder="Search countries..."
                      value={countrySearchQuery}
                      onValueChange={setCountrySearchQuery}
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No countries found</CommandEmpty>
                      <CommandGroup className="max-h-[40vh] overflow-auto">
                        {Array.isArray(filteredCountries) &&
                          filteredCountries.map((country) => (
                            <CommandItem
                              key={country.code}
                              value={country.code}
                              onSelect={() => {
                                handleCountryChange(country.code)
                                setCountryOpen(false)
                              }}
                              className="flex items-center justify-between py-2 text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Check
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    selectedCountry === country.prefix ? "opacity-100" : "opacity-0",
                                  )}
                                />
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
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search services..."
                      value={serviceSearchQuery}
                      onValueChange={setServiceSearchQuery}
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No service found.</CommandEmpty>
                      <CommandGroup className="max-h-[40vh] overflow-auto">
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
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command className="w-full">
                    <CommandInput className="w-full text-sm" placeholder="Search providers..." />
                    <CommandList className="w-full">
                      <CommandEmpty>No provider found.</CommandEmpty>
                      <CommandGroup className="max-h-[40vh] overflow-auto">
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
          {/* Get Number Button */}
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

          {/* Display Number Information */}
          {isLoading ? (
            <NumberDisplaySkeleton />
          ) : (
            number && (
              <Card className="mt-4 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-lg border gap-3 md:gap-0 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base md:text-lg break-all">{number.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={refreshComponent}
                              disabled={isLoading}
                              className="h-9 w-9"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>Refresh order status</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                        className="h-9 w-9"
                      >
                        {isNumberCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
              
                  {/* Order Details */}
                  {orderCreatedAt && (
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-lg border gap-3 md:gap-4 bg-muted/10">
                      <div className="grid grid-cols-2 md:flex md:items-center gap-3 md:gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Order ID</p>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs md:text-sm">{orderId}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyToClipboard(String(orderId), setIsOrderIdCopied)}
                              className="h-6 w-6"
                            >
                              {isOrderIdCopied ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="font-mono text-xs md:text-sm">
                            {new Date(orderCreatedAt).toLocaleTimeString()}
                          </p>
                        </div>
                        
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge variant={getStatusColor(orderStatus)}>{orderStatus}</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}

          {/* Waiting for OTP */}
          {(isCheckingSms || isRetrying) && !smsCode && (
            <Card className="shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {isRetrying ? `Checking for SMS (${retryAttempts + 1}/${maxRetryAttempts})` : "Waiting for OTP..."}
                  </span>
                </div>
                {isTimeoutActive && timeLeft !== null && otpTimeout !== null && (
                  <div className="space-y-2">
                    <Progress value={((otpTimeout - timeLeft) / otpTimeout) * 100} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      Expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Display SMS Code */}
          {smsCode && (
            <Card className="shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between rounded-md border p-3 md:p-4 gap-3 md:gap-0 bg-muted/10">
                  <div className="flex-grow flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-medium">
                      OTP Code
                    </Badge>
                    <span className="text-lg md:text-xl font-medium tracking-wider">{smsCode}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(smsCode, setIsSmsCodeCopied)}
                    className="self-end md:self-auto"
                  >
                    <div className="flex items-center gap-1">
                      {isSmsCodeCopied ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card className="bg-destructive">
              <CardContent className="flex items-center gap-2 p-2 sm:p-3">
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <p className="text-xs sm:text-sm break-words">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {number && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleBanNumber}
                      disabled={isLoading || isOrderCancelled || isOrderFinished}
                      className="w-full h-10 text-sm"
                    >
                      {isLoading ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Ban className="h-4 w-4" />
                          <span>Ban Number</span>
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
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
                      className="w-full h-10 text-sm"
                    >
                      {isLoading ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <XCircle className="h-4 w-4" />
                          <span>Cancel Order</span>
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Cancel this order</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Finish button in the third column */}
              {isOrderFinished ? (
                <Button 
                  variant="outline" 
                  disabled 
                  className="w-full h-10 text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <CircleCheck className="h-4 w-4" />
                    <span>Order Completed</span>
                  </div>
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={handleFinishOrder}
                  disabled={isLoading || isOrderCancelled || isOrderFinished}
                  className="w-full h-10 text-sm"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4" />
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default GetVirtualNumber

