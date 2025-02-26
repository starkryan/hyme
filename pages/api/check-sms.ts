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
    console.log(`Server-side checking SMS for order ID: ${id}`);
    
    const response = await axios.get(`${API_URL}/user/check/${id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('Server-side SMS check response received');

    if (!response.data) {
      throw new Error('No data received from SMS check API');
    }

    const data = response.data;
    
    // Check if SMS is received
    if (data.sms && data.sms.length > 0) {
      data.status = 'RECEIVED';
    }
    
    // Check for timeouts if we have created_at
    if (data.created_at) {
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const timeDiffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      
      // No SMS timeout after 5 minutes (300 seconds)
      if (timeDiffSeconds > 300 && (!data.sms || data.sms.length === 0)) {
        data.status = 'TIMEOUT';
      }
      
      // Maximum order timeout after 15 minutes (900 seconds)
      if (timeDiffSeconds > 900) {
        data.status = 'TIMEOUT';
      }
    }

    return res.status(200).json(data);
    
  } catch (error: any) {
    console.error('Server-side error checking SMS:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to check SMS status',
      details: error.message || 'Unknown error'
    });
  }
} 