import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_5SIM_API_URL || 'https://5sim.net/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lang } = req.query;
  
  if (!lang || (lang !== 'en' && lang !== 'ru')) {
    return res.status(400).json({ error: 'Language parameter is required and must be either "en" or "ru"' });
  }

  try {
    console.log(`Server-side fetching notifications for language: ${lang}`);
    
    const response = await axios.get(`${API_URL}/guest/flash/${lang}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Server-side notifications response received');

    if (!response.data) {
      throw new Error('No data received from notifications API');
    }

    return res.status(200).json(response.data);
    
  } catch (error: any) {
    console.error('Server-side error fetching notifications:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch notifications',
      details: error.message || 'Unknown error'
    });
  }
} 