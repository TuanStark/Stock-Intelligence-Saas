/**
 * Safely access the API URL at runtime.
 * Works both on the server (reads process.env) and on the client (reads window.ENV injected by layout).
 */
export const getApiUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).ENV?.NEXT_PUBLIC_API_URL) {
    return (window as any).ENV.NEXT_PUBLIC_API_URL;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3006/api/v1";
};
