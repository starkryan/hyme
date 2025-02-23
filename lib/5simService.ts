import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';

// Configuration constants
const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

// Enum for order statuses
export enum OrderStatus {
  PENDING = 'PENDING',       // Preparation
  RECEIVED = 'RECEIVED',     // Waiting for receipt of SMS
  CANCELED = 'CANCELED',     // Is cancelled
  TIMEOUT = 'TIMEOUT',       // A timeout
  FINISHED = 'FINISHED',     // Is complete
  BANNED = 'BANNED'          // Number banned, when number already used
}

// Axios instance with default headers and error handling
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Response interceptor to handle non-2xx responses
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Centralized error handling
    handleAxiosError(error);
    return Promise.reject(error); // Propagate the error
  }
);

// Centralized error handling function
const handleAxiosError = (error: AxiosError, customMessage: string = 'API Error'): void => {
  if (axios.isAxiosError(error)) {
    const errorMessage = error.response?.data?.message || error.message;
    const status = error.response?.status;

    // Log detailed error information for debugging
    console.error('Axios Error:', {
      message: errorMessage,
      status: status,
      data: error.response?.data,
      headers: error.response?.headers,
    });

    // Specific error handling based on status code
    switch (status) {
      case 400:
        throw new Error(`Invalid request: ${errorMessage}`);
      case 401:
        throw new Error('Authentication failed. Please check your API key.');
      case 404:
        throw new Error('Resource not found.');
      case 500:
        throw new Error('Internal server error.');
      default:
        throw new Error(`${customMessage}: ${errorMessage}`);
    }
  } else {
    // Log non-Axios errors
    console.error('Non-Axios Error:', error);
    throw new Error(`${customMessage}: ${error.message}`);
  }
};

// Interfaces for better type safety
interface VirtualNumber {
  id: string;
  phone: string;
  operator: string;
  product: string;
  price: number;
  status: string;
  expires: string;
  created_at: string;
  country: string;
}

interface SmsMessage {
  created_at: string;
  date: string;
  sender: string;
  text: string;
  code: string;
  is_wave?: boolean;
  wave_uuid?: string;
}

interface OrderResponse {
  id: number;
  created_at: string;
  phone: string;
  product: string;
  price: number;
  status: OrderStatus;
  expires: string;
  sms: SmsMessage[] | null;
  forwarding: boolean;
  forwarding_number: string;
  country: string;
}

interface SmsInboxResponse {
  Data: SmsMessage[];
  Total: number;
}

interface ProductResponse {
  Category: string;
  Qty: number;
  Price: number;
}

interface BalanceResponse {
  balance: number;
}

// Generic function to handle API requests
const handleApiResponse = async <T>(url: string, method: 'get' | 'post' | 'put' | 'delete', data?: any): Promise<T> => {
  try {
    const response: AxiosResponse<T> = await api.request({
      url,
      method,
      data,
    });

    if (!response.data) {
      throw new Error('No data received from the API');
    }

    return response.data;
  } catch (error: any) {
    handleAxiosError(error, `Failed to ${method} data from ${url}`);
    throw error;
  }
};

// API functions
export const getVirtualNumber = async (countryCode: string, serviceCode: string | null): Promise<VirtualNumber | undefined> => {
  try {
    const data = await handleApiResponse<VirtualNumber>(
      `/user/buy/activation/${countryCode}/any/${serviceCode ? serviceCode : 'any'}`,
      'get'
    );
    return data;
  } catch (error: any) {
    console.error('Failed to get virtual number:', error);
    return undefined;
  }
};

export const getSmsCode = async (id: string): Promise<OrderResponse | undefined> => {
  try {
    return await handleApiResponse<OrderResponse>(`/user/check/${id}`, 'get');
  } catch (error: any) {
    console.error('Failed to get SMS code:', error);
    return undefined;
  }
};

export const getBalance = async (): Promise<BalanceResponse | undefined> => {
  try {
    return await handleApiResponse<BalanceResponse>('/user/profile', 'get');
  } catch (error: any) {
    console.error('Failed to get balance:', error);
    return undefined;
  }
};

export const getProducts = async (
  country: string = 'india',
  operator: string = 'any'
): Promise<Array<ProductResponse & { id: string; name: string }> | undefined> => {
  try {
    const response = await api.get(`/guest/products/${country}/${operator}`);

    if (!response.data) {
      throw new Error('No product data received');
    }

    // Transform the response data into a more usable format
    const products = Object.entries(response.data).map(([key, value]: [string, any]) => ({
      id: key,
      name: key,
      ...value as ProductResponse
    }));

    return products;
  } catch (error: any) {
    handleAxiosError(error, `Failed to get products for country=${country}, operator=${operator}`);
    return undefined;
  }
};

export const getPrices = async (
  params?: { country?: string; product?: string }
): Promise<any | undefined> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.country) queryParams.append('country', params.country);
    if (params?.product) queryParams.append('product', params.product);

    const url = `/guest/prices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);

    if (!response.data) {
      throw new Error('No price data received');
    }

    return response.data;
  } catch (error: any) {
    handleAxiosError(error, 'Failed to get prices');
    return undefined;
  }
};

export const checkSmsMessages = async (orderId: number): Promise<SmsInboxResponse | undefined> => {
  try {
    return await handleApiResponse<SmsInboxResponse>(`/user/sms/inbox/${orderId}`, 'get');
  } catch (error: any) {
    console.error('Failed to retrieve SMS messages:', error);
    return undefined;
  }
};

export const cancelOrder = async (orderId: number): Promise<OrderResponse | undefined> => {
  try {
    console.log(`Cancelling order: ${orderId}`);
    return await handleApiResponse<OrderResponse>(`/user/cancel/${orderId}`, 'get');
  } catch (error: any) {
    console.error('Failed to cancel order:', error);
    return undefined;
  }
};

export const getNotifications = async (lang: 'ru' | 'en'): Promise<string | undefined> => {
  try {
    const response = await api.get(`/guest/flash/${lang}`);

    if (!response.data) {
      throw new Error('No notification data received');
    }

    return response.data.text;
  } catch (error: any) {
    handleAxiosError(error, 'Failed to get notifications');
    return undefined;
  }
};

export const getVendorStatistics = async (): Promise<any | undefined> => {
  try {
    const response = await api.get(`/user/vendor`);

    if (!response.data) {
      throw new Error('No vendor data received');
    }

    return response.data;
  } catch (error: any) {
    handleAxiosError(error, 'Failed to get vendor statistics');
    return undefined;
  }
};

export const finishOrder = async (orderId: number): Promise<OrderResponse | undefined> => {
  try {
    return await handleApiResponse<OrderResponse>(`/user/finish/${orderId}`, 'get');
  } catch (error: any) {
    console.error('Failed to finish order:', error);
    return undefined;
  }
};

export const banOrder = async (orderId: number): Promise<OrderResponse | undefined> => {
  try {
    return await handleApiResponse<OrderResponse>(`/user/ban/${orderId}`, 'get');
  } catch (error: any) {
    console.error('Failed to ban order:', error);
    return undefined;
  }
};

export const getCountries = async (): Promise<any | undefined> => {
  try {
    const response = await api.get('/guest/countries');

    if (!response.data) {
      throw new Error('No countries data received');
    }

    return response.data;
  } catch (error: any) {
    handleAxiosError(error, 'Failed to get countries');
    return undefined;
  }
};