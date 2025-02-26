import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Server-side fetching countries from:', `${API_URL}/guest/countries`);
    
    const response = await axios.get(`${API_URL}/guest/countries`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Server-side countries API response received');

    if (!response.data) {
      throw new Error('No data received from countries API');
    }

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Server-side error fetching countries:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(500).json({ 
      error: 'Failed to fetch countries',
      details: error.message || 'Unknown error'
    });
  }
} 