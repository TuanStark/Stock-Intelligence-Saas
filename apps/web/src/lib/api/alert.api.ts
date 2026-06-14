import { apiClient } from "./api-client";

export const alertApi = {
  getAlerts: async (): Promise<any> => {
    return apiClient.get("/alerts");
  },
  createAlert: async (
    symbol: string,
    type: string,
    threshold: number,
  ): Promise<any> => {
    return apiClient.post("/alerts", { symbol, type, threshold });
  },
  deleteAlert: async (id: string): Promise<any> => {
    return apiClient.delete(`/alerts/${id}`);
  },
};
