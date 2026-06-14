import { apiClient } from "./api-client";

export const personalizationApi = {
  /**
   * Tracks user interaction events (clicks, views, searches)
   */
  trackActivity: async (
    activityType: string,
    symbol?: string,
    sectorId?: string,
    metadata?: any,
  ): Promise<any> => {
    return apiClient.post("/personalization/track", {
      activityType,
      symbol,
      sectorId,
      metadata,
    });
  },

  /**
   * Retrieves high-relevance personalized feed recommendation items
   */
  getFeed: async (userId?: string): Promise<any> => {
    const url = userId
      ? `/personalization/feed?userId=${userId}`
      : "/personalization/feed";
    return apiClient.get(url);
  },

  /**
   * Fetches advanced HHI metrics and AI-generated advisory thesis
   */
  getPortfolioIntelligence: async (portfolioId: string): Promise<any> => {
    return apiClient.get(
      `/personalization/portfolio/${portfolioId}/intelligence`,
    );
  },
};
