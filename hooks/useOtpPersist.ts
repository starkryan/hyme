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
  // Initialize state from localStorage if available
  const [otpData, setOtpData] = useState<OtpData>(() => {
    if (typeof window === 'undefined') return {
      smsCode: null,
      fullSms: null,
      orderId: null,
      phoneNumber: null,
      orderStatus: null,
      createdAt: null
    };

    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          smsCode: null,
          fullSms: null,
          orderId: null,
          phoneNumber: null,
          orderStatus: null,
          createdAt: null
        };
      }
    }
    return {
      smsCode: null,
      fullSms: null,
      orderId: null,
      phoneNumber: null,
      orderStatus: null,
      createdAt: null
    };
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
    setOtpData(prev => ({ ...prev, ...data }));
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