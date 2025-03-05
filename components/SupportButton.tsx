"use client";

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconBrandTelegram } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

// Update this with your actual Telegram username or support channel
const TELEGRAM_SUPPORT_LINK = 'https://t.me/otpmaya';

export function SupportButton() {
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    // Show greeting after a short delay
    const timer = setTimeout(() => {
      setShowGreeting(true);
    }, 2000);

    // Hide greeting after some time
    const hideTimer = setTimeout(() => {
      setShowGreeting(false);
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleSupportClick = () => {
    window.open(TELEGRAM_SUPPORT_LINK, '_blank');
  };

  return (
    <TooltipProvider>
      <Tooltip open={showGreeting}>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSupportClick}
            className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg z-50 p-0 flex items-center justify-center bg-[#0088cc] hover:bg-[#0088cc]/90"
            aria-label="Contact Support on Telegram"
          >
            <IconBrandTelegram className="h-6 w-6 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-white text-black">
          <p>Hi! How may I help you? 👋</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 