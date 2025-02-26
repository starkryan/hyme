import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall, Shield, Globe, Zap, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
    <div className="w-full">
      <div className="container mx-auto">
        <div className="py-20 lg:py-32 flex flex-col items-center justify-center">
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
            >
              <CheckCircle className="w-3 h-3" />
              Trusted by 10,000+ Customers 
              <MoveRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-5xl md:text-7xl max-w-3xl text-center font-regular tracking-tighter">
              <span className="font-semibold">
                Virtual OTP Provider
              </span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold"
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

            <p className="mt-4 text-lg md:text-xl leading-relaxed tracking-tight max-w-2xl text-center text-muted-foreground">
              Get instant access to virtual phone numbers for OTP verification. 
              Perfect for developers, businesses, and individuals who need reliable 
              SMS verification services worldwide.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto mt-8 ">
            <div className="flex items-center gap-2 text-muted-foreground min-w-[200px]">
              <Shield className="w-4 h-4" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground min-w-[200px]">
              <Globe className="w-4 h-4" />
              <span>Global Coverage</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground min-w-[200px]">
              <Clock className="w-4 h-4" />
              <span>24/7 Available</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              size="default" 
              className="gap-2"
              asChild
            >
              <Link href="/dashboard">
                <Zap className="w-4 h-4" />
                Get Virtual Number 
                <MoveRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button 
              variant="outline"
              size="default"
              className="gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
