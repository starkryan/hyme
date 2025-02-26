import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall, Shield, Globe, Zap, Clock, CheckCircle, Smartphone, KeyRound, MessageSquare, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["instant", "secure", "reliable", "automated", "global"],
    []
  );

  // OTP digits animation
  const [otpDigits, setOtpDigits] = useState(["9", "3", "7", "5"]);
  
  useEffect(() => {
    const otpInterval = setInterval(() => {
      setOtpDigits(prev => {
        const newDigits = [...prev];
        const randomIndex = Math.floor(Math.random() * 4);
        newDigits[randomIndex] = Math.floor(Math.random() * 10).toString();
        return newDigits;
      });
    }, 1500);
    
    return () => clearInterval(otpInterval);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Background with subtle OTP-themed pattern */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 grid grid-cols-10 gap-2 rotate-12">
            {Array.from({ length: 100 }).map((_, i) => (
              <div 
                key={i} 
                className="w-6 h-6 text-xs flex items-center justify-center text-foreground/20"
                style={{ 
                  top: `${Math.floor(i / 10) * 50}px`, 
                  left: `${(i % 10) * 50}px` 
                }}
              >
                {Math.floor(Math.random() * 10)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        <div className="py-12 sm:py-16 lg:py-24 flex flex-col items-center justify-center">
          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full flex justify-center"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 sm:gap-2 rounded-full border border-border/40 bg-background/80 backdrop-blur-sm shadow-sm text-xs sm:text-sm"
            >
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span className="text-muted-foreground">Trusted by 10,000+ Customers</span>
              <MoveRight className="w-3 h-3 text-primary" />
            </Button>
          </motion.div>

          {/* OTP Verification Display */}
          <motion.div
            className="mt-6 sm:mt-8 lg:mt-10 mb-2 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative flex items-center gap-1">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-primary" />
              <div className="flex gap-1 sm:gap-2">
                {otpDigits.map((digit, idx) => (
                  <motion.div
                    key={idx}
                    className="w-8 h-10 sm:w-10 sm:h-12 bg-card border border-border flex items-center justify-center rounded-md text-base sm:text-xl font-mono"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <motion.span
                      key={`${idx}-${digit}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {digit}
                    </motion.span>
                  </motion.div>
                ))}
              </div>
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 ml-1 text-primary" />
            </div>
          </motion.div>

          {/* Main headline */}
          <motion.div 
            className="flex flex-col items-center mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl max-w-3xl text-center font-medium tracking-tighter leading-tight text-foreground">
              <span className="font-semibold">
                Virtual OTP Provider
              </span>
              <span className="relative flex w-full justify-center overflow-hidden text-center mt-2 h-16 sm:h-20 md:h-24">
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold text-primary"
                    initial={{ opacity: 0, y: "100%" }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 100,
                      damping: 20,
                      duration: 0.7
                    }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? "-100%" : "100%",
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <motion.p 
              className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl leading-relaxed tracking-tight max-w-2xl text-center text-muted-foreground px-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Get instant access to virtual phone numbers for OTP verification. 
              Perfect for developers, businesses, and individuals who need reliable 
              SMS verification services worldwide.
            </motion.p>
          </motion.div>

          {/* Feature highlights */}
          <motion.div 
            className="flex flex-wrap justify-center gap-2 sm:gap-4 md:gap-6 max-w-3xl mx-auto mt-6 sm:mt-8 lg:mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="flex items-center gap-2 text-muted-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-border shadow-sm text-xs sm:text-sm">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-border shadow-sm text-xs sm:text-sm">
              <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span>Global Coverage</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-border shadow-sm text-xs sm:text-sm">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span>24/7 Available</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-card border border-border shadow-sm text-xs sm:text-sm">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span>SMS Verification</span>
            </div>
          </motion.div>

          {/* Verification illustration */}
          <motion.div
            className="relative mt-6 sm:mt-8 lg:mt-10 mb-4 w-full max-w-lg px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="flex flex-col items-center mb-6 sm:mb-0">
                <div className="w-32 h-48 sm:w-40 sm:h-60 rounded-xl border-4 border-border bg-card shadow-lg flex flex-col overflow-hidden">
                  <div className="h-4 sm:h-6 bg-muted flex justify-center items-center">
                    <div className="w-12 sm:w-16 h-1 rounded-full bg-border"></div>
                  </div>
                  <div className="flex-grow p-2 flex flex-col">
                    <div className="h-2 sm:h-3 w-3/4 bg-muted rounded-full mb-2"></div>
                    <div className="h-2 sm:h-3 w-1/2 bg-muted rounded-full mb-4 sm:mb-6"></div>
                    <div className="bg-primary/10 rounded-lg p-1 sm:p-2 mb-2">
                      <div className="h-2 sm:h-3 w-full bg-primary/30 rounded-full mb-1"></div>
                      <div className="h-2 sm:h-3 w-3/4 bg-primary/30 rounded-full"></div>
                    </div>
                    <div className="mt-auto">
                      <div className="h-6 sm:h-8 w-full rounded-lg bg-primary flex items-center justify-center">
                        <div className="w-1/2 h-2 sm:h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 text-primary mt-2" />
              </div>
              
              <motion.div 
                className="flex flex-col items-center"
                animate={{ 
                  x: [0, 5, -5, 5, 0],
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  repeatType: "reverse" 
                }}
              >
                <div className="h-4 sm:h-6 w-6 sm:w-8 bg-muted rounded-t-full"></div>
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-card rounded-full border-4 border-border flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-2 rounded-full bg-muted/60 flex items-center justify-center">
                    <div className="text-base sm:text-lg font-mono font-bold tracking-widest text-primary">
                      {otpDigits.join('')}
                    </div>
                  </div>
                </div>
                <div className="h-3 sm:h-4 w-8 sm:w-10 bg-border rounded-b-lg mt-1"></div>
              </motion.div>
            </div>
          </motion.div>

          {/* CTA buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Button 
              size="default" 
              className="gap-2 px-4 sm:px-6 shadow-sm text-sm sm:text-base w-full sm:w-auto"
              asChild
            >
              <Link href="/dashboard">
                <Zap className="w-4 h-4" />
                Get Virtual Number 
                <MoveRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button 
              variant="outline"
              size="default"
              className="gap-2 px-4 sm:px-6 text-sm sm:text-base w-full sm:w-auto"
            >
              <PhoneCall className="w-4 h-4" />
              View Pricing
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
