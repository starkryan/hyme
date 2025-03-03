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

  console.log(`[API] Attempting to cancel order with ID: ${id}`);

  try {
    const cancelUrl = `${API_URL}/user/cancel/${id}`;
    console.log(`[API] Making request to 5sim: ${cancelUrl}`);
    
    const response = await axios.get(cancelUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log(`[API] 5sim cancel response status: ${response.status}`);
    console.log(`[API] 5sim cancel response data:`, response.data);

    if (!response.data) {
      throw new Error('No data received from cancel order API');
    }

    console.log(`[API] Successfully cancelled order ${id}`);
    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error(`[API] Error cancelling order ${id}:`, error.message);
    
    // Log more details about the error
    if (error.response) {
      console.error(`[API] Error status: ${error.response.status}`);
      console.error(`[API] Error data:`, error.response.data);
    }
    
    // Check if the error is "order not found" which means it's already in a final state
    const errorDetails = error.response?.data;
    const errorMessage = typeof errorDetails === 'string' 
      ? errorDetails 
      : errorDetails?.message || error.message;
    
    console.log(`[API] Extracted error message: ${errorMessage}`);
    
    if (errorMessage?.includes('order not found')) {
      console.log(`[API] Order ${id} not found - returning successful cancellation`);
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
      
      console.log(`[API] 400 error for order ${id} - ${errorMessage}`);
      return res.status(400).json({ 
        error: 'Order cannot be cancelled',
        details: errorMessage,
        reason: 'SMS_RECEIVED'
      });
    }

    console.error(`[API] Returning error for order ${id}`);
    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to cancel order',
      details: error.message || 'Unknown error'
    });
  }
} 