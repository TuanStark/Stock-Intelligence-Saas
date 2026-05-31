import { apiClient } from './api-client';

export const authApi = {
  register: async (email: string, password: string): Promise<any> => {
    return apiClient.post('/auth/register', { email, password });
  },
  login: async (email: string, password: string): Promise<any> => {
    return apiClient.post('/auth/login', { email, password });
  },
  googleLogin: async (idToken: string): Promise<any> => {
    return apiClient.post('/auth/google', { idToken });
  },
  upgradeSubscription: async (tier: string): Promise<any> => {
    return apiClient.post('/subscription/upgrade', { tier });
  },
};
