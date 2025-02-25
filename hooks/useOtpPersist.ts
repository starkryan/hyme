import { useState, useEffect } from 'react';

interface OtpData {
  smsCode: string | null;
  fullSms: string | null;
  orderId: string | null;
  phoneNumber: string | null;
  orderStatus: string | null;
  createdAt: string | null;
}

export function useOtpPersist(key: string) {
  const [otpData, setOtpData] = useState<OtpData>(() => {
    if (typeof window === 'undefined') {
      return getInitialState();
    }

    try {
      const saved = localStorage.getItem(key);
      if (!saved) return getInitialState();

      const parsed = JSON.parse(saved);
      
      // Validate stored data
      if (!isValidOtpData(parsed)) {
        localStorage.removeItem(key);
        return getInitialState();
      }

      // Check if data is expired
      if (parsed.createdAt) {
        const expiryTime = new Date(parsed.createdAt).getTime() + 20 * 60 * 1000;
        if (Date.now() > expiryTime) {
          localStorage.removeItem(key);
          return getInitialState();
        }
      }

      return parsed;
    } catch (error) {
      console.error('Error reading OTP data from localStorage:', error);
      localStorage.removeItem(key);
      return getInitialState();
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    if (otpData.smsCode || otpData.orderId) {
      localStorage.setItem(key, JSON.stringify(otpData));
    } else {
      localStorage.removeItem(key);
    }
  }, [key, otpData]);

  // Clear OTP data after 20 minutes
  useEffect(() => {
    if (otpData.createdAt) {
      const timeoutId = setTimeout(() => {
        setOtpData({
          smsCode: null,
          fullSms: null,
          orderId: null,
          phoneNumber: null,
          orderStatus: null,
          createdAt: null
        });
      }, 20 * 60 * 1000); // 20 minutes

      return () => clearTimeout(timeoutId);
    }
  }, [otpData.createdAt]);

  const updateOtpData = (data: Partial<OtpData>) => {
    setOtpData(prev => {
      const updated = { ...prev, ...data };
      if (!isValidOtpData(updated)) {
        console.error('Invalid OTP data update:', data);
        return prev;
      }
      return updated;
    });
  };

  const clearOtpData = () => {
    setOtpData({
      smsCode: null,
      fullSms: null,
      orderId: null,
      phoneNumber: null,
      orderStatus: null,
      createdAt: null
    });
    localStorage.removeItem(key);
  };

  return {
    otpData,
    updateOtpData,
    clearOtpData
  };
}

// Helper functions
function getInitialState(): OtpData {
  return {
    smsCode: null,
    fullSms: null,
    orderId: null,
    phoneNumber: null,
    orderStatus: null,
    createdAt: null
  };
}

function isValidOtpData(data: any): data is OtpData {
  return (
    data &&
    typeof data === 'object' &&
    (data.smsCode === null || typeof data.smsCode === 'string') &&
    (data.fullSms === null || typeof data.fullSms === 'string') &&
    (data.orderId === null || typeof data.orderId === 'string') &&
    (data.phoneNumber === null || typeof data.phoneNumber === 'string') &&
    (data.orderStatus === null || typeof data.orderStatus === 'string') &&
    (data.createdAt === null || typeof data.createdAt === 'string')
  );
} 