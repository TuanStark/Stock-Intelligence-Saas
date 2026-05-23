import { apiClient } from './api-client';

export const watchlistApi = {
  getItems: async (): Promise<any> => {
    return apiClient.get('/watchlist');
  },
  addItem: async (symbol: string): Promise<any> => {
    return apiClient.post('/watchlist/items', { symbol });
  },
  removeItem: async (symbol: string): Promise<any> => {
    return apiClient.delete(`/watchlist/items/${symbol.toUpperCase()}`);
  },
};
