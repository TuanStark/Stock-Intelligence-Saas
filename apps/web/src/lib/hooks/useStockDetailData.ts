import { useState, useEffect } from 'react';
import { marketApi } from '@/lib/api/market.api';
import { personalizationApi } from '@/lib/api/personalization.api';

export interface Signal {
  id: string;
  symbol: string;
  type: string;
  strength: string;
  score: number;
  value: number | null;
  explanation: string;
  detectedAt: string;
  indicator: string;
}

export interface Quote {
  price: string;
  change: string;
  changePercent: string;
  open: string;
  high: string;
  low: string;
  previousClose: string;
  volume: string;
  value: string;
  source: string;
  timestamp: string;
}

export interface Instrument {
  symbol: string;
  name: string;
  industry: string;
  currency: string;
}

export interface AiSummary {
  summary: string;
  sentiment: string; // BULLISH / BEARISH / NEUTRAL
  confidence: string;
  drivers: string[];
  risks: string[];
}

export function useStockDetailData(symbol: string | undefined, t: (key: string) => string) {
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [latestQuote, setLatestQuote] = useState<Quote | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  const loadData = async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const resData = await marketApi.getDetail(symbol);

      if (resData.success && resData.data) {
        setInstrument(resData.data.instrument);
        setLatestQuote(resData.data.latestQuote);
        setSignals(resData.data.signals || []);
        setAiSummary(resData.data.aiSummary);

        // Fire personalization tracking activity event (fire-and-forget)
        personalizationApi.trackActivity('VIEW_STOCK', symbol).catch(() => { });
      } else {
        setErrorMsg(t('stockDetail.notFound'));
      }
    } catch (err: any) {
      console.error('Error fetching stock detail:', err);
      setErrorMsg('Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [symbol]);

  const handleTriggerAi = async () => {
    if (!symbol) return;
    try {
      setAiLoading(true);
      setAiMessage('');
      const res = await marketApi.triggerAiSummary(symbol);

      if (res && res.success) {
        let attempts = 0;
        const maxAttempts = 10;
        const intervalId = setInterval(async () => {
          attempts++;
          try {
            const resData = await marketApi.getDetail(symbol);
            if (resData.success && resData.data && resData.data.aiSummary) {
              setAiSummary(resData.data.aiSummary);
              setAiLoading(false);
              clearInterval(intervalId);
            }
          } catch (err) {
            console.error('Error polling AI summary:', err);
          }

          if (attempts >= maxAttempts) {
            setAiLoading(false);
            setAiMessage('Quá trình phân tích mất nhiều thời gian hơn dự kiến. Vui lòng refresh lại trang sau ít phút!');
            clearInterval(intervalId);
          }
        }, 2000);
      } else {
        setAiLoading(false);
        setAiMessage(res?.message || 'Không thể yêu cầu phân tích AI lúc này.');
        setTimeout(() => setAiMessage(''), 5000);
      }
    } catch (err) {
      console.error('Failed to trigger AI summary:', err);
      setAiLoading(false);
      setAiMessage('Không thể kết nối đến máy chủ để phân tích AI.');
      setTimeout(() => setAiMessage(''), 5000);
    }
  };

  return {
    instrument,
    latestQuote,
    signals,
    aiSummary,
    loading,
    errorMsg,
    aiLoading,
    aiMessage,
    setLatestQuote,
    handleTriggerAi,
    refetch: loadData,
  };
}
