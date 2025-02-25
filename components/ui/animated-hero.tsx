import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall, Shield, Globe, Zap, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["instant", "secure", "reliable", "automated", "global"],
    []
  );

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
    <div className="w-full ">
      <div className="container mx-auto">
        <div className="flex gap-8 py-20 lg:py-32 items-center justify-center flex-col">
          <div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="gap-4"
            >
              <CheckCircle className="w-4 h-4" />
              Trusted by 10,000+ Customers 
              <MoveRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-6 flex-col">
            <h1 className="text-5xl md:text-7xl max-w-3xl tracking-tighter text-center font-regular">
              <span className="font-semibold">
                Virtual OTP Provider
              </span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold text-white"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 50,
                      damping: 10 
                    }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight max-w-2xl text-center text-muted-foreground">
              Get instant access to virtual phone numbers for OTP verification. 
              Perfect for developers, businesses, and individuals who need reliable 
              SMS verification services worldwide.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Globe className="w-5 h-5" />
              <span>Global Coverage</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>24/7 Available</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button 
              size="lg" 
              className="gap-4"
            >
              <Zap className="w-5 h-5" />
              Get Virtual Number 
              <MoveRight className="w-4 h-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="gap-4"
            >
              <PhoneCall className="w-5 h-5" />
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
