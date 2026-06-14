export interface Signal {
  id: string;
  symbol: string;
  type: string; // BUY / SELL
  indicator: string;
  price?: number;
  score?: number;
  strength?: string;
  reason: string;
  detectedAt: string;
}

export interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  latestSignal: Signal | null;
}

export interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  exchange: { code: string };
  signals: Signal[];
}

export interface AlertRule {
  id: string;
  symbol: string;
  name: string;
  type: string;
  threshold: number;
  enabled: boolean;
}

export interface AlertEvent {
  id: string;
  symbol: string;
  type: string;
  threshold: number;
  triggeredValue: number;
  triggeredAt: string;
  status: string;
}
