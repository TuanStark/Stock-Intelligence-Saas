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

// Custom strongly-typed API Error class extending Error to avoid printing empty object {} in logs
export class ApiError extends Error {
  success: boolean;
  error: {
    code?: string;
    message: string;
  };
  meta?: any;

  constructor(errorData: any) {
    const message = errorData.error?.message || 'An unexpected error occurred';
    super(message);
    this.name = 'ApiError';
    this.success = errorData.success ?? false;
    this.error = errorData.error || { message };
    this.meta = errorData.meta;

    // Capture stack trace in environments where it is supported (V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, ApiError);
    }
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Standardized error handler response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized (401), attempt silent token refresh first
    if (
      typeof window !== 'undefined' &&
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !window.location.pathname.startsWith('/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            originalRequest._retry = true;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = await getSession();
        const refreshToken = (session as any)?.refreshToken;

        if (refreshToken) {
          // Perform silent token rotation on the backend API
          const res = await axios.post(
            (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1') + '/auth/refresh',
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );

          if (res.data?.success && res.data?.data) {
            const { accessToken, refreshToken: newRefreshToken } = res.data.data;

            // Dynamically update the client-side NextAuth session
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trigger: 'update',
                accessToken,
                refreshToken: newRefreshToken,
              }),
            });

            isRefreshing = false;
            onRefreshed(accessToken);

            // Retry the original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Silent token refresh failed:', refreshError);
      } finally {
        isRefreshing = false;
      }

      // If refresh failed or there is no refresh token, sign out
      import('next-auth/react').then(({ signOut }) => {
        signOut({ callbackUrl: '/login?error=SessionExpired' });
      });
    }

    // Format response errors uniformly
    const errorData = error.response?.data || {
      success: false,
      error: {
        message: error.message || 'An unexpected network error occurred',
      },
    };

    return Promise.reject(new ApiError(errorData));
  }
);
