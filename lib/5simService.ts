import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

// Create axios instance with default headers
const api = axios.create({
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  }
});

export enum OrderStatus {
  PENDING = 'PENDING',       // Preparation
  RECEIVED = 'RECEIVED',     // Waiting for receipt of SMS
  CANCELED = 'CANCELED',     // Is cancelled
  TIMEOUT = 'TIMEOUT',       // A timeout
  FINISHED = 'FINISHED',     // Is complete
  BANNED = 'BANNED'          // Number banned, when number already used
}

export const getVirtualNumber = async (serviceCode: string) => {
  try {
    // Log the request details
    console.log('Making request with:', {
      url: `${API_URL}/user/buy/activation/russia/any/${serviceCode}`,
      headers: {
        'Authorization': `Bearer ${api.defaults.headers.common['Authorization']}`,
        'Accept': 'application/json'
      }
    });

    // Add timeout and retry logic
    const response = await api.get(
      `${API_URL}/user/buy/activation/russia/any/${serviceCode}`,
      {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status >= 200 && status < 500 // Accept any status < 500
      }
    );

    // Log the response
    console.log('API Response:', {
      status: response.status,
      data: response.data
    });

    if (!response.data) {
      throw new Error('No data received from the API');
    }

    if (response.data === 'no free phones') {
      throw new Error('No free phones available for this service');
    }

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      // Log the full error for debugging
      console.error('Axios Error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });

      if (!error.response) {
        // Network error (no response received)
        throw new Error('Unable to connect to the service. Please check your internet connection and try again.');
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please try again.');
      }

      if (error.response.status === 401) {
        throw new Error('Authentication failed. Please check your API key.');
      }

      if (error.response.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid request parameters');
      }

      throw new Error(`Service error: ${error.response.data?.message || error.message}`);
    }

    // Non-axios errors
    console.error('Non-Axios Error:', error);
    throw new Error('An unexpected error occurred. Please try again.');
  }
};

export const getSmsCode = async (id: string) => {
  try {
    const response = await api.get(`${API_URL}/user/check/${id}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to get SMS code');
  }
};

export const getBalance = async () => {
  try {
    const response = await api.get(`${API_URL}/user/profile`);
    return { balance: response.data.balance };
  } catch (error) {
    throw new Error('Failed to get balance');
  }
};

interface ProductPrice {
  cost: number;
  count: number;
  rate?: number;
}

interface ProductResponse {
  Category: string;
  Qty: number;
  Price: number;
}

export const getProducts = async (country: string = 'russia', operator: string = 'any') => {
  try {
    const response = await api.get(`${API_URL}/guest/products/${country}/${operator}`);
    
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
    if (axios.isAxiosError(error)) {
      console.error(`Request failed for country=${country}, operator=${operator}`);
      if (error.response?.status === 400) {
        throw new Error(`Invalid parameters: country=${country}, operator=${operator}`);
      }
      throw new Error(`API Error: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to get products: ${error.message}`);
  }
};

export const getPrices = async (params?: { country?: string; product?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.country) queryParams.append('country', params.country);
    if (params?.product) queryParams.append('product', params.product);

    const url = `${API_URL}/guest/prices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    
    if (!response.data) {
      throw new Error('No price data received');
    }

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error('Invalid country or product parameters');
      }
      throw new Error(`API Error: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to get prices: ${error.message}`);
  }
};

export const checkSmsMessages = async (orderId: number) => {
  try {
    const response = await api.get(`${API_URL}/user/sms/inbox/${orderId}`);
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to retrieve SMS messages: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to retrieve SMS messages: ${error.message}`);
  }
};

export const cancelOrder = async (orderId: number) => {
  try {
    console.log(`Cancelling order: ${orderId}`);
    const response = await api.get(`${API_URL}/user/cancel/${orderId}`);
    
    if (!response.data) {
      throw new Error('No response received from cancel request');
    }
    
    console.log('Cancel response:', response.data);
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        const message = error.response.data?.message || 'Order cannot be cancelled';
        console.error(`Cancel error: ${message}`);
        throw new Error(message);
      }
      throw new Error(`Failed to cancel order: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to cancel order: ${error.message}`);
  }
};

export const getNotifications = async (lang: 'ru' | 'en') => {
  try {
    const response = await api.get(`${API_URL}/guest/flash/${lang}`);
    
    if (!response.data) {
      throw new Error('No notification data received');
    }

    return response.data.text;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to get notifications: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to get notifications: ${error.message}`);
  }
};

export const getVendorStatistics = async () => {
  try {
    const response = await api.get(`${API_URL}/user/vendor`);
    
    if (!response.data) {
      throw new Error('No vendor data received');
    }

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to get vendor statistics: ${error.response?.data?.message || error.message}`);
    }
    throw new Error(`Failed to get vendor statistics: ${error.message}`);
  }
};