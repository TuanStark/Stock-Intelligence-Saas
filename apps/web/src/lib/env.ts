export const getApiUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).ENV?.NEXT_PUBLIC_API_URL) {
    return (window as any).ENV.NEXT_PUBLIC_API_URL;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3006/api/v1";
};

export const getInternalApiUrl = (): string => {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3006/api/v1"
    );
  }
  return getApiUrl();
};
