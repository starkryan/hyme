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

// Country code mapping for common variations
const COUNTRY_MAPPING: { [key: string]: string } = {
  'uk': 'england',
  'united kingdom': 'england',
  'great britain': 'england',
  'united states': 'usa',
  'united states of america': 'usa',
  'korea': 'southkorea',
  'south korea': 'southkorea',
  'bosnia': 'bih',
  'bosnia and herzegovina': 'bih',
  'dominican republic': 'dominicana',
  'czech republic': 'czech',
  'macedonia': 'northmacedonia',
  'india': 'india',
  'bharat': 'india',
  'hindustan': 'india'
};

// Supported country codes by the API
const SUPPORTED_COUNTRIES = [
  'russia', 'ukraine', 'kazakhstan', 'china', 'philippines', 'myanmar', 'indonesia', 
  'malaysia', 'kenya', 'tanzania', 'vietnam', 'kyrgyzstan', 'usa', 'poland', 'england', 
  'india', 'romania', 'colombia', 'estonia', 'azerbaijan', 'canada', 'cambodia', 
  'laos', 'mexico', 'nigeria', 'pakistan', 'georgia', 'brazil'
];

// Base configuration for API requests
const API_CONFIG = {
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
};

// Guest configuration for non-authenticated endpoints
const GUEST_CONFIG = {
  headers: {
    'Accept': 'application/json'
  }
};

// Axios instance with default headers and error handling
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
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

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 1000, // 1 second
  retryAfterMs: 1000,
};

let requestCount = 0;
let windowStart = Date.now();

// Rate limiting middleware
const checkRateLimit = async (): Promise<void> => {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT.windowMs) {
    // Reset window
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= RATE_LIMIT.maxRequests) {
    // Wait until next window
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryAfterMs));
    requestCount = 0;
    windowStart = Date.now();
  }

  requestCount++;
};

// Generic function to handle API requests with rate limiting
export const handleApiResponse = async <T>(
  endpoint: string,
  method: string = 'get',
  data?: any,
  config: any = {}
): Promise<T> => {
  try {
    await checkRateLimit();
    
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers: {
        ...API_CONFIG.headers,
        ...config.headers
      },
      ...config
    });
    console.log('API Response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
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
  operator: string;
  country: string;
  expires: string;
  sms: SmsMessage[];
}

interface SmsInboxResponse {
  data: SmsMessage[];
  total: number;
}

interface ServiceProduct {
  id: string;
  name: string; // e.g., "facebook", "instagram"
  displayName: string; // e.g., "Facebook", "Instagram"
  price: number;
  quantity: number;
  operator: string; // e.g., "airtel", "vodafone"
}

interface Operator {
  id: string;
  name: string;
  displayName: string;
}

interface PriceResponse {
  [country: string]: {
    [operator: string]: {
      [service: string]: {
        cost: number;
        count: number;
      };
    };
  };
}

interface BalanceResponse {
  balance: number;
}

interface CountryInfo {
  iso: { [key: string]: number };
  prefix: { [key: string]: number };
  text_en: string;
  text_ru: string;
  [key: string]: any;
}

interface CountriesResponse {
  [key: string]: CountryInfo;
}

