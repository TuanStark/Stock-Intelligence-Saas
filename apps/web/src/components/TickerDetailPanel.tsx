import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
import { X, TrendingUp, Loader2, Sparkles, Activity, CalendarRange } from 'lucide-react';

// Custom Hooks & Centralized Helpers
import { useStockDetailData } from '@/lib/hooks/useStockDetailData';
import { useStockWebSocket } from '@/lib/hooks/useStockWebSocket';
import { useStockChartDrawing } from '@/lib/hooks/useStockChartDrawing';
import { getCompanyName } from '@/lib/helpers/company.helper';
import { calculatePricingBounds, formatCurrency } from '@/lib/helpers/price.helper';
import { marketApi } from '@/lib/api/market.api';

// Shared Dumb UI Widgets
import { DrawingToolbar } from '@/components/terminal/DrawingToolbar';
import { CumulativeOrderBook } from '@/components/terminal/CumulativeOrderBook';
import { LiveMatchedTradesLog } from '@/components/terminal/LiveMatchedTradesLog';

interface TickerDetailPanelProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TickerDetailPanel: React.FC<TickerDetailPanelProps> = ({ symbol, isOpen, onClose }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Compact Sub tabs
  const [activeSubTab, setActiveSubTab] = useState<'chart' | 'orderbook' | 'ai'>('chart');
  
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


  
  // Technical Indicators
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);

  // 1. Core Data Custom React Hook
  const mockTranslate = (key: string) => key;
  const {
    latestQuote,
    loading,
    errorMsg,
    aiSummary,
    aiLoading,
    aiMessage,
    setLatestQuote,
    handleTriggerAi
  } = useStockDetailData(symbol, mockTranslate);

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
      console.warn('Failed to set visible range in sidebar panel:', e);
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
  const { bids, asks, trades } = useStockWebSocket(
    symbol,
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
      if (candlestickSeries && latestBarRef.current && activeSubTab === 'chart') {
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

  // 4. REST Candlesticks loading & chart initialization (when tab is chart)
  useEffect(() => {
    if (!isOpen || loading || errorMsg || activeSubTab !== 'chart' || !chartContainerRef.current) return;

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
      width: chartContainerRef.current.clientWidth || 320,
      height: chartContainerRef.current.clientHeight || 380,
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
        const resData = await marketApi.getCandles(symbol);
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
        console.error('Error loading candles in sidebar panel:', err);
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
  }, [isOpen, loading, errorMsg, activeSubTab, symbol]);

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

  const calculateSMA = (data: any[], count: number) => {
    const r = [];
    for (let i = 0; i < data.length; i++) {
      if (i < count - 1) continue;
      let sum = 0;
      for (let j = 0; j < count; j++) {
        sum += data[i - j].close;
      }
      r.push({
        time: data[i].time,
        value: Number((sum / count).toFixed(2)),
      });
    }
    return r;
  };

  const calculateEMA = (data: any[], count: number) => {
    if (data.length < count) return [];
    const r = [];
    const k = 2 / (count + 1);

    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += data[i].close;
    }
    let emaVal = sum / count;
    r.push({ time: data[count - 1].time, value: Number(emaVal.toFixed(2)) });

    for (let i = count; i < data.length; i++) {
      emaVal = data[i].close * k + emaVal * (1 - k);
      r.push({ time: data[i].time, value: Number(emaVal.toFixed(2)) });
    }
    return r;
  };

  const onClearAllDrawings = () => {
    clearAllDrawings(chartRef.current, candlestickSeriesRef.current);
  };

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';

  if (!isOpen) return null;

  return (
    <div className={`right-slide-panel flex flex-col ${isOpen ? 'panel-open' : 'panel-closed'} font-inter`}>
      {/* PANEL HEADER */}
      <div className="flex justify-between items-center p-3 border-b border-border-board bg-board-header">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#090b11] p-1 px-2.5 rounded border border-[#1b2233] text-[11px]">
            <span className="text-text-muted">🔍</span>
            <span className="font-extrabold text-[#00c58e] tracking-tight">{symbol.toUpperCase()}</span>
            <span className="text-[9px] text-text-muted font-bold bg-white/5 px-0.5 rounded uppercase">HOSE</span>
          </div>
          <span className="text-[10px] text-text-secondary font-bold truncate max-w-[120px]">{getCompanyName(symbol)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert(`Đặt lệnh nhanh mã ${symbol.toUpperCase()} trên Sidebar.`)}
            className="bg-[#00c58e] hover:bg-[#00e69c] text-black text-[10px] px-2.5 py-1 rounded font-extrabold cursor-pointer transition-all shrink-0"
          >
            Đặt lệnh
          </button>
          
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer p-1 transition-colors flex items-center outline-none"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* QUICK REAL-TIME QUOTE PANEL */}
      <div className="p-3 bg-[#080b11] border-b border-border-board text-xs select-none">
        <div className="flex justify-between items-center font-mono">
          <div className="flex items-baseline gap-1.5">
            <span className={`${priceColor} font-outfit text-xl font-extrabold tracking-tight`}>
              {formatCurrency(currentPrice)}
            </span>
            <span className={`text-[9.5px] font-bold ${priceColor}`}>
              {currentChange >= 0 ? '+' : ''}{formatCurrency(currentChange)} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="flex gap-1.5 text-[9px] font-bold">
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
              <span className="text-ceil">{formatCurrency(tran)}</span>
            </div>
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
              <span className="text-floor">{formatCurrency(san)}</span>
            </div>
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
              <span className="text-ref">{formatCurrency(tc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPACT TAB MENU */}
      <div className="flex border-b border-border-board bg-board-header">
        <button 
          onClick={() => setActiveSubTab('chart')}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === 'chart' 
              ? 'border-accent text-accent bg-accent/5' 
              : 'border-transparent text-text-muted hover:text-text-primary hover:bg-white/2'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <TrendingUp size={14} />
            Đồ thị
          </div>
        </button>
        <button 
          onClick={() => setActiveSubTab('orderbook')}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === 'orderbook' 
              ? 'border-accent text-accent bg-accent/5' 
              : 'border-transparent text-text-muted hover:text-text-primary hover:bg-white/2'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Activity size={14} />
            Sổ lệnh
          </div>
        </button>
        <button 
          onClick={() => setActiveSubTab('ai')}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === 'ai' 
              ? 'border-accent text-accent bg-accent/5' 
              : 'border-transparent text-text-muted hover:text-text-primary hover:bg-white/2'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles size={14} className="text-warning" />
            AI Thesis
          </div>
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-grow overflow-y-auto bg-[#06080d] p-3 text-text-primary">
        
        {/* SUBTAB 1: CHART & TOOLS */}
        {activeSubTab === 'chart' && (
          <div className="flex flex-col gap-3 h-full min-h-[480px]">
            {/* Header controls with indicators */}
            <div className="flex justify-between items-center bg-[#0d1017] p-2 rounded-lg border border-white/5 text-[9px] font-bold text-text-secondary select-none">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={showSMA}
                    onChange={(e) => setShowSMA(e.target.checked)}
                    className="rounded border-[#2d3748] accent-[#ffb300]"
                  />
                  <span className="text-[#ffb300]">SMA</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={showEMA}
                    onChange={(e) => setShowEMA(e.target.checked)}
                    className="rounded border-[#2d3748] accent-[#00cfff]"
                  />
                  <span className="text-[#00cfff]">EMA</span>
                </label>
              </div>
              
              {drawStatus && (
                <span className="text-purple-400 font-extrabold animate-pulse truncate max-w-[140px]">
                  {drawStatus}
                </span>
              )}
            </div>

            {/* Drawing toolbar & Canvas container */}
            <div className="flex-grow flex border border-white/5 rounded-xl bg-[#06070a] overflow-hidden min-h-[400px]">
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
        )}

        {/* SUBTAB 2: ORDERBOOK & LIVE TRADES */}
        {activeSubTab === 'orderbook' && (
          <div className="flex flex-col gap-4">
            <CumulativeOrderBook bids={bids} asks={asks} tc={tc} />
            <LiveMatchedTradesLog trades={trades} tc={tc} />
          </div>
        )}

        {/* SUBTAB 3: AI ANALYSIS */}
        {activeSubTab === 'ai' && (
          <div className="flex flex-col gap-4">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center text-center p-12 gap-3 bg-[#0d1017] border border-white/5 rounded-xl min-h-[300px]">
                <Loader2 className="animate-spin text-warning" size={32} />
                <div>
                  <h5 className="font-outfit font-bold text-warning text-sm mb-1">Mạng Nơ-ron AI Đang Quét...</h5>
                  <p className="text-[10px] text-text-muted leading-relaxed max-w-[200px]">
                    Đang nén tin tức vĩ mô, chỉ số SMA/EMA & khối lượng giao dịch
                  </p>
                </div>
              </div>
            ) : aiSummary ? (
              <div className="flex flex-col gap-3.5 text-xs md:text-sm bg-[#0d1017] p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center border-b border-[#1b2233] pb-3.5 mb-1">
                  <span className={`badge ${
                    aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' :
                    aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-accent'
                  } py-1 px-2.5`}>
                    XU HƯỚNG: {aiSummary.sentiment}
                  </span>
                  
                  <span className="text-[10px] text-text-muted font-bold font-mono">
                    Độ tin cậy: {Math.round(Number(aiSummary.confidence) * 100)}%
                  </span>
                </div>

                <div className="glass-panel p-3.5 rounded-lg bg-warning/5 border border-warning/10 leading-relaxed text-text-secondary text-xs">
                  <p className="font-bold text-warning mb-1.5 uppercase tracking-wide">Luận Điểm Đầu Tư</p>
                  {aiSummary.summary}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg text-[10.5px]">
                  <span className="text-emerald-400 font-bold block mb-1">ĐỘNG LỰC TĂNG TRƯỞNG</span>
                  <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                    {Array.isArray(aiSummary.drivers) ? aiSummary.drivers.slice(0, 3).map((d, i) => (
                      <li key={i}>{d}</li>
                    )) : <li>Động lực dòng tiền mạnh</li>}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg text-[10.5px]">
                  <span className="text-rose-400 font-bold block mb-1">RỦI RO KỸ THUẬT</span>
                  <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                    {Array.isArray(aiSummary.risks) ? aiSummary.risks.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    )) : <li>Biến động giá cực lớn</li>}
                  </ul>
                </div>

                <button
                  onClick={handleTriggerAi}
                  className="py-2 w-full rounded-lg bg-warning text-slate-900 border-none font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:brightness-110 active:scale-98 transition-all"
                >
                  <Sparkles size={13} /> Cập nhật phân tích AI
                </button>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center p-12 text-center gap-4 bg-[#0d1017] border border-white/5 rounded-xl min-h-[300px]">
                <Sparkles size={36} className="text-warning animate-pulse" />
                <div>
                  <h4 className="font-outfit text-text-primary text-sm font-semibold mb-1">Chưa có Phân Tích AI</h4>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    Yêu cầu AI quét tín hiệu kỹ thuật của {symbol} để lấy khuyến nghị.
                  </p>
                </div>
                <button
                  onClick={handleTriggerAi}
                  className="py-2 px-4 rounded-lg bg-warning text-slate-900 border-none font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <Sparkles size={13} /> Phân Tích Ngay
                </button>
              </div>
            )}
            
            {aiMessage && (
              <div className="py-2 px-3 bg-red-500/10 border border-red-500/15 rounded-md text-red-400 text-xs text-center">
                {aiMessage}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
