import { z } from 'zod';

// ==========================================
// INTERNAL NORMALIZED CONTRACTS
// All provider adapters MUST return these formats
// ==========================================

export const NormalizedQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  previousClose: z.number(),
  volume: z.number(),
  value: z.number().optional(), // Trading value in VND
  timestamp: z.date(),
  asOf: z.date(),
  source: z.string(), // e.g. "VNSTOCK", "FIREANT"
});

export type NormalizedQuote = z.infer<typeof NormalizedQuoteSchema>;

export const NormalizedCandleSchema = z.object({
  symbol: z.string(),
  timestamp: z.date(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  resolution: z.enum(['1D', '1W', '1M', '15m', '1h']),
});

export type NormalizedCandle = z.infer<typeof NormalizedCandleSchema>;

export const NormalizedCompanySchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string(), // HOSE, HNX, UPCOM
  industry: z.string().optional(),
  marketCap: z.number().optional(),
  pe: z.number().optional(),
  pb: z.number().optional(),
  eps: z.number().optional(),
  outstandingShares: z.number().optional(),
});

export type NormalizedCompany = z.infer<typeof NormalizedCompanySchema>;
