import axios, { AxiosError, AxiosInstance } from 'axios';

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

export interface Product {
  service: string;
  category: string;
  quantity: number;
  price: number;
  name: string;
  id: string;
}

export interface VirtualNumberOrder {
  id: string;
  phone: string;
  operator: string;
  product: string;
  price: number;
  status: string;
  expires: string;
  sms: any[];
  country: string;
}

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
  (error: AxiosError<ApiErrorResponse>) => {
    handleAxiosError(error);
    return Promise.reject(error);
  }
);

// Add custom error interface
interface ApiErrorResponse {
  message?: string;
  [key: string]: any;
}

// Update error handling function
const handleAxiosError = (error: AxiosError<ApiErrorResponse>, customMessage: string = 'API Error'): void => {
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
    console.error('Non-Axios Error:', error);
    throw new Error(`${customMessage}: ${(error as Error).message}`);
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


interface ServiceData {
  cost: number;
  count: number;
}

interface OperatorServices {
  [service: string]: ServiceData;
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


// Add better error handling for OTP verification
interface OtpVerificationResult {
  success: boolean;
  message: string;
  phone?: string;
  orderId?: string;
  code?: string;
  status?: OrderStatus;
  expiresAt?: Date;
}



// Add interface for operator info
export interface OperatorInfo {
  id: string;
  name: string;
  displayName: string;
  cost: number;
  count: number;
  rate: number;
  supportedCountries?: string[];
}

// Interface for operator pricing information
interface OperatorPricing {
  quantity: number;
  price: number;
  error?: string;
}

// API functions
export const getCountries = async () => {
  try {
    console.log('Fetching countries from API route');
    
    // Use relative URL to our own API route instead of external API
    const response = await axios.get('/api/countries', {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Countries API Response:', response.data);

    if (!response.data) {
      throw new Error('No data received from countries API');
    }

    // Transform the data into the expected format
    const transformedCountries = Object.entries(response.data).reduce((acc: any, [code, data]: [string, any]) => {
      if (data && typeof data === 'object') {
        acc[code] = {
          code,
          name: data.text_en || code,
          iso: Object.keys(data.iso || {})[0] || '',
          prefix: Object.keys(data.prefix || {})[0] || ''
        };
      }
      return acc;
    }, {});

    if (Object.keys(transformedCountries).length === 0) {
      throw new Error('No countries available after transformation');
    }

    console.log('Transformed countries:', transformedCountries);

    return { 
      countries: transformedCountries,
      error: null 
    };
  } catch (error: any) {
    console.error('Error fetching countries:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return {
      countries: {},
      error: error.message || 'Failed to fetch countries'
    };
  }
};

// Helper function to normalize country input
export const normalizeCountryInput = (country: string): string => {
  const normalized = country.toLowerCase().trim();
  
  // Special cases for England/UK
  if (normalized === 'england' || normalized === 'uk' || normalized === 'united kingdom' || normalized === 'great britain') {
    return 'england';  // Use 'england' instead of 'gb' for the API
  }

  return normalized;
};

export const getProducts = async (country: string): Promise<{ products: Product[]; error?: string }> => {
  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Fetching products for country: ${country} (normalized: ${normalizedCountry})`);

    const url = `https://5sim.net/v1/guest/products/${normalizedCountry}/any`;
    console.log(`API URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { products: [], error: 'No products available for this country.' };
      }
      if (response.status === 400) {
        return { products: [], error: 'Invalid country code. Please try a different country.' };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Transform the data into our Product type
    const products = Object.entries(data)
      .filter(([_, value]: [string, any]) => value.Category === 'activation' && value.Qty > 0)
      .map(([service, value]: [string, any]) => ({
        service,
        category: value.Category,
        quantity: value.Qty,
        price: value.Price,
        name: service,
        id: service
      }))
      .sort((a, b) => b.quantity - a.quantity);

    console.log(`Found ${products.length} products`);
    return { products };

  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      products: [],
      error: 'Failed to fetch products. Please try again later.'
    };
  }
};

export const getOperators = async (
  country: string,
  service: string
): Promise<{ operators: OperatorInfo[]; error?: string }> => {
  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Getting operators for ${service} in ${normalizedCountry}`);

    // First get the country data to find available operators
    const response = await fetch(`${API_URL}/guest/countries`);
    if (!response.ok) {
      throw new Error('Failed to fetch country data');
    }

    const countriesData = await response.json();
    console.log('Countries data:', countriesData);

    // Find the specific country data
    const countryData = countriesData[normalizedCountry];
    if (!countryData) {
      throw new Error(`Country ${country} not found`);
    }

    // Initialize operators array
    const operators: OperatorInfo[] = [];

    // Parse operators from country data
    for (const [key, value] of Object.entries(countryData)) {
      // Check if this is an operator entry (has activation property)
      if (typeof value === 'object' && value !== null && 'activation' in value) {
        const operatorId = key;
        
        // Format operator name for display - just use the number after 'virtual'
        const displayName = operatorId.match(/virtual(\d+)/)?.[1] || operatorId;

        // Now get the prices for this operator
        const pricesUrl = `${API_URL}/guest/products/${normalizedCountry}/${operatorId}`;
        console.log('Fetching prices for operator:', pricesUrl);

        const pricesResponse = await fetch(pricesUrl);
        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json();
          const serviceData = pricesData[service];

          if (serviceData && serviceData.Qty > 0) {
            operators.push({
              id: operatorId,
              name: operatorId,
              displayName: `Operator ${displayName}`,
              cost: serviceData.Price,
              count: serviceData.Qty,
              rate: 85 // Standard success rate for specific operators
            });
          }
        }
      }
    }

    // Also check 'any' operator availability
    const anyUrl = `${API_URL}/guest/products/${normalizedCountry}/any`;
    const anyResponse = await fetch(anyUrl);

    if (anyResponse.ok) {
      const anyData = await anyResponse.json();
      if (anyData && anyData[service] && anyData[service].Qty > 0) {
        operators.unshift({
          id: 'any',
          name: 'any',
          displayName: 'Any Operator',
          cost: anyData[service].Price,
          count: anyData[service].Qty,
          rate: 90 // Higher success rate for 'any' operator
        });
      }
    }

    // Log the operators we found
    console.log('Found operators:', operators);

    if (operators.length === 0) {
      console.log('No operators found with available numbers');
      return {
        operators: [],
        error: `No operators available for ${service} in ${country}`
      };
    }

    // Sort operators by availability and price (keeping 'any' first)
    operators.sort((a, b) => {
      if (a.name === 'any') return -1;
      if (b.name === 'any') return 1;
      if (a.count === b.count) return a.cost - b.cost;
      return b.count - a.count;
    });

    return { operators };

  } catch (error) {
    console.error('Error getting operators:', error);
    return {
      operators: [],
      error: error instanceof Error ? error.message : 'Failed to get operators'
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

    const normalizedCountry = country.toLowerCase();
    
   

    const normalizedOperator = operator.toLowerCase();
    console.log('Fetching services for:', { country: normalizedCountry, operator: normalizedOperator });

    // Get products for the specific country
    const products = await getProducts(normalizedCountry);

    // Get operators for the specific country and product

    const services: ServiceProduct[] = products.products.map((product: any) => {
      // Only include activation services
      if (product.category !== 'activation') {
        return null;
      }

      const displayName = product.name
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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
  country: string,
  service: string,
  operator: string = 'any'
): Promise<{
  created_at: string; phone?: string; id?: string; error?: string 
}> => {
  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Getting virtual number for ${service} in ${normalizedCountry} with operator ${operator}`);

    // First check if there are any pending orders
    try {
      const response = await fetch(`${API_URL}/user/orders`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (response.ok) {
        const orders = await response.json();
        console.log('Current orders:', orders);
        
        // Only consider orders from the last hour as pending
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const pendingOrders = orders.filter((order: any) => 
          order.status === 'PENDING' && 
          new Date(order.created_at) > oneHourAgo
        );
        
        if (pendingOrders.length > 0) {
          console.log('Found pending orders:', pendingOrders);
          return { error: 'You have pending orders. Please complete or cancel them before purchasing a new number.', created_at: new Date().toISOString() };
        }
      }
    } catch (error) {
      console.warn('Failed to check pending orders:', error);
    }

    // Check if the service is available with the specified operator
    const productsUrl = `${API_URL}/guest/products/${normalizedCountry}/${operator}`;
    console.log('Checking product availability:', productsUrl);

    const productsResponse = await fetch(productsUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!productsResponse.ok) {
      const errorData = await productsResponse.json().catch(() => ({}));
      console.error('Products API Error:', {
        status: productsResponse.status,
        statusText: productsResponse.statusText,
        error: errorData
      });
      return { error: `Operator ${operator} is not available in ${country}`, created_at: new Date().toISOString() };
    }

    const products = await productsResponse.json();
    const serviceInfo = products[service];

    if (!serviceInfo) {
      return { error: `Service "${service}" is not available with operator ${operator} in ${country}`, created_at: new Date().toISOString() };
    }

    if (serviceInfo.Qty === 0) {
      return { error: `No numbers available for ${service} with operator ${operator} in ${country}`, created_at: new Date().toISOString() };
    }

    // Check user balance
    try {
      const balanceResponse = await fetch(`${API_URL}/user/profile`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        console.log('User balance:', balanceData.balance, 'Service price:', serviceInfo.Price);
        
        // Convert both to numbers and compare with a small buffer for fees
        const balance = Number(balanceData.balance);
        const price = Number(serviceInfo.Price);
        
        if (isNaN(balance) || isNaN(price)) {
          console.error('Invalid balance or price:', { balance, price });
          return { error: 'Invalid balance or price values', created_at: new Date().toISOString() };
        }

        if (balance < price) {
          return { 
            error: `Insufficient balance. Service cost is ${price} but your balance is ${balance}`,
            created_at: new Date().toISOString()
          };
        }
      } else {
        console.error('Balance check failed:', await balanceResponse.text());
      }
    } catch (error) {
      console.error('Failed to check balance against service price:', error);
    }

    // Now purchase the number
    const purchaseUrl = `${API_URL}/user/buy/activation/${normalizedCountry}/${operator}/${service}`;
    console.log('Purchasing number:', purchaseUrl);

    const purchaseResponse = await fetch(purchaseUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    // Log the full purchase response for debugging
    console.log('Purchase Response:', {
      status: purchaseResponse.status,
      statusText: purchaseResponse.statusText,
      headers: Object.fromEntries(purchaseResponse.headers.entries())
    });

    if (!purchaseResponse.ok) {
      let errorData;
      try {
        errorData = await purchaseResponse.json();
      } catch (e) {
        errorData = { message: purchaseResponse.statusText };
      }

      console.error('Purchase API Error:', {
        status: purchaseResponse.status,
        statusText: purchaseResponse.statusText,
        error: errorData
      });

      // Handle specific error cases
      if (purchaseResponse.status === 400) {
        const message = errorData.message || '';
        if (message.includes('no free phones')) {
          return { error: `No numbers available for ${service} with ${operator}. Please try another operator or service.`, created_at: new Date().toISOString() };
        } else if (message.includes('no product')) {
          return { error: `Service "${service}" is not supported with operator ${operator} in ${country}`, created_at: new Date().toISOString() };
        } else if (message.includes('no country')) {
          return { error: `Country "${country}" is not supported`, created_at: new Date().toISOString() };
        } else if (message.includes('not enough user balance')) {
          return { error: 'Insufficient balance. Please add funds to your wallet.', created_at: new Date().toISOString() };
        } else if (message.includes('bad operator')) {
          return { error: `Invalid operator: ${operator}. Please choose from the available operators.`, created_at: new Date().toISOString() };
        } else if (message.includes('pending activation')) {
          return { error: 'You have a pending activation. Please complete or cancel it before purchasing a new number.', created_at: new Date().toISOString() };
        }
      }

      return { 
        error: errorData.message || 'Failed to purchase virtual number',
        created_at: new Date().toISOString() 
      };
    }

    let data;
    try {
      data = await purchaseResponse.json();
      console.log('Purchase response data:', data);
    } catch (e) {
      console.error('Error parsing purchase response:', e);
      return { error: 'Invalid response from server', created_at: new Date().toISOString() };
    }

    if (!data || !data.phone) {
      console.error('Invalid response data:', data);
      return { error: 'Invalid response from server - missing phone number', created_at: new Date().toISOString() };
    }

    return {
      phone: data.phone,
      id: data.id.toString(),
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting virtual number:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get virtual number. Please try again later.',
      created_at: new Date().toISOString()
    };
  }
};

export const getSmsCode = async (id: string): Promise<OrderResponse | undefined> => {
  try {
    const response = await fetch(`${API_URL}/user/check/${id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if SMS is received
    if (data.sms && data.sms.length > 0) {
      data.status = OrderStatus.RECEIVED;
      return data;
    }
    
    // Check for timeouts if we have created_at
    if (data.created_at) {
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const timeDiffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      
      // No SMS timeout after 5 minutes (300 seconds)
      if (timeDiffSeconds > 300) {
        data.status = OrderStatus.TIMEOUT;
        return data;
      }
      
      // Maximum order timeout after 15 minutes (900 seconds)
      if (timeDiffSeconds > 900) {
        data.status = OrderStatus.TIMEOUT;
        return data;
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
  intervalMs: number = 10000
): Promise<OrderResponse | undefined> => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`Checking SMS - Attempt ${retries + 1}/${maxRetries}`);
      const response = await getSmsCode(orderId);
      
      if (!response) {
        console.log('No response from API, retrying...');
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        retries++;
        continue;
      }

      console.log('API Response:', {
        status: response.status,
        hasSms: response.sms?.length > 0,
        createdAt: response.created_at
      });
      
      // If we got an SMS or the order is in a final state, return immediately
      if (
        response.sms?.length > 0 ||
        response.status === OrderStatus.CANCELED ||
        response.status === OrderStatus.BANNED ||
        response.status === OrderStatus.TIMEOUT ||
        response.status === OrderStatus.FINISHED
      ) {
        return response;
      }
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      retries++;
    } catch (error) {
      console.error(`Retry ${retries + 1}/${maxRetries} failed:`, error);
      // On error, wait a bit longer before retrying
      await new Promise(resolve => setTimeout(resolve, intervalMs * 2));
      retries++;
    }
  }
  
  throw new Error('Max retries reached while waiting for SMS');
};

// Add new verification-specific functions
export const initiateVerification = async (
  countryCode: string,
  service: string = 'any'
): Promise<OtpVerificationResult> => {
  try {
    const normalizedCountry = normalizeCountryInput(countryCode);
    
    // Get virtual number
    const result = await getVirtualNumber(normalizedCountry, service);
    
    if (!result.phone) {
      throw new Error(result.error || 'Failed to get virtual number');
    }

    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    return {
      success: true,
      message: 'Verification initiated successfully',
      phone: result.phone,
      orderId: result.id,
      status: OrderStatus.PENDING,
      expiresAt
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to initiate verification'
    };
  }
};

// Add function to check OTP status with timeout handling
export const checkOtpStatus = async (
  orderId: string,
  timeoutSeconds: number = 300
): Promise<OtpVerificationResult> => {
  try {
    const response = await retryGetSmsCode(orderId, 30, 5000);
    
    if (!response) {
      throw new Error('Failed to check OTP status');
    }

    // Check if order has timed out
    const createdAt = new Date(response.created_at);
    const now = new Date();
    const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    if (elapsedSeconds > timeoutSeconds) {
      return {
        success: false,
        message: 'OTP verification timed out',
        status: OrderStatus.TIMEOUT
      };
    }

    // Check if we received the SMS
    if (response.sms && response.sms.length > 0) {
      const latestSms = response.sms[response.sms.length - 1];
      return {
        success: true,
        message: 'OTP code received',
        code: latestSms.code,
        phone: response.phone,
        status: OrderStatus.RECEIVED
      };
    }

    return {
      success: true,
      message: 'Waiting for OTP code',
      status: response.status,
      phone: response.phone
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to check OTP status'
    };
  }
};

// Add function to complete verification process
export const completeVerification = async (
  orderId: string,
  action: 'finish' | 'cancel' | 'ban'
): Promise<OtpVerificationResult> => {
  try {
    let response;
    
    switch (action) {
      case 'finish':
        response = await finishOrder(Number(orderId));
        break;
      case 'cancel':
        response = await cancelOrder(Number(orderId));
        break;
      case 'ban':
        response = await banOrder(Number(orderId));
        break;
    }

    if (!response) {
      throw new Error(`Failed to ${action} verification`);
    }

    return {
      success: true,
      message: `Verification ${action}ed successfully`,
      status: response.status
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || `Failed to ${action} verification`
    };
  }
};

export const checkActivation = async (orderId: string): Promise<{ status?: string; code?: string; error?: string }> => {
  try {
    console.log(`Checking activation status for order: ${orderId}`);
    const url = `https://5sim.net/v1/guest/check/${orderId}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Order not found.' };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Activation status:', data);

    // Check if we have received the SMS code
    if (data.sms && data.sms.length > 0) {
      const latestSms = data.sms[data.sms.length - 1];
      return {
        status: data.status,
        code: latestSms.code
      };
    }

    return {
      status: data.status
    };

  } catch (error) {
    console.error('Error checking activation:', error);
    return {
      error: 'Failed to check activation status. Please try again.'
    };
  }
};

export const waitForCode = async (orderId: string, maxAttempts: number = 30, interval: number = 5000): Promise<{ code?: string; error?: string }> => {
  try {
    console.log(`Starting to wait for SMS code for order: ${orderId}`);
    console.log(`Will check ${maxAttempts} times with ${interval}ms interval`);

    for (let i = 0; i < maxAttempts; i++) {
      const result = await checkActivation(orderId);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.code) {
        console.log('SMS code received!');
        return { code: result.code };
      }

      console.log(`Attempt ${i + 1}/${maxAttempts}: No code yet, status: ${result.status}`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for SMS code');
  } catch (error) {
    console.error('Error waiting for code:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get SMS code'
    };
  }
};

// Function to find the best operator based on price and success rate
export const findBestOperator = async (
  country: string,
  service: string,
  maxPrice?: number
): Promise<{ operator: OperatorInfo | null; error?: string }> => {
  try {
    const { operators, error } = await getOperators(country, service);
    
    if (error || !operators.length) {
      return { 
        operator: null, 
        error: error || 'No operators available' 
      };
    }

    // Filter operators by max price if specified
    let availableOperators = operators;
    if (maxPrice) {
      availableOperators = operators.filter(op => op.cost <= maxPrice);
      if (!availableOperators.length) {
        return {
          operator: null,
          error: `No operators available within price limit of ${maxPrice}`
        };
      }
    }

    // Score each operator based on:
    // - Success rate (50% weight)
    // - Price (30% weight)
    // - Availability (20% weight)
    const scoredOperators = availableOperators.map(op => {
      const successScore = (op.rate / 100) * 0.5;
      const priceScore = (1 - (op.cost / Math.max(...availableOperators.map(o => o.cost)))) * 0.3;
      const availabilityScore = (op.count / Math.max(...availableOperators.map(o => o.count))) * 0.2;
      
      return {
        ...op,
        totalScore: successScore + priceScore + availabilityScore
      };
    });

    // Sort by total score and get the best operator
    scoredOperators.sort((a, b) => b.totalScore - a.totalScore);
    return { operator: scoredOperators[0] };

  } catch (error) {
    console.error('Error finding best operator:', error);
    return {
      operator: null,
      error: error instanceof Error ? error.message : 'Failed to find best operator'
    };
  }
};

export const getOperatorPricing = async (
  country: string,
  operator: string,
  service: string
): Promise<OperatorPricing> => {
  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Fetching pricing for ${service} with ${operator} in ${normalizedCountry}`);

    const url = `${API_URL}/guest/products/${normalizedCountry}/${operator}`;
    console.log('API URL:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Check if the service exists in the response
    if (!data[service]) {
      return {
        quantity: 0,
        price: 0,
        error: `Service ${service} not available for this operator`
      };
    }

    return {
      quantity: data[service].Qty || 0,
      price: data[service].Price || 0
    };

  } catch (error) {
    console.error('Error fetching operator pricing:', error);
    return {
      quantity: 0,
      price: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch pricing'
    };
  }
};