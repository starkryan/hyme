"use client"

import { type JSX, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, PlusCircle, Clock, Hash, Phone } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"

// Define OrderStatus type
export type OrderStatus = "PENDING" | "RECEIVED" | "CANCELED" | "TIMEOUT" | "FINISHED" | "BANNED"

// Define the props interface for the component
interface ReceivedNumberViewProps {
  number: { phone: string; id: string } | null
  orderId: number | null
  orderStatus: OrderStatus | null
  orderCreatedAt: Date | null
  smsCode: string | null
  fullSms: string | null
  isLoading: boolean
  isOrderCancelled: boolean
  isOrderFinished: boolean
  isNumberCopied: boolean
  isOrderIdCopied: boolean
  isSmsCodeCopied: boolean
  isOtpCopied: boolean
  isRetrying: boolean
  isCheckingSms: boolean
  retryAttempts: number
  maxRetryAttempts: number
  timeLeft: number | null
  otpTimeout: number | null
  isTimeoutActive: boolean
  handleBanNumber: () => Promise<void>
  handleCancelOrder: () => Promise<void>
  handleFinishOrder: () => Promise<void>
  handleCopyToClipboard: (text: string, setState: (value: boolean) => void) => Promise<void>
  setIsNumberCopied: (value: boolean) => void
  setIsOrderIdCopied: (value: boolean) => void
  setIsSmsCodeCopied: (value: boolean) => void
  setIsOtpCopied: (value: boolean) => void
  refreshComponent: () => Promise<void>
  getStatusColor: (status: OrderStatus | null) => "default" | "secondary" | "destructive" | "outline"
  error: string | null
  NumberDisplaySkeleton: () => JSX.Element
  resetUIState?: () => Promise<void>
  productName?: string
}

