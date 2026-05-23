export interface SummaryJobPayload {
    instrumentId: string;
    symbol: string;
}

export interface AiSummaryResponse {
    summary: string;
    sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
    confidence: number;
    drivers: string[];
    risks: string[];
}

export interface ProcessedSummaryResult {
    status: 'success' | 'skipped' | 'fallback';
    summaryId?: string;
    reason?: string;
    fallback?: boolean;
}

export interface ContextData {
    latestQuote?: any;
    activeSignals: any[];
    recentNews: any[];
}