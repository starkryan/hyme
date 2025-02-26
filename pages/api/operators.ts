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

  const { country, service } = req.query;

  if (!country || typeof country !== 'string') {
    return res.status(400).json({ error: 'Country parameter is required' });
  }

  if (!service || typeof service !== 'string') {
    return res.status(400).json({ error: 'Service parameter is required' });
  }

  try {
    const normalizedCountry = normalizeCountryInput(country);
    console.log(`Server-side getting operators for ${service} in ${normalizedCountry}`);

    // First fetch countries to validate the country code
    console.log('Fetching countries for validation');
    const response = await axios.get(`${API_URL}/guest/countries`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.data) {
      throw new Error('No data received from countries API');
    }

    const countriesData = response.data;
    
    // Find the specific country data
    const countryData = countriesData[normalizedCountry];
    if (!countryData) {
      return res.status(404).json({ error: `Country ${country} not found` });
    }

    // Initialize operators array
    const operators = [];

    // Parse operators from country data
    for (const [key, value] of Object.entries(countryData)) {
      // Check if this is an operator entry (has activation property)
      if (typeof value === 'object' && value !== null && 'activation' in value) {
        const operatorId = key;
        
        // Format operator name for display - just use the number after 'virtual'
        const displayName = operatorId.match(/virtual(\d+)/)?.[1] || operatorId;

        // Now get the prices for this operator
        const pricesUrl = `${API_URL}/guest/products/${normalizedCountry}/${operatorId}`;
        console.log('Server-side fetching prices for operator:', pricesUrl);

        try {
          const pricesResponse = await axios.get(pricesUrl, {
            headers: {
              'Accept': 'application/json'
            }
          });

          if (pricesResponse.data) {
            const pricesData = pricesResponse.data;
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
        } catch (error) {
          console.error(`Error fetching prices for operator ${operatorId}:`, error);
          // Continue with other operators
        }
      }
    }

    // Also check 'any' operator availability
    const anyUrl = `${API_URL}/guest/products/${normalizedCountry}/any`;
    try {
      const anyResponse = await axios.get(anyUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (anyResponse.data) {
        const anyData = anyResponse.data;
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
    } catch (error) {
      console.error('Error fetching prices for "any" operator:', error);
    }

    // Log the operators we found
    console.log(`Server-side found ${operators.length} operators`);

    if (operators.length === 0) {
      return res.status(404).json({
        error: `No operators available for ${service} in ${country}`
      });
    }

    // Sort operators by availability and price (keeping 'any' first)
    operators.sort((a, b) => {
      if (a.name === 'any') return -1;
      if (b.name === 'any') return 1;
      if (a.count === b.count) return a.cost - b.cost;
      return b.count - a.count;
    });

    return res.status(200).json({ operators });

  } catch (error: any) {
    console.error('Server-side error getting operators:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(500).json({ 
      error: 'Failed to get operators',
      details: error.message || 'Unknown error'
    });
  }
} 