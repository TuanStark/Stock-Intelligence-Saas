import { apiClient } from './api-client';

export const marketApi = {
  getOverview: async (): Promise<any> => {
    return apiClient.get('/market/overview');
  },
  search: async (query: string): Promise<any> => {
    return apiClient.get(`/market/instruments/search?q=${encodeURIComponent(query)}`);
  },
  getDetail: async (symbol: string): Promise<any> => {
    return apiClient.get(`/market/instruments/${symbol.toUpperCase()}`);
  },
  getCandles: async (symbol: string): Promise<any> => {
    return apiClient.get(`/market/instruments/${symbol.toUpperCase()}/candles`);
  },
  getSignals: async (type?: string): Promise<any> => {
    const url = type && type !== 'ALL' ? `/market/signals?type=${type}` : '/market/signals';
    return apiClient.get(url);
  },
  triggerAiSummary: async (symbol: string): Promise<any> => {
    return apiClient.post(`/market/instruments/${symbol.toUpperCase()}/ai-summary`, {});
  },
  getFinancials: async (symbol: string): Promise<any> => {
    return apiClient.get(`/market/instruments/${symbol.toUpperCase()}/financials`);
  },
};
