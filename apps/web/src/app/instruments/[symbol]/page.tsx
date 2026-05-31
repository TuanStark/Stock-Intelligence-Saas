'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Loader2,
  ChevronRight,
  CalendarRange
} from 'lucide-react';

// Custom Hooks & Centralized Helpers
import { useStockDetailData } from '@/lib/hooks/useStockDetailData';
import { useStockWebSocket } from '@/lib/hooks/useStockWebSocket';
import { useStockChartDrawing } from '@/lib/hooks/useStockChartDrawing';
import { getCompanyName } from '@/lib/helpers/company.helper';
import { calculatePricingBounds, formatCurrency } from '@/lib/helpers/price.helper';
import { marketApi } from '@/lib/api/market.api';

// Atomic Widgets
import { DrawingToolbar } from '@/components/terminal/DrawingToolbar';
import { MarketFundamentals } from '@/components/terminal/MarketFundamentals';
import { LiveMatchedTradesLog } from '@/components/terminal/LiveMatchedTradesLog';
import { AiInvestmentThesis } from '@/components/terminal/AiInvestmentThesis';

export default function StockDetail() {
  const { symbol } = useParams();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 1. Core Data Custom React Hook
  const {
    instrument,
    latestQuote,
    signals,
    aiSummary,
    loading,
    errorMsg,
    aiLoading,
    aiMessage,
    setLatestQuote,
    handleTriggerAi
  } = useStockDetailData(symbol as string, t);

  // Technical Indicators Toggles
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);

  // TradingView Bottom Bar states
  const [timeRange, setTimeRange] = useState<string>('1y');
  const [currentTime, setCurrentTime] = useState('');
  const [scalePercent, setScalePercent] = useState(false);
  const [scaleLog, setScaleLog] = useState(false);
  const [scaleAuto, setScaleAuto] = useState(true);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setCurrentTime(`${formatter.format(now)} (UTC+7)`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Apply chart scaling options dynamically
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    let mode = 0; // Normal
    if (scalePercent) mode = 2; // Percentage
    else if (scaleLog) mode = 1; // Logarithmic

    chart.priceScale('right').applyOptions({
      mode: mode,
      autoScale: scaleAuto,
    });
  }, [scalePercent, scaleLog, scaleAuto]);

  // Apply historical time range dynamically
  useEffect(() => {
    const chart = chartRef.current;
    const candles = rawCandlesRef.current;
    if (!chart || !candles || candles.length === 0) return;

    const timeScale = chart.timeScale();
    const totalCount = candles.length;

    if (timeRange === 'All') {
      timeScale.fitContent();
      return;
    }

    let barsToShow = 250;
    switch (timeRange) {
      case '1d': barsToShow = 5; break;
      case '5d': barsToShow = 10; break;
      case '1m': barsToShow = 22; break;
      case '3m': barsToShow = 66; break;
      case '6m': barsToShow = 132; break;
      case '1y': barsToShow = 250; break;
      case '5y': barsToShow = 1250; break;
    }

    const startIndex = Math.max(0, totalCount - barsToShow);
    const fromTime = candles[startIndex].time;
    const toTime = candles[totalCount - 1].time;
    
    try {
      timeScale.setVisibleRange({ from: fromTime, to: toTime });
    } catch (e) {
      console.warn('Failed to set visible range:', e);
    }
  }, [timeRange, loading]);

  // Dynamic Pricing Margin Calculations
  const basePrice = latestQuote ? (Number(latestQuote.previousClose) || Number(latestQuote.price) || 22850) : 22850;
  const { tc, tran, san } = calculatePricingBounds(basePrice);

  // 2. Interactive Chart Drawing Custom Hook
  const {
    activeTool,
    setActiveTool,
    drawStatus,
    setDrawStatus,
    drawingPoint1,
    drawingStep,
    setDrawingStep,
    isMagnet,
    setIsMagnet,
    isLocked,
    setIsLocked,
    handleChartClick,
    clearAllDrawings,
    resetAllDrawingsArray
  } = useStockChartDrawing();

  // TradingView Chart API Refs
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);

  const latestBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const rawCandlesRef = useRef<any[]>([]);

  // 3. WebSockets Real-time Trades Subscription Custom Hook
  const { trades } = useStockWebSocket(
    symbol as string,
    tc,
    // onTick Callback updates pricing widgets and pushes updates to the Lightweight Chart canvas in real-time
    (tick) => {
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

      // Synchronize Daily Candlesticks bar updates
      const date = new Date(tick.timestamp);
      date.setUTCHours(0, 0, 0, 0);
      const time = Math.floor(date.getTime() / 1000);

      const candlestickSeries = candlestickSeriesRef.current;
      if (candlestickSeries && latestBarRef.current) {
        if (latestBarRef.current.time === time) {
          latestBarRef.current.close = tick.price;
          latestBarRef.current.high = Math.max(latestBarRef.current.high, tick.price);
          latestBarRef.current.low = Math.min(latestBarRef.current.low, tick.price);
        } else {
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
    }
  );

  // 4. REST Candlesticks loading & chart initialization
  useEffect(() => {
    if (loading || errorMsg || !chartContainerRef.current || !symbol) return;

    // Create Candlestick Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#06070a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#131822' },
        horzLines: { color: '#131822' },
      },
      timeScale: {
        borderColor: '#1a2233',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#1a2233',
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 480,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff1744',
      borderUpColor: '#00e676',
      borderDownColor: '#ff1744',
      wickUpColor: '#00e676',
      wickDownColor: '#ff1744',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    async function loadCandles() {
      try {
        const resData = await marketApi.getCandles(symbol as string);
        if (resData.success && resData.data && resData.data.length > 0) {
          rawCandlesRef.current = resData.data;
          candlestickSeries.setData(resData.data);
          chart.timeScale().fitContent();

          const lastCandle = resData.data[resData.data.length - 1];
          latestBarRef.current = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          };

          recalculateIndicators();
        }
      } catch (err) {
        console.error('Error loading candles:', err);
      }
    }

    loadCandles();

    // Attach click events handlers to hook
    chart.subscribeClick((param: any) => {
      handleChartClick(param, chart, candlestickSeriesRef.current, rawCandlesRef.current);
    });

    // Resize Observer for dynamic fluid sizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.resize(width, height);
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      candlestickSeriesRef.current = null;
      resetAllDrawingsArray();
    };
  }, [loading, errorMsg, symbol]);

  // Recalculates SMA/EMA indicators
  const recalculateIndicators = () => {
    const chart = chartRef.current;
    const candles = rawCandlesRef.current;
    if (!chart || candles.length === 0) return;

    if (showSMA) {
      if (!smaSeriesRef.current) {
        smaSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#ffb300',
          lineWidth: 2,
          title: 'SMA (20)',
        });
      }
      const data = calculateSMA(candles, 20);
      smaSeriesRef.current.setData(data);
    } else {
      if (smaSeriesRef.current) {
        chart.removeSeries(smaSeriesRef.current);
        smaSeriesRef.current = null;
      }
    }

    if (showEMA) {
      if (!emaSeriesRef.current) {
        emaSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#00cfff',
          lineWidth: 2,
          title: 'EMA (50)',
        });
      }
      const data = calculateEMA(candles, 50);
      emaSeriesRef.current.setData(data);
    } else {
      if (emaSeriesRef.current) {
        chart.removeSeries(emaSeriesRef.current);
        emaSeriesRef.current = null;
      }
    }
  };

  useEffect(() => {
    recalculateIndicators();
  }, [showSMA, showEMA]);

  const calculateSMA = (data: any[], period: number) => {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      sma.push({
        time: data[i].time,
        value: sum / period,
      });
    }
    return sma;
  };

  const calculateEMA = (data: any[], period: number) => {
    const ema = [];
    const k = 2 / (period + 1);
    let emaVal = data[0].close;

    ema.push({
      time: data[0].time,
      value: emaVal,
    });

    for (let i = 1; i < data.length; i++) {
      emaVal = data[i].close * k + emaVal * (1 - k);
      ema.push({
        time: data[i].time,
        value: emaVal,
      });
    }
    return ema.slice(period - 1);
  };

  const onClearAllDrawings = () => {
    clearAllDrawings(chartRef.current, candlestickSeriesRef.current);
  };

  // Custom UI Loading & Error boundary panels
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#080a0f]">
        <Loader2 size={40} className="pulse text-accent animate-spin" />
        <p className="font-outfit text-text-secondary">{t('stockDetail.loading')}</p>
      </div>
    );
  }

  if (errorMsg || !instrument) {
    return (
      <div className="py-[60px] px-6 flex flex-col items-center justify-center min-h-screen bg-[#080a0f]">
        <div className="glass-panel p-10 text-center max-w-[500px] border border-white/5 rounded-xl">
          <AlertTriangle size={48} className="text-bearish mx-auto mb-4" />
          <h3 className="font-outfit text-xl font-extrabold mb-2">Analysis Terminal Locked</h3>
          <p className="text-text-secondary mb-6 text-sm leading-relaxed">{errorMsg}</p>
          <button className="btn-primary" onClick={() => router.push('/')}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';

  return (
    <div className="max-w-[1550px] mx-auto p-4 md:p-6 bg-[#080a0f] text-text-primary min-h-screen font-inter select-none">
      
      {/* ─── HEADER ACTION BAR ─── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 border-b border-[#1b2233] pb-4 bg-[#080a0f]">
        <div className="flex items-center gap-2 text-xs md:text-sm text-text-muted">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-text-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer font-bold"
          >
            <ArrowLeft size={16} /> Trang chủ
          </button>
          
          <ChevronRight size={14} />
          <span>Hệ thống phân tích</span>
          
          <ChevronRight size={14} />
          <span className="text-white font-bold">{instrument.symbol} Terminal</span>
        </div>

        {/* Language selector */}
        <div className="flex gap-2">
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
      </header>

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        
        {/* ==================== LEFT AREA (8 COLUMNS) ==================== */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* A. STOCK INFORMATION HUD BAR */}
          <div className="glass-panel p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1017] border border-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#171d2a] p-2 px-3 rounded border border-[#2d3748]/40">
                <span className="font-extrabold text-[#00c58e] text-lg md:text-xl tracking-tight">{instrument.symbol}</span>
                <span className="text-[10px] text-text-muted font-bold bg-[#0d1017] px-1.5 rounded uppercase">HOSE</span>
              </div>
              
              <div>
                <h1 className="text-sm md:text-base text-white font-extrabold leading-tight m-0">{getCompanyName(instrument.symbol)}</h1>
                <p className="text-[11px] text-text-muted m-0 mt-0.5">{instrument.industry || 'Capital Markets'}</p>
              </div>
            </div>

            {/* Quote Pricing row */}
            <div className="flex flex-wrap items-center gap-6 pl-0 md:pl-6 border-l-0 md:border-l border-[#1a2233] w-full md:w-auto">
              <div className="flex items-baseline gap-2">
                <span className={`font-outfit ${priceColor} text-3xl font-extrabold tracking-tight`}>
                  {formatCurrency(currentPrice)}
                </span>
                
                <span className={`text-xs font-bold ${priceColor} font-mono`}>
                  {currentChange >= 0 ? '+' : ''}{formatCurrency(currentChange)} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(2)}%)
                </span>
              </div>

              <div className="flex gap-4 text-[10px] text-text-muted font-bold bg-white/2 p-2 px-3 rounded-lg border border-white/5 font-mono">
                <div className="flex flex-col">
                  <span>Trần</span>
                  <span className="text-ceil">{formatCurrency(tran)}</span>
                </div>
                
                <div className="flex flex-col">
                  <span>Sàn</span>
                  <span className="text-floor">{formatCurrency(san)}</span>
                </div>
                
                <div className="flex flex-col">
                  <span>TC</span>
                  <span className="text-ref">{formatCurrency(tc)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* B. TECHNICAL CANDLESTICK CHART */}
          <div className="glass-panel p-0 bg-[#06070a] overflow-hidden flex border border-[#1b2233] rounded-xl relative flex-col h-[580px]">
            
            {/* Chart Toolbar & Timeframes top header bar */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-[#131822] bg-[#080b11] text-[10px] font-bold text-text-secondary shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[#00c58e]">{instrument.symbol.toUpperCase()}</span>
                <span className="text-white bg-white/10 px-1 rounded">1D</span>
                <span>HOSE</span>

                {/* Indicators checkboxes */}
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-[#1a2233]">
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSMA}
                      onChange={(e) => setShowSMA(e.target.checked)}
                      className="rounded border-[#2d3748] accent-[#ffb300]"
                    />
                    <span className="text-[#ffb300]">SMA(20)</span>
                  </label>
                  
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showEMA}
                      onChange={(e) => setShowEMA(e.target.checked)}
                      className="rounded border-[#2d3748] accent-[#00cfff]"
                    />
                    <span className="text-[#00cfff]">EMA(50)</span>
                  </label>
                </div>

                {/* Active drawing tool notification info */}
                {drawStatus && (
                  <span className="ml-4 text-purple-400 font-extrabold animate-pulse flex items-center gap-1">
                    <Sparkles size={11} className="text-purple-400" /> {drawStatus}
                  </span>
                )}
              </div>

              <span className="text-[9px] text-[#7b8a9b] font-extrabold tracking-wide">PHÂN TÍCH KỸ THUẬT CHUYÊN NGHIỆP</span>
            </div>

            {/* Main chart wrapper with Drawing Toolbar */}
            <div className="w-full flex-grow flex overflow-hidden">
              
              {/* Sidebar Toolbar drawings Component */}
              <DrawingToolbar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                setDrawStatus={setDrawStatus}
                setDrawingStep={setDrawingStep}
                isMagnet={isMagnet}
                setIsMagnet={setIsMagnet}
                isLocked={isLocked}
                setIsLocked={setIsLocked}
                onClear={onClearAllDrawings}
              />

              {/* Chart canvas with Bottom Bar */}
              <div className="flex-grow h-full flex flex-col overflow-hidden">
                <div ref={chartContainerRef} className="flex-grow w-full h-full relative bg-[#06070a]" />
                
                {/* Bottom Status Bar */}
                <div className="h-7 border-t border-[#131822] bg-[#080b11] px-3 flex justify-between items-center text-[10px] text-[#7b8a9b] font-mono shrink-0 select-none">
                  <div className="flex items-center gap-2.5">
                    {(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'All'] as const).map((r) => (
                      <span
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`cursor-pointer transition-colors font-bold text-[9px] ${
                          timeRange === r ? 'text-[#00c58e] font-extrabold' : 'text-[#7b8a9b] hover:text-white'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                    <span className="text-[#1a2233]">|</span>
                    <CalendarRange size={11} className="hover:text-white cursor-pointer" />
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                    <span>{currentTime}</span>
                    <span className="text-[#1a2233]">|</span>
                    <div className="flex gap-2">
                      <span
                        onClick={() => { setScalePercent(!scalePercent); setScaleLog(false); }}
                        className={`cursor-pointer transition-colors ${scalePercent ? 'text-[#00c58e] font-bold' : 'hover:text-white'}`}
                      >
                        %
                      </span>
                      <span
                        onClick={() => { setScaleLog(!scaleLog); setScalePercent(false); }}
                        className={`cursor-pointer transition-colors ${scaleLog ? 'text-[#00c58e] font-bold' : 'hover:text-white'}`}
                      >
                        log
                      </span>
                      <span
                        onClick={() => setScaleAuto(!scaleAuto)}
                        className={`cursor-pointer transition-colors ${scaleAuto ? 'text-[#00c58e] font-bold' : 'hover:text-white'}`}
                      >
                        tự động
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* C. BOTTOM STATS GRID: FINANCIAL STATISTICS & LIVE TRANSACTION MATCHING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* C1. Financial stats list widget */}
            <MarketFundamentals latestQuote={latestQuote} tc={tc} />

            {/* C2. Live trade matching log widget */}
            <LiveMatchedTradesLog trades={trades} tc={tc} />

          </div>

        </div>

        {/* ==================== RIGHT AREA (4 COLUMNS) ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* D. AI INVESTMENT THESIS SUMMARY CARD */}
          <AiInvestmentThesis
            aiSummary={aiSummary}
            aiLoading={aiLoading}
            aiMessage={aiMessage}
            handleTriggerAi={handleTriggerAi}
            symbol={instrument.symbol}
          />

          {/* E. TECHNICAL SIGNALS CROSSOVER LOG LIST */}
          <div className="glass-panel p-5 bg-[#0d1017] border border-white/5 rounded-xl">
            <h3 className="font-outfit text-sm font-bold flex items-center gap-2 border-b border-[#1b2233] pb-3 mb-4 text-[#00c58e] uppercase tracking-wider m-0">
              <Sparkles size={16} /> Nhật ký tín hiệu kỹ thuật
            </h3>

            {signals.length === 0 ? (
              <div className="flex justify-center items-center py-10 text-text-muted text-xs italic">
                Chưa phát hiện tín hiệu kỹ thuật nào trong phiên.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                {signals.map((sig) => (
                  <div key={sig.id} className="glass-panel py-3 px-3.5 rounded-lg bg-white/2 flex items-center justify-between border border-white/5 hover:border-white/20 transition-all duration-200">
                    <div className="flex flex-col gap-1 select-none">
                      <span className="text-[11.5px] font-bold text-white leading-tight">
                        {sig.explanation || `Tín hiệu cắt kéo kỹ thuật`}
                      </span>
                      
                      <span className="text-[9px] text-[#7b8a9b] font-mono">
                        {new Date(sig.detectedAt).toLocaleDateString()} {new Date(sig.detectedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`badge ${sig.type === 'BUY' ? 'badge-bullish' : 'badge-bearish'} text-[9px] py-0.5 px-2`}>
                        {sig.type === 'BUY' ? 'MUA' : 'BÁN'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