export function ReceivedNumberView({
  number,
  orderId,
  orderStatus,
  orderCreatedAt,
  smsCode,
  fullSms,
  isLoading,
  isOrderCancelled,
  isOrderFinished,
  isNumberCopied,
  isOrderIdCopied,
  isSmsCodeCopied,
  isOtpCopied,
  isRetrying,
  isCheckingSms,
  retryAttempts,
  maxRetryAttempts,
  handleBanNumber,
  handleCancelOrder,
  handleFinishOrder,
  handleCopyToClipboard,
  setIsNumberCopied,
  setIsOrderIdCopied,
  setIsSmsCodeCopied,
  setIsOtpCopied,
  refreshComponent,
  getStatusColor,
  error,
  NumberDisplaySkeleton,
  resetUIState,
  productName,
}: ReceivedNumberViewProps): JSX.Element {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isBanning, setIsBanning] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isOrderBanned, setIsOrderBanned] = useState(orderStatus === "BANNED")

  // Update isOrderBanned when orderStatus changes
  useEffect(() => {
    if (orderStatus === "BANNED") {
      setIsOrderBanned(true)
    }
  }, [orderStatus])

  // Add polling mechanism to check for SMS/OTP
  useEffect(() => {
    const shouldPoll =
      (orderStatus === "PENDING" || orderStatus === "RECEIVED") &&
      !smsCode &&
      !isOrderCancelled &&
      !isOrderFinished &&
      !isOrderBanned

    let pollingInterval: NodeJS.Timeout | null = null

    if (shouldPoll) {
      pollingInterval = setInterval(refreshComponent, 1000)
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [orderStatus, smsCode, isOrderCancelled, isOrderFinished, isOrderBanned, refreshComponent])

  const showResetWarning = orderStatus === "PENDING" || orderStatus === "RECEIVED"

  const handleReset = () => {
    if (showResetWarning) {
      setResetDialogOpen(true)
    } else if (resetUIState) {
      handleConfirmedReset()
    }
  }

  const handleConfirmedReset = async () => {
    if (resetUIState) {
      try {
        setIsResetting(true)
        await resetUIState()
      } finally {
        setIsResetting(false)
      }
    }
  }

  const handleBanWithState = async () => {
    if (isOrderBanned || isBanning) return

    try {
      setIsBanning(true)
      await handleBanNumber()
      setIsOrderBanned(true)
    } finally {
      setIsBanning(false)
    }
  }

  const handleCancelWithState = async () => {
    if (isOrderCancelled || isCancelling || isOrderBanned) return

    try {
      setIsCancelling(true)
      await handleCancelOrder()
    } finally {
      setIsCancelling(false)
    }
  }

  const handleFinishWithState = async () => {
    if (isOrderFinished || isLoading || isOrderBanned) return

    try {
      await handleFinishOrder()
    } catch (error) {
      console.error("Error finishing order:", error)
    }
  }

  const hasSmsBeenReceived = smsCode !== null

  const isActionDisabled = (action: "ban" | "cancel" | "finish") => {
    const baseDisabled = isLoading || isOrderCancelled || isOrderFinished
    if (isOrderBanned) return true

    switch (action) {
      case "ban":
        return baseDisabled || isBanning
      case "cancel":
        return baseDisabled || isCancelling || isOrderBanned || hasSmsBeenReceived
      case "finish":
        return baseDisabled || !smsCode || isOrderBanned
      default:
        return baseDisabled
    }
  }

  const getStatusInfo = (status: OrderStatus | null) => {
    if (!status) return { icon: null, color: "default", text: "Unknown" }

    switch (status) {
      case "PENDING":
        return {
          icon: <Clock className="h-4 w-4 text-yellow-500" />,
          color: "warning",
          text: "Waiting for OTP",
        }
      case "RECEIVED":
        return {
          icon: <CircleCheck className="h-4 w-4 text-green-600" />,
          color: "success",
          text: "Received",
        }
      case "CANCELED":
        return {
          icon: <XCircle className="h-4 w-4 text-red-500" />,
          color: "destructive",
          text: "Cancelled",
        }
      case "TIMEOUT":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
          color: "destructive",
          text: "Timed Out",
        }
      case "FINISHED":
        return {
          icon: <CircleCheck className="h-4 w-4 text-green-600" />,
          color: "success",
          text: "Completed",
        }
      case "BANNED":
        return {
          icon: <Ban className="h-4 w-4 text-red-500" />,
          color: "destructive",
          text: "Banned",
        }
      default:
        return { icon: null, color: "default", text: status }
    }
  }

  const statusInfo = getStatusInfo(isOrderBanned ? "BANNED" : orderStatus)

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Main number information card */}
      {isLoading ? (
        <NumberDisplaySkeleton />
      ) : (
        number && (
          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="pb-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Virtual Number</CardTitle>
                  <Badge
                    variant={getStatusColor(isOrderBanned ? "BANNED" : orderStatus)}
                    className="text-xs font-medium px-2 py-0.5 inline-flex items-center gap-1"
                  >
                    {statusInfo.icon}
                    <span>{statusInfo.text}</span>
                  </Badge>
                </div>

                {productName && (
                  <Badge variant="secondary" className="text-xs">
                    {productName}
                  </Badge>
                )}
              </div>

              {orderId && (
                <div className="flex items-center gap-2 text-xs">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-mono">{orderId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyToClipboard(String(orderId), setIsOrderIdCopied)}
                    className="h-5 w-5 ml-auto p-0"
                  >
                    {isOrderIdCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-2 pb-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Phone:</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                    className="h-7 w-7 p-0"
                  >
                    {isNumberCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="mt-1">
                  <span className="font-mono text-base font-medium">{number.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Waiting for OTP */}
      {(isCheckingSms || isRetrying || (!smsCode && (orderStatus === "PENDING" || orderStatus === "RECEIVED"))) &&
        !smsCode && (
          <Card className="border-yellow-200 dark:border-yellow-800 shadow-sm animate-in fade-in-50 duration-300">
            <CardHeader className="pb-2 bg-yellow-50 dark:bg-yellow-950/30">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full bg-yellow-100 dark:bg-yellow-900/30 animate-ping opacity-75"
                    style={{ animationDuration: "1.5s" }}
                  ></div>
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500 relative" />
                </div>
                <CardTitle className="text-base font-medium text-yellow-700 dark:text-yellow-500">
                  {isRetrying ? `Checking for SMS (${retryAttempts + 1}/${maxRetryAttempts})` : "Waiting for OTP..."}
                </CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="pt-3 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">The system is actively checking for new messages every second</p>
                    <p className="text-xs text-muted-foreground">
                      OTP delivery typically takes 15-60 seconds, but can sometimes take longer depending on the service
                    </p>
                  </div>
                </div>
                
                {/* Progress animation */}
                <div className="w-full bg-yellow-100 dark:bg-yellow-900/20 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-yellow-500 h-full rounded-full animate-pulse"
                    style={{ 
                      width: '30%', 
                      animation: 'indeterminateProgress 1.5s ease-in-out infinite',
                    }}
                  ></div>
                </div>
                
                <style jsx>{`
                  @keyframes indeterminateProgress {
                    0% {
                      transform: translateX(-100%);
                      width: 30%;
                    }
                    50% {
                      width: 50%;
                    }
                    100% {
                      transform: translateX(170%);
                      width: 30%;
                    }
                  }
                `}</style>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Display SMS Code */}
      {smsCode && (
        <Card className="border-green-200 dark:border-green-800 shadow-sm animate-in fade-in-50 duration-300">
          <CardHeader className="pb-3 bg-green-50 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-green-300 dark:bg-green-700 animate-ping opacity-50"></div>
                <CircleCheck className="h-5 w-5 text-green-600 dark:text-green-500 relative" />
              </div>
              <CardTitle className="text-base font-medium text-green-700 dark:text-green-500">OTP Received!</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="pt-3 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex justify-center items-center gap-2 py-3">
                {smsCode.split("").map((digit, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center w-11 h-14 rounded-md border-2 border-green-500/60 bg-green-50/60 dark:bg-green-950/20 shadow-sm"
                  >
                    <span className="text-xl font-bold text-green-700 dark:text-green-400">{digit}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyToClipboard(smsCode, setIsSmsCodeCopied)}
                className="h-9 mx-auto"
              >
                {isSmsCodeCopied ? (
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-500">Copied to Clipboard</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-xs">Copy OTP</span>
                  </div>
                )}
              </Button>

              {fullSms && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Full Message</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(fullSms, setIsOtpCopied)}
                      className="h-6 px-2"
                    >
                      {isOtpCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>

                  <div className="p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10 text-xs overflow-auto max-h-32">
                    {fullSms}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-center gap-2 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {!hasSmsBeenReceived ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isOrderBanned ? "outline" : "destructive"}
                    onClick={handleBanWithState}
                    disabled={isActionDisabled("ban")}
                    className="w-full h-9 text-xs"
                  >
                    {isBanning ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Ban className="h-3.5 w-3.5" />
                        <span>{isOrderBanned ? "Banned" : "Ban Number"}</span>
                      </div>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{isOrderBanned ? "This number has been banned" : "Ban this number if you received spam"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleCancelWithState}
                    disabled={isActionDisabled("cancel")}
                    className="w-full h-9 text-xs"
                  >
                    {isCancelling ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{isOrderCancelled ? "Cancelled" : "Cancel"}</span>
                      </div>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>
                    {isOrderBanned
                      ? "This order has been banned"
                      : isOrderCancelled
                        ? "This order has been cancelled"
                        : "Cancel this order"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        ) : (
          <Button
            variant={isOrderFinished ? "outline" : "default"}
            onClick={isOrderFinished ? undefined : handleFinishWithState}
            disabled={isActionDisabled("finish") || isOrderFinished}
            className="w-full h-9 text-xs col-span-2"
          >
            {isLoading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <div className="flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5" />
                <span>{isOrderFinished ? "Completed" : "Complete Order"}</span>
              </div>
            )}
          </Button>
        )}
      </div>

      {/* Get Another Number Button */}
      {resetUIState && (
        <>
          <Separator className="my-3" />

          <Button
            onClick={handleReset}
            variant="secondary"
            className="w-full h-9 text-xs"
            disabled={isLoading || isResetting}
          >
            {isResetting ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <div className="flex items-center gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Get Another Number</span>
              </div>
            )}
          </Button>

          {/* Alert Dialog for confirmation */}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  {orderStatus === "PENDING"
                    ? "You have an active order waiting for SMS. Getting a new number will cancel this order."
                    : "You have received an SMS but haven't completed the order. Getting a new number will abandon this order."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmedReset} disabled={isResetting}>
                  {isResetting ? <Spinner className="h-4 w-4" /> : "Continue"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}

