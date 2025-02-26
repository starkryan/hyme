import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';

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

  const { country } = req.query;

  if (!country || typeof country !== 'string') {
    return res.status(400).json({ error: 'Country parameter is required' });
  }

  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Server-side fetching products for country: ${country} (normalized: ${normalizedCountry})`);

    const url = `${API_URL}/guest/products/${normalizedCountry}/any`;
    console.log(`Server-side API URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('Server-side products API response received');

    if (!response.data) {
      throw new Error('No data received from products API');
    }

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Server-side error fetching products:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    // Handle 404 and 400 errors specifically
    if (error.response) {
      if (error.response.status === 404) {
        return res.status(404).json({ 
          error: 'No products available for this country.' 
        });
      }
      if (error.response.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid country code. Please try a different country.' 
        });
      }
    }

    return res.status(500).json({ 
      error: 'Failed to fetch products. Please try again later.',
      details: error.message || 'Unknown error'
    });
  }
} 