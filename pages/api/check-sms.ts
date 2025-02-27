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

  // Validate that API key is available
  if (!API_KEY) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'API key is not configured'
    });
  }

  try {
    const response = await axios.get(`${API_URL}/user/check/${id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      },
      // Add timeout to prevent hanging requests
      timeout: 10000
    });

    // Check if response content type is JSON
    const contentType = response.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      return res.status(500).json({ 
        error: 'Invalid response from 5SIM API',
        details: `Expected JSON but received ${contentType}`
      });
    }

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
    // Handle specific error cases
    
    // Check if this is an HTML response
    if (
      error.response?.headers?.['content-type']?.includes('text/html') || 
      (typeof error.response?.data === 'string' && error.response.data.includes('<!DOCTYPE'))
    ) {
      return res.status(500).json({ 
        error: 'Authentication error with 5SIM API',
        details: 'Received HTML instead of JSON. Please check API credentials.'
      });
    }
    
    // Check if the error is "order not found" which means it might be already in a final state
    const errorDetails = error.response?.data;
    const errorMessage = typeof errorDetails === 'string' 
      ? errorDetails 
      : errorDetails?.message || error.message;
    
    if (errorMessage?.includes('order not found')) {
      // For "order not found" errors, return a structured response
      return res.status(200).json({ 
        id: parseInt(id),
        status: "FINISHED",
        message: "Order not found or already completed"
      });
    }

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to check SMS status',
      details: error.message || 'Unknown error'
    });
  }
} 