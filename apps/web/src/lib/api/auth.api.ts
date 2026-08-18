import axios from "axios";
import { getInternalApiUrl } from "../env";
import { apiClient } from "./api-client";

const createServerAuthClient = () =>
  axios.create({
    baseURL: getInternalApiUrl(),
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
  });

export const authApi = {
  register: async (email: string, password: string): Promise<any> => {
    return apiClient.post("/auth/register", { email, password });
  },

  login: async (email: string, password: string): Promise<any> => {
    const client = createServerAuthClient();
    const res = await client.post("/auth/login", { email, password });
    return res.data;
  },

  googleLogin: async (idToken: string): Promise<any> => {
    const client = createServerAuthClient();
    const res = await client.post("/auth/google", { idToken });
    return res.data;
  },

  upgradeSubscription: async (
    tier: string,
    provider: string = "PAYOS",
  ): Promise<any> => {
    return apiClient.post("/subscription/upgrade", { tier, provider });
  },
  directUpgrade: async (tier: string): Promise<any> => {
    return apiClient.post("/subscription/direct-upgrade", { tier });
  },
  checkTransactionStatus: async (referenceCode: string): Promise<any> => {
    return apiClient.get(`/subscription/check-status/${referenceCode}`);
  },
};
