import { apiClient } from './api-client';

export const authApi = {
  register: async (email: string, password: string): Promise<any> => {
    return apiClient.post('/auth/register', { email, password });
  },
  upgradeSubscription: async (tier: string): Promise<any> => {
    return apiClient.post('/subscription/upgrade', { tier });
  },
};
