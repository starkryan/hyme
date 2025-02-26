import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Server-side fetching user orders');
    
    const response = await axios.get(`${API_URL}/user/orders`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log('Server-side user orders API response received');

    if (!response.data) {
      throw new Error('No data received from user orders API');
    }

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Server-side error fetching user orders:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch user orders',
      details: error.message || 'Unknown error'
    });
  }
} 