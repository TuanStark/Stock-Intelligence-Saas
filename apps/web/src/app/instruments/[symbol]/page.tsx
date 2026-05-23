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
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { marketApi } from '@/lib/api/market.api';

interface Signal {
  id: string;
  type: string;
  strength: string;
  score: number;
  explanation: string;
  detectedAt: string;
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <Loader2 size={40} className="pulse" style={{ color: 'var(--color-accent)' }} />
        <p style={{ color: 'var(--text-secondary)' }} className="font-outfit">{t('stockDetail.loading')}</p>
      </div>
    );
  }

  if (errorMsg || !instrument) {
    return (
      <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <AlertTriangle size={48} style={{ color: 'var(--color-bearish)', margin: '0 auto 16px auto' }} />
          <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Analysis Terminal Locked</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
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
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
      backgroundImage: 'radial-gradient(at 0% 0%, hsla(220, 90%, 56%, 0.03) 0px, transparent 50%)'
    }}>
      {/* Floating dynamic language selector */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button 
          onClick={() => setLocale('vi')}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: locale === 'vi' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            background: locale === 'vi' ? 'var(--color-accent-bg)' : 'transparent',
            color: locale === 'vi' ? 'var(--color-accent)' : 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          VI
        </button>
        <button 
          onClick={() => setLocale('en')}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: locale === 'en' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            background: locale === 'en' ? 'var(--color-accent-bg)' : 'transparent',
            color: locale === 'en' ? 'var(--color-accent)' : 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          EN
        </button>
      </div>

      {/* HEADER: Nav Back */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/')}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> {t('common.back')}
        </button>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('sidebar.systemStatus')}</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{instrument.symbol} Terminal</span>
      </header>

      {/* BLOCK 1: Stock Heading Detail & Real-time Quote */}
      <div className="responsive-grid-1-5-1" style={{ marginBottom: '24px' }}>
        {/* Name and sector */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
          <h1 className="font-outfit title-gradient" style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            {instrument.symbol}
            <span className="badge badge-bullish" style={{ marginLeft: '12px', fontSize: '11px', padding: '2px 8px', letterSpacing: '0.05em' }}>LIVE TICK</span>
          </h1>
          <h2 style={{ fontSize: '18px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '12px' }}>
            {instrument.name}
          </h2>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> {instrument.industry || 'Capital Markets'}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> HOSE Exchange
            </span>
          </div>
        </div>

        {/* Pricing quotes */}
        {latestQuote && (
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Real-time Quote</p>
              <h3 className="font-outfit" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {Number(latestQuote.price).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>VND</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Source: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{latestQuote.source}</span> • {new Date(latestQuote.timestamp).toLocaleTimeString()}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'}`} style={{ padding: '6px 12px', fontSize: '14px' }}>
                {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {isUp ? '+' : ''}{(Number(latestQuote.changePercent) * 100).toFixed(2)}%
              </span>
              <p style={{ fontWeight: 600, color: isUp ? 'var(--color-bullish)' : 'var(--color-bearish)', fontSize: '16px' }}>
                {isUp ? '+' : ''}{Number(latestQuote.change).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BLOCK 2: Stock Technical Chart & AI Thesis Summary */}
      <div className="responsive-grid-2-1" style={{ marginBottom: '24px' }}>

        {/* Left: TradingView Chart */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' }}>
          <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--color-accent)' }} />
            Candlestick Price Stream (60 Trading Days)
          </h3>
          <div ref={chartContainerRef} style={{ width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}></div>
        </div>

        {/* Right: AI In-depth Thesis Summary */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--border-color)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={18} style={{ color: 'var(--color-warning)' }} />
              {t('stockDetail.aiThesis')}
            </h3>
            {aiSummary && !aiLoading && (
              <button 
                onClick={handleTriggerAi}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--color-warning)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
                title="Làm mới phân tích AI"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          {aiMessage && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: 'var(--radius-sm)',
              color: '#f87171',
              fontSize: '12px',
              textAlign: 'center',
              lineHeight: 1.4
            }}>
              {aiMessage}
            </div>
          )}

          {aiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }} className="animate-pulse">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="glass-panel" style={{ width: '120px', height: '24px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: 'none' }}></div>
                <div className="glass-panel" style={{ width: '80px', height: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: 'none' }}></div>
              </div>
              <div className="glass-panel" style={{
                padding: '24px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(245, 158, 11, 0.02)',
                border: '1px dashed rgba(245, 158, 11, 0.15)',
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                minHeight: '140px'
              }}>
                <Loader2 className="animate-spin text-amber-500" size={28} style={{ color: 'var(--color-warning)' }} />
                <div>
                  <p className="font-outfit" style={{ fontWeight: 600, color: 'var(--color-warning)', fontSize: '14px', marginBottom: '4px' }}>AI đang phân tích dữ liệu...</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Đang nén các chỉ số RSI/MACD & tin tức mới</p>
                </div>
              </div>
              <div className="responsive-grid-1-1" style={{ gap: '12px', marginTop: 'auto' }}>
                <div className="glass-panel" style={{ height: '70px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}></div>
                <div className="glass-panel" style={{ height: '70px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}></div>
              </div>
            </div>
          ) : aiSummary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' :
                    aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-accent'
                  }`} style={{ padding: '4px 10px' }}>
                  AI Sentiment: {aiSummary.sentiment}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('stockDetail.aiConfidence')}: {Math.round(Number(aiSummary.confidence) * 100)}%
                </span>
              </div>

              <div className="glass-panel" style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsla(35, 90%, 52%, 0.05)',
                border: '1px solid hsla(35, 90%, 52%, 0.12)',
                lineHeight: 1.6,
                fontSize: '14px',
                color: 'var(--text-secondary)'
              }}>
                <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '6px' }}>Decision Thesis</p>
                {aiSummary.summary}
              </div>

              {/* Drivers & Risks Grid */}
              <div className="responsive-grid-1-1" style={{ gap: '12px', marginTop: 'auto' }}>
                <div className="glass-panel" style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.04)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <p style={{ color: 'var(--color-bullish)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Catalysts</p>
                  <ul style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Array.isArray(aiSummary.drivers) ? aiSummary.drivers.slice(0, 3).map((d, i) => (
                      <li key={i}>{d}</li>
                    )) : <li>Volume expansion</li>}
                  </ul>
                </div>

                <div className="glass-panel" style={{ padding: '12px', backgroundColor: 'rgba(244, 63, 94, 0.04)', borderColor: 'rgba(244, 63, 94, 0.1)' }}>
                  <p style={{ color: 'var(--color-bearish)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>Risk Factors</p>
                  <ul style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Array.isArray(aiSummary.risks) ? aiSummary.risks.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    )) : <li>Market friction</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              padding: '30px 10px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              gap: '16px'
            }}>
              <div className="glass-panel" style={{
                padding: '16px',
                borderRadius: '50%',
                backgroundColor: 'hsla(35, 90%, 52%, 0.03)',
                border: '1px solid hsla(35, 90%, 52%, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={36} style={{ color: 'var(--color-warning)' }} className="animate-pulse" />
              </div>
              <div>
                <h4 className="font-outfit" style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                  Chưa có Luận điểm Phân tích AI
                </h4>
                <p style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto' }}>
                  Yêu cầu AI tổng hợp giá, tín hiệu kỹ thuật & tin tức của {instrument?.symbol || symbol} để xuất bản luận điểm đầu tư chuyên sâu.
                </p>
              </div>
              
              <button
                onClick={handleTriggerAi}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-warning)',
                  color: '#0f172a',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 0 12px hsla(35, 90%, 52%, 0.25)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 0 18px hsla(35, 90%, 52%, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 0 12px hsla(35, 90%, 52%, 0.25)';
                }}
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
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' }}>
            <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} style={{ color: 'var(--color-accent)' }} />
              {t('stockDetail.financials')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.open')}</span>
                <span style={{ fontWeight: 600 }}>{Number(latestQuote.open).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.high')}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-bullish)' }}>{Number(latestQuote.high).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.low')}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-bearish)' }}>{Number(latestQuote.low).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.prevClose')}</span>
                <span style={{ fontWeight: 600 }}>{Number(latestQuote.previousClose).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} VND</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.volume')}</span>
                <span style={{ fontWeight: 600 }}>{Number(latestQuote.volume).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('stockDetail.value')}</span>
                <span style={{ fontWeight: 600 }}>{Number(latestQuote.value).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Right: Technical Signals Crossover Log */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' }}>
          <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--color-warning)' }} />
            {t('stockDetail.signalsLog')}
          </h3>

          {signals.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
              No signal logs recorded for this equity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {signals.map((sig) => (
                <div key={sig.id} className="glass-panel" style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {sig.explanation || `Crossover detected via indicator`}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Detected on {new Date(sig.detectedAt).toLocaleDateString()} at {new Date(sig.detectedAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge ${sig.type === 'BUY' ? 'badge-bullish' : 'badge-bearish'}`}>
                      {sig.type}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
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
