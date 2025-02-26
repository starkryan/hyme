import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Order ID parameter is required' });
  }

  try {
    console.log(`Server-side checking SMS inbox for order ID: ${id}`);
    
    const response = await axios.get(`${API_URL}/user/sms/inbox/${id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('Server-side SMS inbox check response received');

    if (!response.data) {
      throw new Error('No data received from SMS inbox API');
    }

    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Server-side error checking SMS inbox:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to check SMS inbox',
      details: error.message || 'Unknown error'
    });
  }
} 