// API functions
export const getCountries = async () => {
  try {
    const response = await axios.get('https://5sim.net/v1/guest/countries', {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.data) {
      throw new Error('No countries available');
    }

    // Transform the response into a more usable format
    const countries = Object.entries(response.data)
      .filter(([code]) => SUPPORTED_COUNTRIES.includes(code.toLowerCase())) // Only include supported countries
      .map(([code, data]: [string, any]) => ({
        code: code.toLowerCase(), // Ensure lowercase for consistency
        name: data.text_en || code,
        iso: Object.keys(data.iso)[0],
        prefix: Object.keys(data.prefix)[0]
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

    console.log('Available countries:', countries);

    if (countries.length === 0) {
      throw new Error('No countries available');
    }

    return { countries, error: null };
  } catch (error: any) {
    console.error('Error fetching countries:', {
      error,
      response: error.response?.data,
      status: error.response?.status
    });
    const errorMessage = error.response?.data?.message || error.message;
    return {
      countries: [],
      error: errorMessage
    };
  }
};

// Helper function to normalize country input
export const normalizeCountryInput = (country: string): string => {
  const normalized = country.toLowerCase().trim();
  
  // Check if it's already a valid country code
  if (SUPPORTED_COUNTRIES.includes(normalized)) {
    return normalized;
  }
  
  // Check if there's a mapping for this country name
  const mapped = COUNTRY_MAPPING[normalized];
  if (mapped && SUPPORTED_COUNTRIES.includes(mapped)) {
    return mapped;
  }
  
  throw new Error(`Country "${country}" is not supported. Please choose from available countries.`);
};

export const getProducts = async (country: string) => {
  try {
    // Normalize the country input first
    const normalizedCountry = normalizeCountryInput(country);
    
    if (!normalizedCountry) {
      throw new Error('Country is required');
    }

    // Convert country name to lowercase and check mapping
    const countryLower = normalizedCountry.toLowerCase();
    const countryCode = COUNTRY_MAPPING[countryLower] || countryLower;

    console.log('Fetching products for country:', {
      originalCountry: country,
      countryLower,
      countryCode,
      url: `https://5sim.net/v1/guest/products/${countryCode}/any`
    });

    const response = await axios.get(`https://5sim.net/v1/guest/products/${countryCode}/any`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('API Response:', response.data);

    if (!response.data || Object.keys(response.data).length === 0) {
      throw new Error('No products available');
    }

    // Transform the response into a more usable format
    const products = Object.entries(response.data)
      .map(([name, data]: [string, any]) => ({
        id: name,
        name: name,
        category: data.Category,
        price: data.Price,
        quantity: data.Qty
      }))
      .filter(product => 
        // Only show products with available numbers and activation category
        product.quantity > 0 && 
        product.category === 'activation'
      )
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    console.log('Transformed products:', products);

    if (products.length === 0) {
      throw new Error(`No services available for ${country}`);
    }

    return { products, error: null };
  } catch (error: any) {
    console.error('Error fetching products:', {
      error,
      response: error.response?.data,
      status: error.response?.status
    });
    const errorMessage = error.response?.data?.message || error.message;
    return {
      products: [],
      error: errorMessage
    };
  }
};

export const getOperators = async (country: string, product: string) => {
  try {
    const response = await axios.get(`https://5sim.net/v1/guest/prices`, {
      params: {
        country,
        product
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data[country] || !response.data[country][product]) {
      throw new Error('No operators available for this product');
    }

    console.log('API Response:', response.data);

    const operators = Object.entries(response.data[country][product]).map(([name, data]: [string, any]) => ({
      id: name,
      name: name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      cost: data.cost,
      count: data.count,
      rate: data.rate
    }));

    return { operators, error: null };
  } catch (error) {
    console.error('Error fetching operators:', error);
    return {
      operators: [],
      error: error instanceof Error ? error.message : 'Failed to fetch operators'
    };
  }
};

export const getPrices = async ({ country }: { country?: string } = {}): Promise<any> => {
  try {
    const endpoint = '/v1/guest/prices' + (country ? `?country=${country}` : '');
    console.log('Fetching prices from:', endpoint);
    
    const response = await axios.get(endpoint, {
      ...GUEST_CONFIG,
      baseURL: API_URL
    });
    
    console.log('API Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    throw new Error('Failed to fetch prices');
  }
};

export const getServices = async (
  country: string = 'india',
  operator: string = 'any'
): Promise<ServiceProduct[]> => {
  try {
    // First get the list of countries to validate the country code
    const countries = await getCountries();
    const normalizedCountry = country.toLowerCase();
    
    // Check if the country exists in the available countries
    if (!countries[normalizedCountry]) {
      throw new Error(`Country "${country}" is not supported. Please choose from available countries.`);
    }

    const normalizedOperator = operator.toLowerCase();
    console.log('Fetching services for:', { country: normalizedCountry, operator: normalizedOperator });

    // Get products for the specific country
    const products = await getProducts(normalizedCountry);

    // Get operators for the specific country and product
    const operators = await getOperators(normalizedCountry, products.products[0].id);

    const services: ServiceProduct[] = products.products.map((product: any) => {
      // Only include activation services
      if (product.category !== 'activation') {
        return null;
      }

      const displayName = product.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return {
        id: product.name.toLowerCase(),
        name: product.name.toLowerCase(),
        displayName,
        quantity: product.quantity,
        price: product.price,
        operator: normalizedOperator
      };
    }).filter(Boolean) as ServiceProduct[];

    if (services.length === 0) {
      throw new Error(
        operator === 'any' 
          ? `No services available in ${country}` 
          : `No services available for ${operator} in ${country}`
      );
    }

    console.log('Found services:', services.length, 'for operator:', normalizedOperator);
    
    // Sort services by availability and price
    return services.sort((a, b) => {
      if (a.quantity === 0 && b.quantity > 0) return 1;
      if (a.quantity > 0 && b.quantity === 0) return -1;
      return a.price - b.price;
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Failed to fetch services: ${message}`);
    }
    throw error;
  }
};

export const getVirtualNumber = async (
  countryCode: string, 
  serviceCode: string,
  operator: string = 'any'
): Promise<VirtualNumber | undefined> => {
  try {
    // Validate inputs
    if (!countryCode || !serviceCode) {
      throw new Error('Invalid country code or service');
    }

    // First validate the country code against available countries
    const countries = await getCountries();
    const normalizedCountry = countryCode.toLowerCase();
    
    if (!countries[normalizedCountry]) {
      throw new Error(`Country "${countryCode}" is not supported. Please choose from available countries.`);
    }

    const normalizedOperator = operator.toLowerCase();
    const normalizedService = serviceCode.toLowerCase();

    // Check balance before purchase
    const balance = await getBalance();
    if (!balance || balance.balance <= 0) {
      throw new Error('Insufficient balance');
    }

    console.log('Purchasing number with:', { 
      country: normalizedCountry, 
      operator: normalizedOperator, 
      service: normalizedService 
    });

    const data = await handleApiResponse<VirtualNumber>(
      `/user/buy/activation/${normalizedCountry}/${normalizedOperator}/${normalizedService}`,
      'get',
      undefined,
      API_CONFIG
    );

    // Validate response
    if (!data || !data.phone) {
      throw new Error('Invalid response from server');
    }

    // Start monitoring the order status immediately
    retryGetSmsCode(data.id, 30, 5000).catch(error => {
      console.error('Failed to monitor order status:', error);
    });

    return data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      const message = error.response.data?.message || '';
      if (message.includes('no free phones')) {
        throw new Error(`No numbers available for ${serviceCode} with ${operator}. Please try another operator or service.`);
      } else if (message.includes('no product')) {
        throw new Error(`Service "${serviceCode}" is not supported in ${countryCode}`);
      } else if (message.includes('no country')) {
        throw new Error(`Country "${countryCode}" is not supported`);
      } else if (message.includes('bad country')) {
        throw new Error(`Invalid country code: ${countryCode}. Please use a valid country code.`);
      } else if (message.includes('bad operator')) {
        throw new Error(`Invalid operator: ${operator}. Please use a valid operator.`);
      }
    }
    console.error('Failed to get virtual number:', error);
    throw error;
  }
};

export const getSmsCode = async (id: string): Promise<OrderResponse | undefined> => {
  try {
    const data = await handleApiResponse<OrderResponse>(`/user/check/${id}`, 'get');
    
    // Add additional status checks
    if (data) {
      // Check for timeout
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const timeDiff = (now.getTime() - createdAt.getTime()) / 1000; // in seconds
      
      if (timeDiff > 900) { // 15 minutes timeout
        data.status = OrderStatus.TIMEOUT;
      }
      
      // Check if SMS is received
      if (data.sms && data.sms.length > 0) {
        data.status = OrderStatus.RECEIVED;
      }
    }
    
    return data;
  } catch (error: any) {
    console.error('Failed to get SMS code:', error);
    throw error;
  }
};

export const reactivateOrder = async (orderId: number): Promise<OrderResponse | undefined> => {
  try {
    return await handleApiResponse<OrderResponse>(`/user/reactivate/${orderId}`, 'get');
  } catch (error: any) {
    console.error('Failed to reactivate order:', error);
    throw error;
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

    console.log('API Response:', response.data);

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

    console.log('API Response:', response.data);

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

// Retry mechanism for SMS check
export const retryGetSmsCode = async (
  orderId: string, 
  maxRetries: number = 30,
  intervalMs: number = 5000
): Promise<OrderResponse | undefined> => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await getSmsCode(orderId);
      
      if (response) {
        // If we got an SMS or the order is in a final state, return immediately
        if (
          response.sms?.length > 0 ||
          response.status === OrderStatus.CANCELED ||
          response.status === OrderStatus.BANNED ||
          response.status === OrderStatus.TIMEOUT
        ) {
          return response;
        }
      }
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      retries++;
    } catch (error) {
      console.error(`Retry ${retries + 1}/${maxRetries} failed:`, error);
      throw error;
    }
  }
  
  throw new Error('Max retries reached while waiting for SMS');
};