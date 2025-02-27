import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';
const API_KEY = process.env.NEXT_PUBLIC_5SIM_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key exists
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Order ID parameter is required' });
  }

  try {
    // Removed console.log for deployment
    
    const response = await axios.get(`${API_URL}/user/cancel/${id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    // Removed console.log for deployment

    if (!response.data) {
      throw new Error('No data received from cancel order API');
    }

    return res.status(200).json(response.data);
    
  } catch (error: any) {
    // Removed detailed console.error for deployment
    
    // Check if the error is "order not found" which means it's already in a final state
    const errorDetails = error.response?.data;
    const errorMessage = typeof errorDetails === 'string' 
      ? errorDetails 
      : errorDetails?.message || error.message;
    
    if (errorMessage?.includes('order not found')) {
      // For "order not found" errors, return a success response
      // since this is not really an error from the user's perspective
      return res.status(200).json({ 
        id: parseInt(id),
        status: "CANCELED",
        message: "Order was already processed"
      });
    }

    // Specific handling for 400 errors (likely SMS already received or order in final state)
    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.message || 
                          'Order cannot be cancelled, possibly because SMS was already received';
      
      return res.status(400).json({ 
        error: 'Order cannot be cancelled',
        details: errorMessage,
        reason: 'SMS_RECEIVED'
      });
    }

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to cancel order',
      details: error.message || 'Unknown error'
    });
  }
} 