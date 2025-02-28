"use client"

import React, { JSX, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, PlusCircle, Clock, Tag, Hash, Phone } from "lucide-react"
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
  number: { phone: string; id: string } | null;
  orderId: number | null;
  orderStatus: OrderStatus | null;
  orderCreatedAt: Date | null;
  smsCode: string | null;
  fullSms: string | null;
  isLoading: boolean;
  isOrderCancelled: boolean;
  isOrderFinished: boolean;
  isNumberCopied: boolean;
  isOrderIdCopied: boolean;
  isSmsCodeCopied: boolean;
  isOtpCopied: boolean;
  isRetrying: boolean;
  isCheckingSms: boolean;
  retryAttempts: number;
  maxRetryAttempts: number;
  timeLeft: number | null;
  otpTimeout: number | null;
  isTimeoutActive: boolean;
  handleBanNumber: () => Promise<void>;
  handleCancelOrder: () => Promise<void>;
  handleFinishOrder: () => Promise<void>;
  handleCopyToClipboard: (text: string, setState: (value: boolean) => void) => Promise<void>;
  setIsNumberCopied: (value: boolean) => void;
  setIsOrderIdCopied: (value: boolean) => void;
  setIsSmsCodeCopied: (value: boolean) => void;
  setIsOtpCopied: (value: boolean) => void;
  refreshComponent: () => Promise<void>;
  getStatusColor: (status: OrderStatus | null) => "default" | "secondary" | "destructive" | "outline";
  error: string | null;
  NumberDisplaySkeleton: () => JSX.Element;
  resetUIState?: () => Promise<void>;
  productName?: string;
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
  productName
}: ReceivedNumberViewProps): JSX.Element {
  // State for tracking dialog open state
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isBanning, setIsBanning] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isOrderBanned, setIsOrderBanned] = useState(orderStatus === "BANNED")
  const [isNumberOnlyCopied, setIsNumberOnlyCopied] = useState(false)

  // Update isOrderBanned when orderStatus changes
  useEffect(() => {
    if (orderStatus === "BANNED") {
      setIsOrderBanned(true);
    }
  }, [orderStatus]);

  // Add polling mechanism to check for SMS/OTP
  useEffect(() => {
    // Only start polling if: order is active, SMS not received yet, and component is in a state waiting for SMS
    const shouldPoll = 
      (orderStatus === "PENDING" || orderStatus === "RECEIVED") && 
      !smsCode && 
      !isOrderCancelled && 
      !isOrderFinished && 
      !isOrderBanned;
    
    let pollingInterval: NodeJS.Timeout | null = null;
    
    if (shouldPoll) {
      // Set up polling at 1-second intervals
      pollingInterval = setInterval(() => {
        // Call the refresh function to check for new SMS
        refreshComponent();
      }, 1000); // 1 second delay
    }
    
    // Clean up interval on component unmount or when conditions change
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [orderStatus, smsCode, isOrderCancelled, isOrderFinished, isOrderBanned, refreshComponent]);

  // Determine if the warning should be shown (active order that's not finished or cancelled)
  const showResetWarning = orderStatus === "PENDING" || orderStatus === "RECEIVED";

  // Handle the reset with confirmation if needed
  const handleReset = () => {
    if (showResetWarning) {
      setResetDialogOpen(true)
    } else if (resetUIState) {
      handleConfirmedReset();
    }
  }

  // Separate function to handle the confirmed reset
  const handleConfirmedReset = async () => {
    if (resetUIState) {
      try {
        setIsResetting(true);
        await resetUIState();
      } catch (error) {
        console.error("Error resetting UI state:", error);
      } finally {
        setIsResetting(false);
      }
    }
  }

  // Enhanced ban handler to update UI state
  const handleBanWithState = async () => {
    if (isOrderBanned || isBanning) return;
    
    try {
      setIsBanning(true);
      await handleBanNumber();
      setIsOrderBanned(true);
    } catch (error) {
      console.error("Error banning number:", error);
    } finally {
      setIsBanning(false);
    }
  };

  // Enhanced cancel handler
  const handleCancelWithState = async () => {
    if (isOrderCancelled || isCancelling || isOrderBanned) return;
    
    try {
      setIsCancelling(true);
      await handleCancelOrder();
    } catch (error) {
      console.error("Error cancelling order:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  // Check if SMS has been ACTUALLY received (has content)
  const hasSmsBeenReceived = smsCode !== null;
  
  // Helper function to check if buttons should be disabled
  const isActionDisabled = (action: 'ban' | 'cancel' | 'finish') => {
    const baseDisabled = isLoading || isOrderCancelled || isOrderFinished;
    
    // All actions are disabled if the order is banned
    if (isOrderBanned) return true;
    
    switch(action) {
      case 'ban':
        // Allow banning even if SMS received, but disable if order is already finished/cancelled
        return baseDisabled || isBanning;
      case 'cancel':
        // Disable cancel if SMS already received
        return baseDisabled || isCancelling || isOrderBanned || hasSmsBeenReceived;
      case 'finish':
        return baseDisabled || !smsCode || isOrderBanned;
      default:
        return baseDisabled;
    }
  };

  // Format time display function
  const formatTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format date display function
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status display information
  const getStatusInfo = (status: OrderStatus | null) => {
    if (!status) return { icon: null, color: "default", text: "Unknown" };
    
    switch(status) {
      case "PENDING":
        return { 
          icon: <Clock className="h-4 w-4 text-yellow-500" />, 
          color: "warning", 
          text: "Waiting for SMS" 
        };
      case "RECEIVED":
        return { 
          icon: <CircleCheck className="h-4 w-4 text-green-500" />, 
          color: "success", 
          text: "SMS Received" 
        };
      case "CANCELED":
        return { 
          icon: <XCircle className="h-4 w-4 text-red-500" />, 
          color: "destructive", 
          text: "Cancelled" 
        };
      case "TIMEOUT":
        return { 
          icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, 
          color: "destructive", 
          text: "Timed Out" 
        };
      case "FINISHED":
        return { 
          icon: <CircleCheck className="h-4 w-4 text-green-500" />, 
          color: "success", 
          text: "Completed" 
        };
      case "BANNED":
        return { 
          icon: <Ban className="h-4 w-4 text-red-500" />, 
          color: "destructive", 
          text: "Banned" 
        };
      default:
        return { icon: null, color: "default", text: status };
    }
  };

  // Get status display data
  const statusInfo = getStatusInfo(isOrderBanned ? "BANNED" : orderStatus);

  return (
    <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
      {/* Main number information card with improved design */}
      {isLoading ? (
        <NumberDisplaySkeleton />
      ) : (
        number && (
          <Card className="overflow-hidden border border-border/50 shadow-sm">
            {/* Header with status badge and timestamps */}
            <CardHeader className="pb-2 bg-muted/10">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold">Virtual Number</CardTitle>
                    <Badge 
                      variant={getStatusColor(isOrderBanned ? "BANNED" : orderStatus)} 
                      className="text-xs font-medium px-2 py-1 ml-2 inline-flex items-center gap-1.5"
                    >
                      {statusInfo.icon}
                      <span>{statusInfo.text}</span>
                    </Badge>
                  </div>
                  
                  {productName && (
                    <Badge variant="secondary" className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {productName}
                    </Badge>
                  )}
                </div>

                {/* Timestamps and Order ID section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {orderId && (
                    <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md px-3 py-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-mono font-medium">{orderId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyToClipboard(String(orderId), setIsOrderIdCopied)}
                        className="h-5 w-5 ml-auto"
                      >
                        {isOrderIdCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}

                  {orderCreatedAt && (
                    <div className="flex items-center gap-2 text-xs bg-muted/30 rounded-md px-3 py-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium">{formatDate(orderCreatedAt)}</span>
                      <span className="font-mono font-medium ml-auto">{formatTime(orderCreatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Main content with phone number */}
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col p-4 rounded-lg border bg-muted/5 hover:bg-muted/10 transition-colors">
                {/* Phone number section with improved design */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Phone className="h-3.5 w-3.5 mr-1.5" />
                      <span>Phone Number:</span>
                    </div>
                    
                    {/* Full phone number with country code */}
                    <div className="flex items-center">
                      <span className="font-mono text-xl font-semibold">{number.phone}</span>
                    </div>
                    
                    {/* Number without country code */}
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-muted-foreground">Without country code:</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-mono text-lg font-medium">{number.phone.replace(/^\+\d+/, '')}</span>
                    </div>
                  </div>
                  
                  {/* Copy buttons with improved design */}
                  <div className="flex flex-col gap-2 self-end md:self-center mt-2 md:mt-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                            className="h-8 px-3 w-[120px]"
                          >
                            <div className="flex items-center gap-2">
                              {isNumberCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-xs">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span className="text-xs">Copy full</span>
                                </>
                              )}
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>Copy complete number with country code</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyToClipboard(number.phone.replace(/^\+\d+/, ''), setIsNumberOnlyCopied)}
                            className="h-8 px-3 w-[120px]"
                          >
                            <div className="flex items-center gap-2">
                              {isNumberOnlyCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-xs">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span className="text-xs">Copy number</span>
                                </>
                              )}
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>Copy number without country code</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Waiting for OTP with improved animation */}
      {(isCheckingSms || isRetrying || (!smsCode && (orderStatus === "PENDING" || orderStatus === "RECEIVED"))) && !smsCode && (
        <Card className="border-yellow-200 dark:border-yellow-800 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-yellow-100 dark:bg-yellow-900/30 animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
                <div className="relative rounded-full bg-yellow-200 dark:bg-yellow-800 p-3">
                  <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-base font-medium mb-1">
                  {isRetrying ? `Checking for SMS (${retryAttempts + 1}/${maxRetryAttempts})` : "Waiting for OTP..."}
                </h3>
                <p className="text-sm text-muted-foreground">
                  The system is checking for new messages every second
                </p>
              </div>
              
              <div className="flex items-center justify-center space-x-2 pt-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display SMS Code with improved design */}
      {smsCode && (
        <Card className="border-green-200 dark:border-green-800 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-green-50 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600 dark:text-green-500" />
              <CardTitle className="text-base font-semibold text-green-700 dark:text-green-500">OTP Received</CardTitle>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-5 pb-4">
            <div className="flex flex-col gap-4">
              {/* OTP display with animation */}
              <div className="flex flex-col items-center">
                <div className="flex justify-center items-center gap-2 md:gap-3 py-4">
                  {smsCode.split('').map((digit, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-center w-10 h-12 md:w-12 md:h-14 rounded-md border-2 border-green-500/60 bg-green-50/60 dark:bg-green-950/20 shadow-sm animate-in fade-in-50 duration-500 slide-in-from-bottom-3"
                      style={{ 
                        animationDelay: `${index * 100}ms`,
                      }}
                    >
                      <span className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-400 animate-in zoom-in-95 duration-500"
                        style={{ 
                          animationDelay: `${200 + index * 100}ms`,
                        }}
                      >{digit}</span>
                    </div>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyToClipboard(smsCode, setIsSmsCodeCopied)}
                  className="h-8 mt-2"
                >
                  <div className="flex items-center gap-2">
                    {isSmsCodeCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-500">OTP Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-xs">Copy OTP</span>
                      </>
                    )}
                  </div>
                </Button>
              </div>
              
              {/* Full message section with improved display */}
              {fullSms && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Full Message</span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(fullSms, setIsOtpCopied)}
                      className="h-7"
                    >
                      <div className="flex items-center gap-1">
                        {isOtpCopied ? (
                          <>
                            <Check className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </div>
                    </Button>
                  </div>
                  
                  <div className="p-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10 text-sm overflow-auto max-h-32">
                    {fullSms}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMS Received Notice */}
      {hasSmsBeenReceived ? (
        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/50 p-1.5 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              SMS has been received. You cannot cancel this number anymore as the service has been delivered.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Error Display */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="rounded-full bg-destructive/20 p-1.5 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm break-words text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons with improved layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {!hasSmsBeenReceived ? (
          <>
            {/* Ban Number button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isOrderBanned ? "outline" : "destructive"}
                    onClick={handleBanWithState}
                    disabled={isActionDisabled('ban')}
                    className="w-full h-10 text-sm"
                  >
                    {isBanning ? (
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="h-4 w-4" />
                        <span>Banning...</span>
                      </div>
                    ) : isOrderBanned ? (
                      <div className="flex items-center justify-center gap-2">
                        <Ban className="h-4 w-4" />
                        <span>Number Banned</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Ban className="h-4 w-4" />
                        <span>Ban Number</span>
                      </div>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{isOrderBanned ? "This number has been banned" : "Ban this number if you received spam"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Cancel Order button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleCancelWithState}
                    disabled={isActionDisabled('cancel')}
                    className="w-full h-10 text-sm"
                  >
                    {isCancelling ? (
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="h-4 w-4" />
                        <span>Cancelling...</span>
                      </div>
                    ) : isOrderBanned ? (
                      <div className="flex items-center justify-center gap-2">
                        <XCircle className="h-4 w-4" />
                        <span>Order Banned</span>
                      </div>
                    ) : isOrderCancelled ? (
                      <div className="flex items-center justify-center gap-2">
                        <XCircle className="h-4 w-4" />
                        <span>Order Cancelled</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <XCircle className="h-4 w-4" />
                        <span>Cancel Order</span>
                      </div>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
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
          /* Complete Order button - Only show when SMS received, now full width */
          <Button
            variant={isOrderFinished ? "outline" : "default"}
            onClick={isOrderFinished ? undefined : handleFinishOrder}
            disabled={isActionDisabled('finish') || isOrderFinished}
            className="w-full h-10 text-sm col-span-1 md:col-span-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner className="h-4 w-4" />
                <span>Finishing...</span>
              </div>
            ) : isOrderFinished ? (
              <div className="flex items-center justify-center gap-2">
                <CircleCheck className="h-4 w-4" />
                <span>Order Completed</span>
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

      {/* Get Another Number Button with Dialog */}
      {resetUIState && (
        <>
          <div className="pt-2">
            <Separator className="my-2" />
            
            <Button
              onClick={handleReset}
              variant="secondary"
              className="w-full mt-4"
              disabled={isLoading || isResetting}
            >
              {isResetting ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>Getting New Number...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  <span>Get Another Number</span>
                </div>
              )}
            </Button>
          </div>

          {/* Alert Dialog for confirmation */}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  {orderStatus === "PENDING" ? 
                    "You have an active order waiting for SMS. Getting a new number will cancel this order." :
                    "You have received an SMS but haven't completed the order. Getting a new number will abandon this order."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleConfirmedReset}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    "Continue"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
} 