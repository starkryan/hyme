import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';

// Define interfaces for type safety
interface OperatorData {
  Price: number;
  Qty: number;
  Rate?: number;
}

interface ServiceData {
  [key: string]: unknown;
  Category?: string;
  Price?: number;
  Qty?: number;
}

interface ProductsResponse {
  [key: string]: ServiceData;
}

interface CountryData {
  [key: string]: {
    activation?: boolean;
    [key: string]: any;
  };
}

interface CountriesResponse {
  [key: string]: CountryData;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { country, service, operator = 'any' } = req.query;

  if (!country || !service) {
    return res.status(400).json({ error: 'Missing required parameters: country and service are required' });
  }

  const normalizedCountry = String(country).toLowerCase();
  const normalizedOperator = String(operator).toLowerCase();

  try {
    // First fetch available operators for this country
    const operatorsResponse = await axios.get<CountriesResponse>(`${API_URL}/guest/countries`);
    const countryData = operatorsResponse.data[normalizedCountry];
    
    if (!countryData) {
      return res.status(400).json({ error: `Country ${country} not found` });
    }

    // Get valid operators for this country
    const validOperators = ['any'];
    for (const [key, value] of Object.entries(countryData)) {
      if (typeof value === 'object' && value !== null && 'activation' in value) {
        validOperators.push(key);
      }
    }

    // Validate operator
    if (!validOperators.includes(normalizedOperator)) {
      return res.status(400).json({ 
        error: `Invalid operator. Valid operators are: ${validOperators.join(', ')}` 
      });
    }

    // Check service availability
    const checkUrl = `${API_URL}/guest/products/${normalizedCountry}`;
    const checkResponse = await axios.get<ProductsResponse>(checkUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const serviceData = checkResponse.data[service as string];
    if (!serviceData) {
      return res.status(400).json({ 
        error: `Service ${service} is not available in ${country}` 
      });
    }

    // If specific operator is requested (not 'any'), verify its availability
    if (normalizedOperator !== 'any') {
      const operatorData = serviceData[normalizedOperator] as OperatorData;
      if (!operatorData || !operatorData.Price || !operatorData.Qty || operatorData.Qty === 0) {
        return res.status(400).json({ 
          error: `Operator ${normalizedOperator} is not available for ${service} in ${country}` 
        });
      }
    } else {
      // For 'any' operator, check if there are any numbers available from any operator
      let hasAvailableNumbers = false;
      for (const [key, value] of Object.entries(serviceData)) {
        if (key !== 'Category' && key !== 'Price' && key !== 'Qty') {
          const opData = value as OperatorData;
          if (opData && opData.Qty && opData.Qty > 0) {
            hasAvailableNumbers = true;
            break;
          }
        }
      }

      if (!hasAvailableNumbers) {
        return res.status(400).json({ 
          error: `No numbers available for ${service} in ${country}` 
        });
      }
    }

    // Proceed with purchase
    const purchaseUrl = `${API_URL}/guest/buy/activation/${normalizedCountry}/${normalizedOperator}/${service}`;
    
    const response = await axios.get(purchaseUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Validate response data
    if (!response.data || !response.data.phone) {
      throw new Error('Invalid response from 5SIM API');
    }

    // Add price information to the response
    const operatorPrice = normalizedOperator === 'any' 
      ? Math.min(...Object.entries(serviceData)
          .filter(([key]) => !['Category', 'Price', 'Qty'].includes(key))
          .map(([_, value]) => (value as OperatorData).Price)
          .filter(price => typeof price === 'number'))
      : (serviceData[normalizedOperator] as OperatorData).Price;

    return res.status(200).json({
      ...response.data,
      price: operatorPrice
    });

  } catch (error) {
    console.error('Error purchasing virtual number:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message;
      
      // Handle specific API error cases
      if (status === 404) {
        return res.status(404).json({ 
          error: 'No numbers available for the selected combination' 
        });
      }
      
      if (status === 400) {
        return res.status(400).json({ 
          error: message || 'Invalid request parameters' 
        });
      }
      
      return res.status(status).json({ 
        error: message || 'Failed to purchase virtual number' 
      });
    }

    return res.status(500).json({ 
      error: 'An unexpected error occurred while purchasing the virtual number' 
    });
  }
} 