'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Activity,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { marketApi } from '@/lib/api/market.api';
import { personalizationApi } from '@/lib/api/personalization.api';

interface Signal {
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

interface Quote {
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

interface Instrument {
  symbol: string;
  name: string;
  industry: string;
  currency: string;
}

interface AiSummary {
  summary: string;
  sentiment: string; // BULLISH / BEARISH / NEUTRAL
  confidence: string;
  drivers: string[];
  risks: string[];
}

export default function StockDetail() {
  const { symbol } = useParams();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Data State
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [latestQuote, setLatestQuote] = useState<Quote | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // AI manual trigger states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // TradingView Chart State
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Real-time chart bar tracking
  const latestBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  // Active On-Demand AI generation with real-time database polling
  const handleTriggerAi = async () => {
    if (!symbol) return;
    try {
      setAiLoading(true);
      setAiMessage('');
      const res = await marketApi.triggerAiSummary(symbol as string);

      if (res && res.success) {
        let attempts = 0;
        const maxAttempts = 10; // Poll for 20 seconds maximum
        const intervalId = setInterval(async () => {
          attempts++;
          try {
            const resData = await marketApi.getDetail(symbol as string);
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

  // 1. Fetch stock detailed data
  useEffect(() => {
    if (!symbol) return;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg('');
        const resData = await marketApi.getDetail(symbol as string);

        if (resData.success && resData.data) {
          setInstrument(resData.data.instrument);
          setLatestQuote(resData.data.latestQuote);
          setSignals(resData.data.signals || []);
          setAiSummary(resData.data.aiSummary);

          // E2E Tracking Event: Fire-and-forget activity capture
          personalizationApi.trackActivity('VIEW_STOCK', symbol as string).catch(() => { });
        } else {
          setErrorMsg(t('stockDetail.notFound'));
        }
      } catch (err: any) {
        console.error('Error fetching stock detail:', err);
        setErrorMsg('Failed to connect to backend server.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [symbol, t]);

  // 2. Fetch candle data and render Lightweight Charts + Subscribe WebSockets
  useEffect(() => {
    if (loading || errorMsg || !chartContainerRef.current || !symbol) return;

    // A. Create Candlestick Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
      },
      timeScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
      },
      rightPriceScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
      },
      width: chartContainerRef.current.clientWidth,
      height: 380,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    async function loadCandles() {
      try {
        const resData = await marketApi.getCandles(symbol as string);
        if (resData.success && resData.data && resData.data.length > 0) {
          candlestickSeries.setData(resData.data);
          chart.timeScale().fitContent();

          // Save the latest REST candle in the ref for live updates
          const lastCandle = resData.data[resData.data.length - 1];
          latestBarRef.current = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          };
        }
      } catch (err) {
        console.error('Error loading candles:', err);
      }
    }

    loadCandles();

    // B. Setup Socket.io Real-time trade tickers connection
    const socket: Socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`🔌 WebSockets connected. Subscribing to stock: ${symbol}`);
      socket.emit('subscribe_instrument', { symbol });
    });

    socket.on('instrument_tick', (tick) => {
      // 1. Update quote metrics on UI card in real-time
      setLatestQuote((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          price: tick.price.toString(),
          change: tick.change.toString(),
          changePercent: tick.changePercent.toString(),
          timestamp: new Date(tick.timestamp).toISOString(),
        };
      });

      // 2. Feed standard daily candlestick updates
      const date = new Date(tick.timestamp);
      date.setUTCHours(0, 0, 0, 0);
      const time = Math.floor(date.getTime() / 1000);

      if (latestBarRef.current) {
        if (latestBarRef.current.time === time) {
          // Mutate today's daily bar close, high, low boundaries in real-time
          latestBarRef.current.close = tick.price;
          latestBarRef.current.high = Math.max(latestBarRef.current.high, tick.price);
          latestBarRef.current.low = Math.min(latestBarRef.current.low, tick.price);
        } else {
          // Create new day daily candle bar
          latestBarRef.current = {
            time,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
          };
        }
        candlestickSeries.update(latestBarRef.current as any);
      }
    });

    // Handle resizing
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log(`🔌 Unsubscribing and disconnecting WebSockets for symbol: ${symbol}`);
      socket.emit('unsubscribe_instrument', { symbol });
      socket.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [loading, errorMsg, symbol, t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 size={40} className="pulse text-accent" />
        <p className="font-outfit text-text-secondary">{t('stockDetail.loading')}</p>
      </div>
    );
  }

  if (errorMsg || !instrument) {
    return (
      <div className="py-[60px] px-6 flex flex-col items-center justify-center min-h-screen">
        <div className="glass-panel p-10 text-center max-w-[500px]">
          <AlertTriangle size={48} className="text-bearish mx-auto mb-4" />
          <h3 className="font-outfit text-xl font-extrabold mb-2">Analysis Terminal Locked</h3>
          <p className="text-text-secondary mb-6 text-sm leading-relaxed">
            {errorMsg}
          </p>
          <button className="btn-primary" onClick={() => router.push('/')}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const isUp = latestQuote ? Number(latestQuote.changePercent) >= 0 : true;

  return (
    <div className="max-w-[1200px] mx-auto p-6 bg-[radial-gradient(at_0%_0%,rgba(59,130,246,0.03)_0px,transparent_50%)]">
      {/* Floating dynamic language selector */}
      <div className="flex gap-2 justify-end mb-4">
        <button
          onClick={() => setLocale('vi')}
          className={`py-1 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer transition-colors border ${
            locale === 'vi' 
              ? 'border-accent bg-accent/15 text-accent' 
              : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          VI
        </button>
        <button
          onClick={() => setLocale('en')}
          className={`py-1 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer transition-colors border ${
            locale === 'en' 
              ? 'border-accent bg-accent/15 text-accent' 
              : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          EN
        </button>
      </div>

      {/* HEADER: Nav Back */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5"
        >
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <span className="text-text-muted">/</span>
        <span className="text-text-muted">{t('sidebar.systemStatus')}</span>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary font-semibold">{instrument.symbol} Terminal</span>
      </header>

      {/* BLOCK 1: Stock Heading Detail & Real-time Quote */}
      <div className="responsive-grid-1-5-1 mb-6">
        {/* Name and sector */}
        <div className="glass-panel p-6 flex flex-col justify-center border border-board-border">
          <h1 className="font-outfit title-gradient text-4xl font-extrabold tracking-tight mb-1.5">
            {instrument.symbol}
            <span className="badge badge-bullish ml-3 text-[11px] py-0.5 px-2 tracking-wider">LIVE TICK</span>
          </h1>
          <h2 className="text-lg text-text-secondary font-medium mb-3">
            {instrument.name}
          </h2>
          <div className="flex gap-3 text-[13px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <Layers size={14} /> {instrument.industry || 'Capital Markets'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> HOSE Exchange
            </span>
          </div>
        </div>

        {/* Pricing quotes */}
        {latestQuote && (
          <div className="glass-panel p-6 flex justify-between items-center border border-board-border">
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Real-time Quote</p>
              <h3 className="font-outfit text-3xl font-extrabold text-text-primary tracking-tight">
                {Number(latestQuote.price).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <span className="text-sm text-text-muted">VND</span>
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Source: <span className="font-semibold text-text-secondary">{latestQuote.source}</span> • {new Date(latestQuote.timestamp).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'} py-1.5 px-3 text-sm`}>
                {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {isUp ? '+' : ''}{(Number(latestQuote.changePercent) * 100).toFixed(2)}%
              </span>
              <p className={`font-semibold text-base ${isUp ? 'text-bullish' : 'text-bearish'}`}>
                {isUp ? '+' : ''}{Number(latestQuote.change).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BLOCK 2: Stock Technical Chart & AI Thesis Summary */}
      <div className="responsive-grid-2-1 mb-6">

        {/* Left: TradingView Chart */}
        <div className="glass-panel p-6 flex flex-col gap-4 border border-board-border">
          <h3 className="font-outfit text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            {t('common.title1')}
          </h3>
          <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden"></div>
        </div>

        {/* Right: AI In-depth Thesis Summary */}
        <div className="glass-panel p-6 flex flex-col gap-5 border border-board-border relative">
          <div className="flex items-center justify-between">
            <h3 className="font-outfit text-lg font-bold flex items-center gap-2 m-0">
              <Sparkles size={18} className="text-warning" />
              {t('stockDetail.aiThesis')}
            </h3>
            {aiSummary && !aiLoading && (
              <button
                onClick={handleTriggerAi}
                className="bg-white/5 border border-white/10 text-warning cursor-pointer p-1.5 rounded-md flex items-center justify-center hover:bg-warning/10 hover:border-warning/30 transition-all duration-200 outline-none"
                title="Làm mới phân tích AI"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          {aiMessage && (
            <div className="py-2.5 px-3.5 bg-red-500/5 border border-red-500/15 rounded-md text-red-400 text-xs text-center leading-relaxed">
              {aiMessage}
            </div>
          )}

          {aiLoading ? (
            <div className="flex flex-col gap-4 flex-grow animate-pulse">
              <div className="flex justify-between items-center">
                <div className="glass-panel w-[120px] h-6 bg-white/5 rounded-[4px] border-none"></div>
                <div className="glass-panel w-20 h-4 bg-white/5 rounded-[4px] border-none"></div>
              </div>
              <div className="glass-panel py-6 px-4 rounded-lg bg-warning/5 border border-dashed border-warning/15 flex-grow flex flex-col gap-3 justify-center items-center text-center min-h-[140px]">
                <Loader2 className="animate-spin text-warning" size={28} />
                <div>
                  <p className="font-outfit font-semibold text-warning text-sm mb-1">AI đang phân tích dữ liệu...</p>
                  <p className="text-[11px] text-text-muted">Đang nén các chỉ số RSI/MACD & tin tức mới</p>
                </div>
              </div>
              <div className="responsive-grid-1-1 gap-3 mt-auto">
                <div className="glass-panel h-[70px] bg-white/2 border border-white/4"></div>
                <div className="glass-panel h-[70px] bg-white/2 border border-white/4"></div>
              </div>
            </div>
          ) : aiSummary ? (
            <div className="flex flex-col gap-4 flex-grow">
              <div className="flex justify-between items-center">
                <span className={`badge ${aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' :
                  aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-accent'
                  } py-1 px-2.5`}>
                  AI Sentiment: {aiSummary.sentiment}
                </span>
                <span className="text-xs text-text-muted">
                  {t('stockDetail.aiConfidence')}: {Math.round(Number(aiSummary.confidence) * 100)}%
                </span>
              </div>

              <div className="glass-panel p-4 rounded-lg bg-warning/5 border border-warning/10 leading-relaxed text-sm text-text-secondary">
                <p className="font-semibold text-warning mb-1.5">Decision Thesis</p>
                {aiSummary.summary}
              </div>

              {/* Drivers & Risks Grid */}
              <div className="responsive-grid-1-1 gap-3 mt-auto">
                <div className="glass-panel p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <p className="text-bullish font-bold text-[11px] uppercase tracking-wider mb-2">Catalysts</p>
                  <ul className="text-[11px] text-text-secondary pl-3 flex flex-col gap-1.5 list-disc">
                    {Array.isArray(aiSummary.drivers) ? aiSummary.drivers.slice(0, 3).map((d, i) => (
                      <li key={i}>{d}</li>
                    )) : <li>Volume expansion</li>}
                  </ul>
                </div>

                <div className="glass-panel p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                  <p className="text-bearish font-bold text-[11px] uppercase tracking-wider mb-2">Risk Factors</p>
                  <ul className="text-[11px] text-text-secondary pl-3 flex flex-col gap-1.5 list-disc">
                    {Array.isArray(aiSummary.risks) ? aiSummary.risks.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    )) : <li>Market friction</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center flex-grow py-8 px-2.5 text-text-muted text-center gap-4">
              <div className="glass-panel p-4 rounded-full bg-warning/5 border border-warning/10 flex items-center justify-center">
                <Sparkles size={36} className="text-warning animate-pulse" />
              </div>
              <div>
                <h4 className="font-outfit text-text-primary text-sm font-semibold mb-1.5">
                  Chưa có Luận điểm Phân tích AI
                </h4>
                <p className="text-xs leading-relaxed max-w-[280px] mx-auto">
                  Yêu cầu AI tổng hợp giá, tín hiệu kỹ thuật & tin tức của {instrument?.symbol || symbol} để xuất bản luận điểm đầu tư chuyên sâu.
                </p>
              </div>

              <button
                onClick={handleTriggerAi}
                className="py-2.5 px-[18px] rounded-lg bg-warning text-slate-900 border-none font-bold text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_12px_hsla(35,90%,52%,0.25)] hover:-translate-y-0.5 hover:shadow-[0_0_18px_hsla(35,90%,52%,0.4)] transition-all duration-200"
              >
                <Sparkles size={14} />
                Yêu cầu AI phân tích {instrument?.symbol || symbol}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* BLOCK 3: Market Stats & Signals History */}
      <div className="responsive-grid-1-2-2">

        {/* Left: Financial Fundamentals */}
        {latestQuote && (
          <div className="glass-panel p-6 flex flex-col gap-4 border border-board-border">
            <h3 className="font-outfit text-lg font-bold flex items-center gap-2">
              <DollarSign size={18} className="text-accent" />
              {t('stockDetail.financials')}
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between border-b border-board-border pb-2 text-sm">
                <span className="text-text-muted">{t('stockDetail.open')}</span>
                <span className="font-semibold">{Number(latestQuote.open).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div className="flex justify-between border-b border-board-border pb-2 text-sm">
                <span className="text-text-muted">{t('stockDetail.high')}</span>
                <span className="font-semibold text-bullish">{Number(latestQuote.high).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div className="flex justify-between border-b border-board-border pb-2 text-sm">
                <span className="text-text-muted">{t('stockDetail.low')}</span>
                <span className="font-semibold text-bearish">{Number(latestQuote.low).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div className="flex justify-between border-b border-board-border pb-2 text-sm">
                <span className="text-text-muted">{t('stockDetail.prevClose')}</span>
                <span className="font-semibold">{Number(latestQuote.previousClose).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div className="flex justify-between border-b border-board-border pb-2 text-sm">
                <span className="text-text-muted">{t('stockDetail.volume')}</span>
                <span className="font-semibold">{Number(latestQuote.volume).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
              <div className="flex justify-between pb-1 text-sm">
                <span className="text-text-muted">{t('stockDetail.value')}</span>
                <span className="font-semibold">{Number(latestQuote.value).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Right: Technical Signals Crossover Log */}
        <div className="glass-panel p-6 flex flex-col gap-4 border border-board-border">
          <h3 className="font-outfit text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-warning" />
            {t('stockDetail.signalsLog')}
          </h3>

          {signals.length === 0 ? (
            <div className="flex justify-center items-center flex-grow text-text-muted text-sm">
              No signal logs recorded for this equity.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {signals.map((sig) => (
                <div key={sig.id} className="glass-panel py-3.5 px-4 rounded-lg bg-surface flex items-center justify-between border border-board-border hover:border-text-muted transition-colors duration-200">
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">
                      {sig.explanation || `Crossover detected via indicator`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      Detected on {new Date(sig.detectedAt).toLocaleDateString()} at {new Date(sig.detectedAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`badge ${sig.type === 'BUY' ? 'badge-bullish' : 'badge-bearish'}`}>
                      {sig.type}
                    </span>
                    <span className="text-xs text-text-muted font-semibold">
                      Score: {Number(sig.score).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
