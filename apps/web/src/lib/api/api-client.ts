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

// Helper to generate HMAC SHA-256 signature natively using browser Web Crypto API
async function generateSignature(
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  body: any,
  baseURL: string
): Promise<string> {
  const secret = process.env.NEXT_PUBLIC_API_SIGN_SECRET || 'stockintel-secret-hmac-key-2026';
  const normalizedMethod = method.toUpperCase();

  // Extract path from url to match backend req.originalUrl exactly
  let path = url;
  if (!url.startsWith('http')) {
    let prefix = '';
    if (baseURL.startsWith('http')) {
      try {
        prefix = new URL(baseURL).pathname;
      } catch {}
    } else {
      prefix = baseURL;
    }
    const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const cleanUrl = url.startsWith('/') ? url : '/' + url;
    path = cleanPrefix + cleanUrl;
  } else {
    try {
      const urlObj = new URL(url);
      path = urlObj.pathname + urlObj.search;
    } catch {}
  }

  // Consistent body representation
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const signString = `${normalizedMethod}:${path}:${timestamp}:${nonce}:${bodyStr}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signString);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Automatic request interceptor to inject bearer token and HMAC signature headers
apiClient.interceptors.request.use(
  async (config) => {
    // Only attempt to retrieve session in browser environments
    if (typeof window !== 'undefined') {
      const session = await getSession();
      if (session && (session as any).accessToken) {
        config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
      }

      // Generate request signature to protect API from crawlers and bot attacks
      try {
        const timestamp = Date.now().toString();
        // Generate a cryptographically secure random nonce
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        const nonce = Array.from(array).map((num) => num.toString(16)).join('');

        const signature = await generateSignature(
          config.method || 'GET',
          config.url || '',
          timestamp,
          nonce,
          config.data,
          config.baseURL || ''
        );

        config.headers['x-signature'] = signature;
        config.headers['x-timestamp'] = timestamp;
        config.headers['x-nonce'] = nonce;
      } catch (sigError) {
        console.error('Failed to generate request signature:', sigError);
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

// Helper to decrypt AES-256-GCM encrypted payload natively using browser Web Crypto API
async function decryptPayload(ivHex: string, contentHex: string, tagHex: string): Promise<any> {
  const secret = process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY || 'stockintel-aes-key-must-be-32bytes';
  const encoder = new TextEncoder();

  // Hash secret key to exactly 32 bytes (256 bits) to match backend sha256 hashing
  const keyHash = await window.crypto.subtle.digest('SHA-256', encoder.encode(secret));

  // Helper to parse hex strings to Uint8Array
  const hexToUint8 = (hex: string) => {
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
  };

  const iv = hexToUint8(ivHex);
  const content = hexToUint8(contentHex);
  const tag = hexToUint8(tagHex);

  // Combine ciphertext content and auth tag (Web Crypto expects ciphertext and tag concatenated)
  const combined = new Uint8Array(content.length + tag.length);
  combined.set(content);
  combined.set(tag, content.length);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    cryptoKey,
    combined
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// Standardized error handler response interceptor supporting automatic AES-256-GCM decryption
apiClient.interceptors.response.use(
  async (response) => {
    // If the response is marked as encrypted, automatically decrypt it in-memory
    if (response.headers?.['x-encrypted'] === 'true' && response.data) {
      try {
        const { iv, content, tag } = response.data;
        const decryptedData = await decryptPayload(iv, content, tag);
        return decryptedData;
      } catch (decError) {
        console.error('Failed to decrypt response payload:', decError);
        return Promise.reject(new ApiError({
          success: false,
          error: { message: 'Failed to decrypt secure API payload' }
        }));
      }
    }
    return response.data;
  },
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
                session: {
                  accessToken,
                  refreshToken: newRefreshToken,
                },
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
