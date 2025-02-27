"use client"

import React, { JSX, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, PlusCircle } from "lucide-react"
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
        console.log("Polling for SMS/OTP...");
      }, 1000); // 1 second delay
    }
    
    // Clean up interval on component unmount or when conditions change
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [orderStatus, smsCode, isOrderCancelled, isOrderFinished, isOrderBanned, refreshComponent]);

  // Also update isOrderCancelled state when ban happens
  useEffect(() => {
    if (isOrderBanned) {
      // Once order is banned, it's effectively cancelled in the system
      // This prevents trying to cancel an already banned (non-existent) order
    }
  }, [isOrderBanned]);

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
      // After banning, the order is in a final state and cannot be cancelled
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

  // Check if the order status says RECEIVED but no SMS content yet

  return (
    <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
      {/* Display Number Information */}
      {isLoading ? (
        <NumberDisplaySkeleton />
      ) : (
        number && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Virtual Number</CardTitle>
                    <Badge variant={getStatusColor(isOrderBanned ? "BANNED" : orderStatus)} className="text-xs font-semibold px-2 py-1">
                      {isOrderBanned ? "BANNED" : orderStatus}
                    </Badge>
                  </div>
                  
                  {orderCreatedAt && (
                    <div className="text-xs bg-muted rounded-md px-3 py-1.5 flex items-center gap-2">
                      <span className="font-medium">Created</span>
                      <span className="font-mono font-medium">{new Date(orderCreatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                    </div>
                  )}
                </div>
                
                {orderId && (
                  <div className="flex items-center justify-between border border-muted rounded-md px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Order ID:</span>
                      <span className="font-mono text-xs font-semibold">{orderId}</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Copy Order ID</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col p-3 md:p-4 rounded-lg border bg-muted/10">
                {/* Product information - always displayed at the top with fallback */}
                <div className="flex flex-col gap-2 mb-3 pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">OTP Service:</span>
                    <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {productName || "SMS Verification"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {productName 
                      ? `This number is activated for receiving OTP from ${productName}.` 
                      : "This number is activated for SMS verification services."}
                  </p>
                </div>
                
                {/* Phone number with country code */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      
                      <span className="font-mono text-base font-medium break-all">{number.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      
                      <span className="font-mono text-base font-medium break-all">
                        {number.phone.replace(/^\+\d+/, '')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Copy buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyToClipboard(number.phone, setIsNumberCopied)}
                            className="h-8 px-2.5"
                          >
                            <div className="flex items-center gap-1.5">
                              {isNumberCopied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span className="text-xs">Copy with code</span>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Copy number with country code</p>
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
                            className="h-8 px-2.5"
                          >
                            <div className="flex items-center gap-1.5">
                              {isNumberOnlyCopied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span className="text-xs">Copy without code</span>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
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

      {/* Waiting for OTP */}
      {(isCheckingSms || isRetrying || (!smsCode && (orderStatus === "PENDING" || orderStatus === "RECEIVED"))) && !smsCode && (
        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              <span className="text-sm font-medium">
                {isRetrying ? `Checking for SMS (${retryAttempts + 1}/${maxRetryAttempts})` : "Waiting for OTP..."}
              </span>
            </div>
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              Checking for new messages every second...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Display SMS Code */}
      {smsCode && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-green-500" />
              OTP Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs font-medium">
                  OTP Code
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToClipboard(smsCode, setIsSmsCodeCopied)}
                  className="h-8"
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
              
              <div className="flex justify-center items-center gap-2 md:gap-3">
                {smsCode.split('').map((digit, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-center w-10 h-12 md:w-12 md:h-14 rounded-md border-2 border-green-500/60 bg-green-50/30 dark:bg-green-950/20 shadow-sm animate-in fade-in-50 duration-500 slide-in-from-bottom-3"
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
              
              {fullSms && (
                <div className="mt-2 md:mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      Full Message
                    </Badge>
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
                  <div className="p-3 rounded-md border border-green-500/20 bg-muted/20 text-sm md:text-base overflow-auto max-h-28">
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
          <CardContent className="flex items-center gap-2 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              SMS has been received. You cannot cancel this number anymore as the service has been delivered.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Error Display */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-center gap-2 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm break-words text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className={`grid ${hasSmsBeenReceived ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
        {/* Show Ban Number and Cancel Order buttons only when no SMS received */}
        {!hasSmsBeenReceived ? (
          <>
            {/* Ban Number button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isOrderBanned ? "outline" : "outline"}
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
                <TooltipContent side="bottom">
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
                <TooltipContent side="bottom">
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
          /* Complete Order button - Only show when SMS received */
          isOrderFinished ? (
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
              disabled={isActionDisabled('finish')}
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
          )
        )}
      </div>

      {/* Get Another Number Button with Dialog */}
      {resetUIState && (
        <>
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