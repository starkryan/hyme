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
  cleanupStuckTransactions,
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
import type { Command as CommandPrimitive } from "cmdk"

interface SmsMessage {
  created_at: string
  date: string
  sender: string
  text: string
  code: string
}

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

interface ServiceProduct {
  id: string
  displayName: string
  price: number
}

type OrderStatus = "PENDING" | "RECEIVED" | "CANCELED" | "TIMEOUT" | "FINISHED" | "BANNED"

const RUB_TO_INR_RATE = 0.99 // Current approximate rate for RUB to INR conversion

const successVariant = "secondary" // Replace "success" with "secondary"
const warningVariant = "outline" // Replace "warning" with "outline"

interface Country {
  code: string
  name: string
  iso: string
  prefix: string
}

interface VirtualNumberResponse {
  phone?: string
  id?: string
  created_at?: string
  error?: string
  status?: string
  sms?: SmsMessage[]
}

const GetVirtualNumber = () => {
  const { user } = useUser()
  const { otpData, updateOtpData, clearOtpData } = useOtpPersist("virtual-number-otp")
  const [walletBalance, setWalletBalance] = useState<number>(0)
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
  const smsCheckInterval = useRef<number | null>(null)
  const [isOrderCancelled, setIsOrderCancelled] = useState(false)
  const [fullSms, setFullSms] = useState<string | null>(null)
  const [isNumberCopied, setIsNumberCopied] = useState(false)
  const [isOtpCopied, setIsOtpCopied] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [isOtpVerified, setIsOtpVerified] = useState(true)
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null)
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
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  const convertToINR = (rubPrice: number): number => {
    return Math.ceil(rubPrice * RUB_TO_INR_RATE)
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
    let intervalId: NodeJS.Timeout;
    let isSubscribed = true;

    const fetchBalance = async () => {
      if (!user) return;
      try {
        const balance = await getWalletBalance(user.id);
        if (isSubscribed) {
          setWalletBalance(balance);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        // Don't show error toast for background updates
      }
    };

    if (user) {
      fetchBalance();
      intervalId = setInterval(fetchBalance, 30000);
    }

    return () => {
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

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
          setOrderCreatedAt(session.created_at)

          // If session is PENDING, restart SMS checking
          if (session.status === "PENDING") {
            setIsCheckingSms(true)
          }
        }
      } catch (error) {
        console.error("Error loading active session:", error)
      }
    }

    loadActiveSession()
  }, [user])

  useEffect(() => {
    if (number?.id && isCheckingSms) {
      if (smsCheckInterval.current) {
        clearInterval(smsCheckInterval.current)
      }

      const checkSms = async () => {
        try {
          console.log("Checking SMS for order:", number.id, "Attempt:", retryAttempts + 1)
          const response = await getSmsCode(number.id)

          console.log("SMS check response:", response)

          if (response?.status === "CANCELED" || response?.status === "BANNED") {
            clearInterval(smsCheckInterval.current!)
            setIsCheckingSms(false)
            setOrderStatus(response.status)

            // Update session status in database
            const session = await getActiveOtpSession(user!.id)
            if (session) {
              await updateOtpSession(session.id, { status: response.status })
            }

            return
          }

          // Only increment retry attempts if we got a valid response
          if (response) {
            setRetryAttempts((prev) => prev + 1)
          }

          if (response?.sms && response.sms.length > 0) {
            const sms = response.sms[0]
            setSmsCode(sms.code)
            setFullSms(sms.text)
            setOrderStatus("RECEIVED")

            // Update session in database with SMS code
            const session = await getActiveOtpSession(user!.id)
            if (session) {
              await updateOtpSession(session.id, {
                sms_code: sms.code,
                full_sms: sms.text,
                status: "RECEIVED",
              })
            }

            clearInterval(smsCheckInterval.current!)
            setIsCheckingSms(false)

            // Process payment on successful OTP receipt
            if (user && orderId && session && number) {
              await handleSuccessfulOTP(user.id, session.transaction_id, number.id)
            }

            toast.success("SMS Code Received!", {
              description: `Code: ${sms.code}`,
            })
          }
        } catch (error: any) {
          console.error("Error checking SMS:", error)
          // Don't increment retry attempts on error
          toast.error("Failed to check SMS status", {
            description: error.message || "Will retry automatically...",
          })
        }
      }

      checkSms()
      smsCheckInterval.current = window.setInterval(checkSms, retryInterval)

      return () => {
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current)
        }
      }
    }
  }, [number?.id, isCheckingSms, user, orderId, retryInterval, number, retryAttempts])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isTimeoutActive && timeLeft !== null && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) => {
          if (prevTimeLeft === null) return null
          if (prevTimeLeft <= 1) {
            clearInterval(intervalId!)
            setIsTimeoutActive(false)
            setSmsCode(null)
            setFullSms(null)
            toast.error("OTP timed out", {
              description: "Please request a new OTP.",
            })
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
        throw new Error("Cannot purchase number. Please ensure you have sufficient balance and no pending orders.")
      }

      // Clean up any stuck transactions first
      await cleanupStuckTransactions(user.id)

      // Get virtual number - use 'auto' if no operator is selected
      const data = await getVirtualNumber(selectedCountry, selectedProduct, selectedOperator || "auto")

      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.phone || !data.id) {
        throw new Error("Failed to get virtual number - invalid response")
      }

      // Create pending transaction
      const transaction = await createVirtualNumberTransaction(
        user.id,
        priceInINR,
        data.id,
        data.phone,
        selectedProduct,
      )

      if (!transaction) {
        throw new Error("Failed to create transaction")
      }

      // Create OTP session in database
      await createOtpSession(user.id, data.id, data.phone, selectedProduct, transaction.id)

      // Update persisted data
      updateOtpData({
        phoneNumber: data.phone,
        orderId: data.id,
        orderStatus: "PENDING",
        createdAt: data.created_at ?? new Date().toISOString(),
      })

      setNumber({ phone: data.phone, id: data.id })
      setOrderId(Number(data.id))
      setOrderCreatedAt(data.created_at ?? null)
      setOrderStatus("PENDING")
      setIsCheckingSms(true)

      // After successful purchase, refresh wallet balance
      const newBalance = await getWalletBalance(user.id);
      setWalletBalance(newBalance);

      toast.success("Virtual number received!", {
        description: `Your number is: ${data.phone}`,
      })

      // Set timeout for the entire order (15 minutes)
      const timer = setTimeout(async () => {
        if (orderId && user) {
          try {
            await handleVirtualNumberRefund(user.id, transaction.id, "TIMEOUT")
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

      // Start checking for SMS
      if (data.id) {
        const intervalId = window.setInterval(async () => {
          try {
            if (retryAttempts >= maxRetryAttempts) {
              clearInterval(intervalId)
              setIsCheckingSms(false)
              await handleVirtualNumberRefund(user.id, transaction.id, "TIMEOUT")
              setOrderStatus("TIMEOUT")
              updateOtpData({ orderStatus: "TIMEOUT" })
              toast.error("No SMS received", {
                description: "No SMS was received within 5 minutes. Your funds have been refunded.",
              })
              return
            }

            // Ensure data.id is not undefined before calling getSmsCode
            if (!data.id) {
              console.error("Order ID is missing")
              return
            }

            const response = await getSmsCode(data.id)

            if (!response) {
              console.error("No response from SMS check")
              return
            }

            console.log("SMS check response:", response)

            if (response.sms && response.sms.length > 0) {
              const sms = response.sms[0]
              await handleSuccessfulOTP(user.id, transaction.id, data.id)
              setSmsCode(sms.code)
              setFullSms(sms.text)
              setIsCheckingSms(false)
              clearInterval(intervalId)

              // Update session with SMS code and persist data
              const session = await getActiveOtpSession(user.id)
              if (session) {
                await updateOtpSession(session.id, {
                  sms_code: sms.code,
                  full_sms: sms.text,
                  status: "RECEIVED",
                })

                updateOtpData({
                  smsCode: sms.code,
                  fullSms: sms.text,
                  orderStatus: "RECEIVED",
                })
              }

              toast.success("SMS received!", {
                description: `Your OTP code is: ${sms.code}`,
              })
            }

            setRetryAttempts((prev) => prev + 1)
          } catch (error) {
            console.error("Error checking SMS:", error)
          }
        }, retryInterval)

        smsCheckInterval.current = intervalId
      }
    } catch (error: any) {
      console.error("Error getting virtual number:", error)
      setError(error.message)
      toast.error("Error", {
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Update cancel handler to update OTP session
  const handleCancelOrder = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!orderId) {
        setError("No order ID to cancel.")
        toast.error("No order ID to cancel.")
        return
      }

      const data = await cancelOrder(orderId)

      if (data) {
        if (user) {
          const session = await getActiveOtpSession(user.id)
          if (session) {
            await Promise.all([
              handleVirtualNumberRefund(user.id, session.transaction_id, "CANCELED"),
              updateOtpSession(session.id, { status: "CANCELED" }),
            ])

            // Refresh wallet balance after refund
            const newBalance = await getWalletBalance(user.id);
            setWalletBalance(newBalance);
          }
        }

        // Update persisted data
        updateOtpData({
          orderStatus: "CANCELED",
        })

        toast.success("Order cancelled successfully and refund initiated.")
        setNumber(null)
        setSmsCode(null)
        setIsCheckingSms(false)
        setIsOrderCancelled(true)
        setOrderStatus("CANCELED")
        setIsOrderFinished(true)

        // Clear timers
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          setTimeoutTimer(null)
        }
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current)
          smsCheckInterval.current = null
        }
      } else {
        setError("Failed to cancel order.")
        toast.error("Failed to cancel order.")
      }
    } catch (e: any) {
      console.error("Error cancelling order:", e)
      setError(e.message || "An unexpected error occurred.")
      toast.error(e.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBanNumber = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!number?.id) {
        setError("No number ID to ban.")
        toast.error("No number ID to ban.")
        return
      }

      const data = await banOrder(Number(number.id))
      console.log("Ban number response:", data)

      if (data) {
        // Clear persisted data
        clearOtpData()
        toast.success("Number banned successfully. This number cannot be used again.")
        
        // Refresh wallet balance if there was a refund
        if (user) {
          const newBalance = await getWalletBalance(user.id);
          setWalletBalance(newBalance);
        }
        setNumber(null)
        setSmsCode(null)
        setIsCheckingSms(false)
        setIsOrderCancelled(true)
        setOrderStatus("BANNED")
        setIsOtpVerified(false)
        setIsOrderFinished(true)
      } else {
        setError("Failed to ban number.")
        toast.error("Failed to ban number.")
      }
    } catch (e: any) {
      console.error("Error banning number:", e)
      setError(e.message || "An unexpected error occurred.")
      toast.error(e.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinishOrder = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!orderId || !user) {
        setError("No order ID to finish or user not found.")
        toast.error("No order ID to finish or user not found.")
        return
      }

      // Get active session
      const session = await getActiveOtpSession(user.id)
      if (!session) {
        throw new Error("No active OTP session found")
      }

      // First verify the order status in 5sim
      const checkResponse = await getSmsCode(orderId.toString())
      if (!checkResponse) {
        throw new Error("Failed to verify order status")
      }

      // Check if order is already finished or cancelled
      if (checkResponse.status === "FINISHED") {
        toast.error("Order is already finished")
        return
      }

      if (checkResponse.status === "CANCELED" || checkResponse.status === "BANNED") {
        // Clean up local state and database since order is already cancelled in 5sim
        await deleteOtpSession(session.id)
        clearOtpData()

        setNumber(null)
        setSmsCode(null)
        setFullSms(null)
        setIsCheckingSms(false)
        setIsOrderCancelled(true)
        setOrderStatus(checkResponse.status)
        setIsOrderFinished(true)
        setSelectedCountry("")
        setSelectedProduct("")
        setSelectedOperator("")
        setSelectedOperatorDetails(null)
        setOrderId(null)
        setOrderCreatedAt(null)
        setRetryAttempts(0)

        // Clear any remaining timers
        if (timeoutTimer) {
          clearTimeout(timeoutTimer)
          setTimeoutTimer(null)
        }
        if (smsCheckInterval.current) {
          clearInterval(smsCheckInterval.current)
          smsCheckInterval.current = null
        }

        toast.error(`Order was already ${checkResponse.status.toLowerCase()} in 5sim`)
        return
      }

      // Try to finish the order in 5sim
      const data = await finishOrder(orderId)
      if (!data) {
        throw new Error("Failed to finish order in 5sim")
      }

      // Add a delay and retry mechanism for verification
      let verificationAttempts = 0
      const maxVerificationAttempts = 3
      const verificationDelay = 2000 // 2 seconds

      while (verificationAttempts < maxVerificationAttempts) {
        await new Promise((resolve) => setTimeout(resolve, verificationDelay))

        const verifyResponse = await getSmsCode(orderId.toString())
        if (verifyResponse && verifyResponse.status === "FINISHED") {
          // Delete the OTP session since it's complete
          await deleteOtpSession(session.id)

          // Update wallet balance
          const newBalance = await getWalletBalance(user.id)
          setWalletBalance(newBalance)

          // Clear all persisted data
          clearOtpData()
          toast.success("Order finished successfully.")

          // Reset all state
          setNumber(null)
          setSmsCode(null)
          setFullSms(null)
          setIsCheckingSms(false)
          setIsOrderCancelled(true)
          setOrderStatus("FINISHED")
          setIsOrderFinished(true)
          setSelectedCountry("")
          setSelectedProduct("")
          setSelectedOperator("")
          setSelectedOperatorDetails(null)
          setOrderId(null)
          setOrderCreatedAt(null)
          setRetryAttempts(0)

          // Clear any remaining timers
          if (timeoutTimer) {
            clearTimeout(timeoutTimer)
            setTimeoutTimer(null)
          }
          if (smsCheckInterval.current) {
            clearInterval(smsCheckInterval.current)
            smsCheckInterval.current = null
          }

          return
        }
        verificationAttempts++
      }

      throw new Error("Order completion could not be verified after multiple attempts")
    } catch (e: any) {
      console.error("Error finishing order:", e)
      // Check if the error is due to the order being already cancelled
      if (e.response?.status === 400) {
        toast.error("Cannot finish order - it may have been cancelled or expired")
        // Clean up the local state and database
        if (user) {
          const session = await getActiveOtpSession(user.id)
          if (session) {
            await deleteOtpSession(session.id)
          }
        }
        clearOtpData()
        setOrderStatus("CANCELED")
        setIsOrderFinished(true)
      } else {
        setError(e.message || "An unexpected error occurred.")
        toast.error(e.message || "An unexpected error occurred.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!orderId) return

    setIsReactivating(true)
    try {
      const response = await reactivateOrder(orderId)
      if (response) {
        toast.success("Order reactivated successfully")
        setOrderStatus("PENDING")
        setIsCheckingSms(true)
        setIsTimeoutActive(true)
        setTimeLeft(300)
        setOtpTimeout(300)
      }
    } catch (error: any) {
      console.error("Error reactivating order:", error)
      toast.error("Failed to reactivate order")
      setError(error.message)
    } finally {
      setIsReactivating(false)
    }
  }

  const handleCopyToClipboard = (text: string, setState: (value: boolean) => void) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setState(true)
        toast.success("Copied to clipboard!", {
          className: "bg-green-500 text-white",
        })
        setTimeout(() => setState(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
        toast.error("Failed to copy text.")
      })
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

  const handleCountrySearch = React.useCallback(
    (value: string) => {
      setCountrySearchQuery(value)
      if (!value || !Array.isArray(countries)) {
        setFilteredCountries(countries)
        return
      }

      const searchTerm = value.toLowerCase().trim()
      const filtered = countries.filter(
        (country) =>
          country.name.toLowerCase().includes(searchTerm) ||
          country.code.toLowerCase().includes(searchTerm) ||
          (country.prefix && country.prefix.includes(searchTerm)),
      )
      setFilteredCountries(filtered)
    },
    [countries],
  )

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

  const handleCleanupTransactions = async () => {
    if (!user) return

    setIsCleaningUp(true)
    try {
      await cleanupStuckTransactions(user.id)
      toast.success("Successfully cleaned up pending transactions")
      
      // Refresh wallet balance after cleanup
      const newBalance = await getWalletBalance(user.id);
      setWalletBalance(newBalance);
    } catch (error: any) {
      console.error("Error cleaning up transactions:", error)
      toast.error("Failed to clean up transactions", {
        description: error.message,
      })
    } finally {
      setIsCleaningUp(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="sticky top-0 bg-background z-10 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-2xl font-bold">Virtual Number Service</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              <Wallet className="w-4 h-4 mr-1" />₹{walletBalance.toFixed(2)}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleCleanupTransactions} disabled={isCleaningUp}>
              {isCleaningUp ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span className="hidden sm:inline">Cleaning up...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Clean Up Pending</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 sm:p-6">
        {/* Selection Section */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="w-full justify-between"
                  disabled={isCountryLoading}
                >
                  {isCountryLoading ? (
                    <Spinner className="h-4 w-4" />
                  ) : selectedCountry ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">
                        {countries.find((country) => country.code === selectedCountry)?.name}
                      </span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {countries.find((country) => country.code === selectedCountry)?.code}
                      </Badge>
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
                  />
                  <CommandList>
                    <CommandEmpty>No countries found</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {Array.isArray(filteredCountries) &&
                        filteredCountries.map((country) => (
                          <CommandItem
                            key={country.code}
                            value={country.code}
                            onSelect={() => {
                              handleCountryChange(country.code)
                              setCountryOpen(false)
                            }}
                            className="flex items-center justify-between py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  selectedCountry === country.code ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="truncate capitalize">{country.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {country.code}
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
                        {products.find((p) => p.id === selectedProduct)?.name.replace(/_/g, " ")}
                      </span>
                      <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap">
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
                  />
                  <CommandList>
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => {
                            setSelectedProduct(product.id === selectedProduct ? "" : product.id)
                            setProductOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center gap-2">
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  selectedProduct === product.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="capitalize">{product.name.replace(/_/g, " ")}</span>
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
                  className="w-full justify-between"
                  disabled={!selectedProduct || operators.length === 0}
                >
                  {!selectedProduct ? (
                    "Select service first"
                  ) : operators.length === 0 ? (
                    <Spinner className="h-4 w-4" />
                  ) : selectedOperatorDetails ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="capitalize truncate">{selectedOperatorDetails.displayName}</span>
                      <div className="flex items-center gap-2 shrink-0">
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
                <Command>
                  <CommandInput placeholder="Search providers..." />
                  <CommandList>
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {operators.map((operator) => (
                        <CommandItem
                          key={operator.id}
                          value={operator.id}
                          onSelect={() => {
                            setSelectedOperator(operator.id === selectedOperator ? "" : operator.id)
                            setOperatorOpen(false)
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedOperator === operator.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="capitalize truncate">{operator.displayName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
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

        <Separator />

        {/* Action Section */}
        <div className="space-y-4">
          {/* Get Number Button */}
          <Button
            onClick={handleGetNumber}
            disabled={isLoading || isOrderCancelled || !selectedOperator}
            className="w-full sm:w-auto"
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
                  <Badge variant="secondary" className="ml-2">
                    ₹{convertToINR(selectedOperatorDetails.cost)}
                  </Badge>
                )}
              </div>
            )}
          </Button>

          {/* Display Number Information */}
          {number && (
            <Card className="mt-4">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono text-xs">{selectedCountry}</Badge>
                    <span className="font-mono text-base">{number.phone}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                  >
                    {isNumberCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center justify-center p-2 rounded-md border">
                    <span className="text-xs text-muted-foreground">Order ID</span>
                    <span className="font-medium text-sm truncate">{number.id}</span>
                  </div>
                  {orderCreatedAt && (
                    <div className="flex flex-col items-center justify-center p-2 rounded-md border">
                      <span className="text-xs text-muted-foreground">Time</span>
                      <span className="font-medium text-sm truncate">
                        {new Date(orderCreatedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {orderStatus && (
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant={getStatusColor(orderStatus)}>{orderStatus}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Waiting for OTP */}
          {(isCheckingSms || isRetrying) && !smsCode && (
            <Card>
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
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex-grow flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-medium">
                      OTP Code
                    </Badge>
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
                  <div className="rounded-md border p-3">
                    <Badge variant="outline" className="text-xs mb-2">
                      Full Message
                    </Badge>
                    <p className="text-sm text-muted-foreground">{fullSms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card variant="destructive">
              <CardContent className="flex items-center gap-2 p-3">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {number && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <Spinner className="h-4 w-4" />
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
                        <Spinner className="h-4 w-4" />
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
          {orderStatus === "TIMEOUT" && !isOrderFinished && (
            <Button variant="outline" onClick={handleReactivate} disabled={isReactivating} className="w-full">
              {isReactivating ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-4 w-4" />
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
      </CardContent>
    </Card>
  )
}

export default GetVirtualNumber

