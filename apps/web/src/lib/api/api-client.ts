import axios from 'axios';
import { getSession } from 'next-auth/react';

// Centrally configured Axios HTTP client for StockIntel
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatic request interceptor to inject bearer token
apiClient.interceptors.request.use(
  async (config) => {
    // Only attempt to retrieve session in browser environments
    if (typeof window !== 'undefined') {
      const session = await getSession();
      if (session && (session as any).accessToken) {
        config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Standardized error handler response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Format response errors uniformly
    const errorData = error.response?.data || {
      success: false,
      error: {
        message: error.message || 'An unexpected network error occurred',
      },
    };
    return Promise.reject(errorData);
  }
);
