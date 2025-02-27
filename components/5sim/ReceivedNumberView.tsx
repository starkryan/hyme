"use client"

import React, { JSX, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, AlertTriangle, XCircle, CircleCheck, Ban, RefreshCw, PlusCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  timeLeft,
  otpTimeout,
  isTimeoutActive,
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
  resetUIState
}: ReceivedNumberViewProps): JSX.Element {
  // State for tracking dialog open state
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

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
                    <Badge variant={getStatusColor(orderStatus)} className="text-xs font-semibold px-2 py-1">
                      {orderStatus}
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
                  <div className="flex items-center border border-muted rounded-md px-3 py-1.5 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground mr-2">Order ID:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-semibold">{orderId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyToClipboard(String(orderId), setIsOrderIdCopied)}
                        className="h-5 w-5 ml-1"
                      >
                        {isOrderIdCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OTP Received</CardTitle>
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
                    className="flex items-center justify-center w-10 h-12 md:w-12 md:h-14 rounded-md border-2 border-primary/20 bg-background shadow-sm animate-in fade-in-50 duration-500 slide-in-from-bottom-3"
                    style={{ 
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: 'both',
                      boxShadow: '0 0 0 0 rgba(22, 163, 74, 0.7)',
                      animation: `
                        fade-in-50 500ms ${index * 100}ms both,
                        slide-in-from-bottom-3 500ms ${index * 100}ms both,
                        pulse-border 2s ${500 + index * 100}ms ease-out
                      `
                    }}
                  >
                    <span className="text-xl md:text-2xl font-bold text-primary animate-in zoom-in-95 duration-500"
                      style={{ 
                        animationDelay: `${200 + index * 100}ms`,
                        animationFillMode: 'both'
                      }}
                    >{digit}</span>
                  </div>
                ))}
              </div>

              {/* Add keyframe animation for the pulse effect */}
              <style jsx global>{`
                @keyframes pulse-border {
                  0% {
                    border-color: rgba(22, 163, 74, 0.2);
                    background-color: rgba(22, 163, 74, 0.05);
                    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
                  }
                  20% {
                    border-color: rgba(22, 163, 74, 1);
                    background-color: rgba(22, 163, 74, 0.1);
                    box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
                  }
                  100% {
                    border-color: rgba(22, 163, 74, 0.5);
                    background-color: rgba(22, 163, 74, 0.05);
                    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
                  }
                }
              `}</style>
              
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
                  <div className="p-3 rounded-md border border-primary/10 bg-muted/20 text-sm md:text-base overflow-auto max-h-28">
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
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm break-words text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
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

        {/* Only show Complete Order button when SMS has been received (smsCode exists) */}
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
        ) : smsCode ? (
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
        ) : (
          <Button
            variant="outline"
            disabled
            className="w-full h-10 text-sm"
          >
            <div className="flex items-center justify-center gap-2">
              <CircleCheck className="h-4 w-4" />
              <span>Waiting for SMS...</span>
            </div>
          </Button>
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