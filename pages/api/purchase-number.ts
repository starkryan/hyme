import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

// Helper function to normalize country input
const normalizeCountryInput = (country: string): string => {
  const normalized = country.toLowerCase().trim();
  
  // Special cases for England/UK
  if (normalized === 'england' || normalized === 'uk' || normalized === 'united kingdom' || normalized === 'great britain') {
    return 'england';  // Use 'england' instead of 'gb' for the API
  }

  return normalized;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { country, service, operator } = req.query;

  if (!country || typeof country !== 'string') {
    return res.status(400).json({ error: 'Country parameter is required' });
  }

  if (!service || typeof service !== 'string') {
    return res.status(400).json({ error: 'Service parameter is required' });
  }

  if (!operator || typeof operator !== 'string') {
    return res.status(400).json({ error: 'Operator parameter is required' });
  }

  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Server-side purchasing number for ${service} in ${normalizedCountry} with operator ${operator}`);

    // First check if there are any pending orders
    try {
      const ordersResponse = await axios.get(`${API_URL}/user/orders`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (ordersResponse.data) {
        const orders = ordersResponse.data;
        console.log('Server-side current orders:', orders);
        
        // Only consider orders from the last hour as pending
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const pendingOrders = orders.filter((order: any) => 
          order.status === 'PENDING' && 
          new Date(order.created_at) > oneHourAgo
        );
        
        if (pendingOrders.length > 0) {
          console.log('Server-side found pending orders:', pendingOrders);
          return res.status(400).json({ 
            error: 'You have pending orders. Please complete or cancel them before purchasing a new number.',
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.warn('Server-side failed to check pending orders:', error);
      // Continue with purchase attempt even if checking pending orders fails
    }

    // Check if the service is available with the specified operator
    const productsUrl = `${API_URL}/guest/products/${normalizedCountry}/${operator}`;
    console.log('Server-side checking product availability:', productsUrl);

    const productsResponse = await axios.get(productsUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!productsResponse.data) {
      return res.status(400).json({ 
        error: `Operator ${operator} is not available in ${country}`, 
        created_at: new Date().toISOString() 
      });
    }

    const products = productsResponse.data;
    const serviceInfo = products[service];

    if (!serviceInfo) {
      return res.status(400).json({ 
        error: `Service "${service}" is not available with operator ${operator} in ${country}`, 
        created_at: new Date().toISOString() 
      });
    }

    if (serviceInfo.Qty === 0) {
      return res.status(400).json({ 
        error: `No numbers available for ${service} with operator ${operator} in ${country}`, 
        created_at: new Date().toISOString() 
      });
    }

    // Check user balance
    try {
      const balanceResponse = await axios.get(`${API_URL}/user/profile`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      if (balanceResponse.data) {
        const balanceData = balanceResponse.data;
        console.log('Server-side user balance:', balanceData.balance, 'Service price:', serviceInfo.Price);
        
        // Convert both to numbers and compare with a small buffer for fees
        const balance = Number(balanceData.balance);
        const price = Number(serviceInfo.Price);
        
        if (isNaN(balance) || isNaN(price)) {
          console.error('Server-side invalid balance or price:', { balance, price });
          return res.status(400).json({ 
            error: 'Invalid balance or price values', 
            created_at: new Date().toISOString() 
          });
        }

        if (balance < price) {
          return res.status(400).json({ 
            error: `Insufficient balance. Service cost is ${price} but your balance is ${balance}`,
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Server-side failed to check balance against service price:', error);
    }

    // Now purchase the number
    const purchaseUrl = `${API_URL}/user/buy/activation/${normalizedCountry}/${operator}/${service}`;
    console.log('Server-side purchasing number:', purchaseUrl);

    const purchaseResponse = await axios.get(purchaseUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    // Log the full purchase response for debugging
    console.log('Server-side purchase response:', {
      status: purchaseResponse.status,
      statusText: purchaseResponse.statusText
    });

    if (!purchaseResponse.data) {
      return res.status(500).json({ 
        error: 'Invalid response from server', 
        created_at: new Date().toISOString() 
      });
    }

    const data = purchaseResponse.data;
    console.log('Server-side purchase response data:', data);

    if (!data.phone) {
      return res.status(500).json({ 
        error: 'Invalid response from server - missing phone number', 
        created_at: new Date().toISOString() 
      });
    }

    return res.status(200).json({
      phone: data.phone,
      id: data.id.toString(),
      created_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Server-side error getting virtual number:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    // Handle specific error cases
    if (error.response && error.response.status === 400) {
      const message = error.response.data?.message || '';
      
      if (message.includes('no free phones')) {
        return res.status(400).json({ 
          error: `No numbers available for ${service} with ${operator}. Please try another operator or service.`, 
          created_at: new Date().toISOString() 
        });
      } else if (message.includes('no product')) {
        return res.status(400).json({ 
          error: `Service "${service}" is not supported with operator ${operator} in ${country}`, 
          created_at: new Date().toISOString() 
        });
      } else if (message.includes('no country')) {
        return res.status(400).json({ 
          error: `Country "${country}" is not supported`, 
          created_at: new Date().toISOString() 
        });
      } else if (message.includes('not enough user balance')) {
        return res.status(400).json({ 
          error: 'Insufficient balance. Please add funds to your wallet.', 
          created_at: new Date().toISOString() 
        });
      } else if (message.includes('bad operator')) {
        return res.status(400).json({ 
          error: `Invalid operator: ${operator}. Please choose from the available operators.`, 
          created_at: new Date().toISOString() 
        });
      } else if (message.includes('pending activation')) {
        return res.status(400).json({ 
          error: 'You have a pending activation. Please complete or cancel it before purchasing a new number.', 
          created_at: new Date().toISOString() 
        });
      }
    }

    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || error.message || 'Failed to get virtual number',
      created_at: new Date().toISOString()
    });
  }
} 