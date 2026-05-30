import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ISeriesApi } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2, Sparkles, Activity, AlertTriangle, Play } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { marketApi } from '@/lib/api/market.api';

interface TickerDetailPanelProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

interface OrderBookRow {
  price: number;
  volume: number;
  percentage: number;
}

interface TradeLog {
  time: string;
  price: number;
  volume: number;
  type: 'BUY' | 'SELL';
  change: number;
}

interface AiSummary {
  summary: string;
  sentiment: string; // BULLISH / BEARISH / NEUTRAL
  confidence: string;
  drivers: string[];
  risks: string[];
}

export function TickerDetailPanel({ symbol, isOpen, onClose }: TickerDetailPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const latestBarRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // States
  const [activeSubTab, setActiveSubTab] = useState<'chart' | 'orderbook' | 'ai'>('chart');
  const [latestQuote, setLatestQuote] = useState<any>(null);
  const [loadingChart, setLoadingChart] = useState(true);

  // Order Book Depth
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [buyVolumeTotal, setBuyVolumeTotal] = useState(542000);
  const [sellVolumeTotal, setSellVolumeTotal] = useState(489000);
  const [trades, setTrades] = useState<TradeLog[]>([]);

  // Base Prices
  const [tc, setTc] = useState(25000);
  const [tran, setTran] = useState(26750);
  const [san, setSan] = useState(23250);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Fetch AI summary dynamically
  const handleAIScan = async () => {
    if (!symbol) return;
    setAiLoading(true);
    setAiMessage('');
    try {
      const res = await marketApi.triggerAiSummary(symbol);
      if (res && res.success) {
        let attempts = 0;
        const maxAttempts = 10;
        const intervalId = setInterval(async () => {
          attempts++;
          try {
            const detailRes = await marketApi.getDetail(symbol);
            if (detailRes.success && detailRes.data && detailRes.data.aiSummary) {
              setAiSummary(detailRes.data.aiSummary);
              setAiLoading(false);
              clearInterval(intervalId);
            }
          } catch (err) {
            console.error('Error polling AI details:', err);
          }

          if (attempts >= maxAttempts) {
            setAiLoading(false);
            setAiMessage('Quá trình quét mất nhiều thời gian hơn dự kiến.');
            clearInterval(intervalId);
          }
        }, 1500);
      } else {
        setAiLoading(false);
        setAiMessage(res?.message || 'Không thể quét AI lúc này.');
      }
    } catch (err) {
      console.error(err);
      setAiLoading(false);
      setAiMessage('Không kết nối được server AI.');
    }
  };

  useEffect(() => {
    if (!isOpen || !symbol) return;

    setLoadingChart(true);
    setTrades([]);
    setAiSummary(null);
    setAiMessage('');

    // 1. Initial REST fetch for Quote & AI Info
    async function fetchDetails() {
      try {
        const res = await marketApi.getDetail(symbol);
        if (res.success && res.data) {
          const quote = res.data.latestQuote;
          if (quote) {
            setLatestQuote(quote);
            const basePrice = Number(quote.previousClose) || Number(quote.price) || 25000;
            setTc(basePrice);
            setTran(Math.round(basePrice * 1.07));
            setSan(Math.round(basePrice * 0.93));
            generateMockDepth(Number(quote.price) || basePrice);
          }
          if (res.data.aiSummary) {
            setAiSummary(res.data.aiSummary);
          }
        }
      } catch (err) {
        console.error('Failed to load instrument detail in panel:', err);
      }
    }
    fetchDetails();

    // 2. Initialize Mock Depth
    function generateMockDepth(price: number) {
      const step = 50;
      const mockBids: OrderBookRow[] = [
        { price: price - step, volume: Math.floor(80000 + Math.random() * 200000), percentage: 0 },
        { price: price - step * 2, volume: Math.floor(60000 + Math.random() * 150000), percentage: 0 },
        { price: price - step * 3, volume: Math.floor(40000 + Math.random() * 100000), percentage: 0 }
      ];
      const mockAsks: OrderBookRow[] = [
        { price: price + step, volume: Math.floor(75000 + Math.random() * 180000), percentage: 0 },
        { price: price + step * 2, volume: Math.floor(55000 + Math.random() * 140000), percentage: 0 },
        { price: price + step * 3, volume: Math.floor(35000 + Math.random() * 90000), percentage: 0 }
      ];

      const maxVol = Math.max(...[...mockBids, ...mockAsks].map(x => x.volume));
      mockBids.forEach(x => x.percentage = (x.volume / maxVol) * 100);
      mockAsks.forEach(x => x.percentage = (x.volume / maxVol) * 100);

      setBids(mockBids);
      setAsks(mockAsks);
    }

    // 3. Connect to WebSockets
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_instrument', { symbol });
    });

    socket.on('instrument_tick', (tick) => {
      setLatestQuote((prev: any) => ({
        ...prev,
        price: tick.price,
        change: tick.change,
        changePercent: tick.changePercent,
        timestamp: new Date(tick.timestamp).toISOString(),
      }));

      // Add to continuous matches trade logs
      const timeStr = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const tradeType: 'BUY' | 'SELL' = Math.random() > 0.45 ? 'BUY' : 'SELL';
      const tradeVol = Math.floor(100 + Math.random() * 3000);

      setTrades(prev => [
        { time: timeStr, price: tick.price, volume: tradeVol, type: tradeType, change: tick.change },
        ...prev.slice(0, 15)
      ]);

      // Fluctuating Depth
      setBids(prevBids => {
        const step = 50;
        const updated = prevBids.map((b, idx) => {
          const delta = (Math.random() - 0.5) * 3000;
          const vol = Math.max(5000, Math.round(b.volume + delta));
          return { price: tick.price - step * (idx + 1), volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume));
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      setAsks(prevAsks => {
        const step = 50;
        const updated = prevAsks.map((a, idx) => {
          const delta = (Math.random() - 0.5) * 3000;
          const vol = Math.max(5000, Math.round(a.volume + delta));
          return { price: tick.price + step * (idx + 1), volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume));
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      setBuyVolumeTotal(prev => Math.max(100000, Math.round(prev + (tradeType === 'BUY' ? tradeVol : -tradeVol * 0.7))));
      setSellVolumeTotal(prev => Math.max(100000, Math.round(prev + (tradeType === 'SELL' ? tradeVol : -tradeVol * 0.7))));

      // Chart Update
      const date = new Date(tick.timestamp);
      date.setUTCHours(0, 0, 0, 0);
      const timeSec = Math.floor(date.getTime() / 1000);

      if (latestBarRef.current && candlestickSeriesRef.current) {
        if (latestBarRef.current.time === timeSec) {
          latestBarRef.current.close = tick.price;
          latestBarRef.current.high = Math.max(latestBarRef.current.high, tick.price);
          latestBarRef.current.low = Math.min(latestBarRef.current.low, tick.price);
        } else {
          latestBarRef.current = {
            time: timeSec,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
          };
        }
        candlestickSeriesRef.current.update(latestBarRef.current);
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isOpen, symbol]);

  // Handle Chart rendering when TAB is 'chart'
  useEffect(() => {
    if (!isOpen || !symbol || activeSubTab !== 'chart') return;

    setLoadingChart(true);
    let chart: any;
    const timer = setTimeout(() => {
      if (chartContainerRef.current) {
        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#0b0e14' },
            textColor: '#7b8a9b',
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
          width: chartContainerRef.current.clientWidth || 380,
          height: 280,
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
            const res = await marketApi.getCandles(symbol);
            if (res.success && res.data && res.data.length > 0) {
              const formatted = res.data.map((c: any) => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
              }));
              candlestickSeries.setData(formatted);
              chart.timeScale().fitContent();

              const last = formatted[formatted.length - 1];
              latestBarRef.current = last;
            }
          } catch (err) {
            console.error(err);
          } finally {
            setLoadingChart(false);
          }
        }
        loadCandles();
      }
    }, 100);

    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      candlestickSeriesRef.current = null;
      latestBarRef.current = null;
    };
  }, [isOpen, symbol, activeSubTab]);

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  
  const totalVolume = buyVolumeTotal + sellVolumeTotal;
  const buyPercent = totalVolume > 0 ? (buyVolumeTotal / totalVolume) * 100 : 50;

  return (
    <div className={`right-slide-panel flex flex-col ${isOpen ? 'panel-open' : 'panel-closed'} font-inter`}>
      {/* PANEL HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-border-board bg-board-header">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-outfit text-xl font-extrabold text-white m-0 tracking-tight">
              {symbol.toUpperCase()}
            </h3>
            <span className="text-[10px] bg-white/5 border border-white/10 text-text-secondary px-1.5 py-0.5 rounded uppercase font-bold">HOSE</span>
          </div>
          <span className="text-[10px] text-text-muted">Ho Chi Minh Stock Exchange</span>
        </div>

        <button 
          onClick={onClose}
          className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer p-1 transition-colors flex items-center"
        >
          <X size={20} />
        </button>
      </div>

      {/* QUICK REAL-TIME QUOTE PANEL */}
      <div className="p-4 bg-slate-900/50 border-b border-border-board">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-baseline gap-2">
            <span className={`${priceColor} font-outfit text-2xl font-extrabold tracking-tight`}>
              {currentPrice.toLocaleString()}
            </span>
            <span className={`badge ${currentPrice > tc ? 'badge-bullish' : currentPrice < tc ? 'badge-bearish' : 'badge-warning'} text-[10px] py-0.5 px-1.5`}>
              {currentPrice > tc ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {currentChange >= 0 ? '+' : ''}{currentChange.toLocaleString()} ({(currentPct * 100).toFixed(2)}%)
            </span>
          </div>

          {/* Trần, Sàn, TC mini badge list */}
          <div className="flex gap-2.5 text-[10px] font-bold">
            <div className="text-center bg-white/2 border border-white/5 p-1 rounded px-2">
              <span className="text-ceil">{tran.toLocaleString()}</span>
            </div>
            <div className="text-center bg-white/2 border border-white/5 p-1 rounded px-2">
              <span className="text-floor">{san.toLocaleString()}</span>
            </div>
            <div className="text-center bg-white/2 border border-white/5 p-1 rounded px-2">
              <span className="text-ref">{tc.toLocaleString()}</span>
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
            Trí tuệ AI
          </div>
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-[#080b11]">
        
        {/* TAB 1: TECHNICAL CHART */}
        {activeSubTab === 'chart' && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex justify-between items-center text-[11px] font-bold text-text-secondary">
              <span>ĐỒ THỊ KỸ THUẬT NẾN 1D</span>
              <div className="flex gap-1 bg-white/2 p-0.5 rounded border border-white/5">
                {['1m', '5m', '1D', '1W'].map(tf => (
                  <span key={tf} className={`px-1.5 py-0.5 rounded text-[9px] ${tf === '1D' ? 'bg-accent/20 text-accent font-extrabold' : 'text-text-muted'}`}>{tf}</span>
                ))}
              </div>
            </div>

            <div className="relative w-full bg-board-bg rounded-xl border border-border-board overflow-hidden min-h-[280px]">
              {loadingChart && (
                <div className="absolute inset-0 flex items-center justify-center bg-board-bg/85 z-10">
                  <Loader2 size={24} className="pulse text-accent" />
                </div>
              )}
              <div ref={chartContainerRef} className="w-full h-full" />
            </div>
            
            {/* Legend guide */}
            <p className="text-[10px] text-text-muted bg-white/2 p-2 px-3 border border-white/5 rounded-lg leading-relaxed mt-auto">
              💡 <strong>Đồ thị nến Nhật:</strong> Tự động đồng bộ các bước giá (Open, High, Low, Close) real-time từ cổng luồng giao dịch.
            </p>
          </div>
        )}

        {/* TAB 2: ORDER BOOK & HISTORICAL TRADES */}
        {activeSubTab === 'orderbook' && (
          <div className="flex flex-col gap-4 flex-1">
            {/* Depth book section */}
            <div className="bg-board-bg p-3.5 rounded-xl border border-border-board">
              <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2.5">Độ Sâu Giao Dịch</span>

              {/* Buy Sell ratio bar */}
              <div className="flex h-3.5 rounded-full overflow-hidden text-[9px] font-extrabold text-white text-center mb-3">
                <div 
                  className="bg-up transition-[width] duration-300 leading-3.5 pl-2 text-left"
                  style={{ width: `${buyPercent}%` }}
                >
                  {buyPercent.toFixed(0)}% Mua
                </div>
                <div 
                  className="bg-down transition-[width] duration-300 leading-3.5 pr-2 text-right"
                  style={{ width: `${100 - buyPercent}%` }}
                >
                  {(100 - buyPercent).toFixed(0)}% Bán
                </div>
              </div>

              {/* Depth Bid Ask grid */}
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-text-muted border-b border-border-board">
                    <th className="text-left pb-1 font-semibold uppercase">MUA (BID)</th>
                    <th className="text-right pb-1 font-semibold">KL</th>
                    <th className="text-right pb-1 font-semibold uppercase">BÁN (ASK)</th>
                    <th className="text-right pb-1 font-semibold">KL</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, idx) => {
                    const ask = asks[idx] || { price: 0, volume: 0, percentage: 0 };
                    const bidPriceColor = bid.price > tc ? 'text-up' : bid.price < tc ? 'text-down' : 'text-ref';
                    const askPriceColor = ask.price > tc ? 'text-up' : ask.price < tc ? 'text-down' : 'text-ref';
                    
                    return (
                      <tr key={idx} className="h-6">
                        <td className={`${bidPriceColor} font-bold text-left`}>{bid.price.toLocaleString()}</td>
                        <td className="relative text-right pr-1.5 text-white font-medium">
                          <div 
                            className="absolute right-0 top-0.5 bottom-0.5 bg-up/10 rounded transition-[width] duration-300"
                            style={{ width: `${bid.percentage}%` }}
                          />
                          <span className="relative z-10">{bid.volume.toLocaleString()}</span>
                        </td>
                        <td className={`${askPriceColor} font-bold text-right pl-1.5`}>{ask.price.toLocaleString()}</td>
                        <td className="relative text-right text-white font-medium">
                          <div 
                            className="absolute right-0 top-0.5 bottom-0.5 bg-down/10 rounded transition-[width] duration-300"
                            style={{ width: `${ask.percentage}%` }}
                          />
                          <span className="relative z-10">{ask.volume.toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Continuous stream section */}
            <div className="flex-1 flex flex-col bg-board-bg p-3.5 rounded-xl border border-border-board max-h-[220px]">
              <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">Khớp Lệnh Liên Tục</span>
              <div className="flex-grow overflow-y-auto border border-border-board/80 rounded-lg">
                <table className="w-full text-[10.5px]">
                  <thead>
                    <tr className="sticky top-0 bg-board-header text-text-muted border-b border-border-board h-6">
                      <th className="text-left pl-2 font-semibold">Thời gian</th>
                      <th className="text-right font-semibold">Giá khớp</th>
                      <th className="text-right pr-2 font-semibold">Khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center p-6 text-text-muted">
                          Chờ các lệnh khớp real-time...
                        </td>
                      </tr>
                    ) : (
                      trades.map((t, idx) => (
                        <tr key={idx} className="h-5.5 border-b border-border-board/40 hover:bg-white/2 transition-colors">
                          <td className="pl-2 text-text-muted">{t.time}</td>
                          <td className={`${t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref'} font-bold text-right`}>
                            {t.price.toLocaleString()}
                          </td>
                          <td className={`text-right pr-2 font-semibold ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}>
                            {t.type === 'BUY' ? '▲' : '▼'} {t.volume.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AI DEEP ADVISORY */}
        {activeSubTab === 'ai' && (
          <div className="flex flex-col gap-4 flex-1">
            {aiMessage && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-bearish text-xs text-center rounded-lg font-medium">
                ⚠️ {aiMessage}
              </div>
            )}

            {aiLoading ? (
              <div className="flex flex-col gap-4 flex-grow justify-center items-center py-10 animate-pulse text-center">
                <Loader2 className="animate-spin text-warning" size={32} />
                <div>
                  <h5 className="font-outfit text-warning font-bold text-sm mb-1">Mạng Nơ-ron AI Đang Quét...</h5>
                  <p className="text-[10px] text-text-muted leading-relaxed">Đối chiếu tín hiệu kỹ thuật & tin tức tài chính</p>
                </div>
              </div>
            ) : aiSummary ? (
              <div className="flex flex-col gap-4 flex-grow">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={`badge ${aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' : aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-warning'} py-0.5 px-2`}>
                    Xu hướng: {aiSummary.sentiment}
                  </span>
                  <span className="text-text-secondary font-semibold">Tín cậy: {Math.round(Number(aiSummary.confidence) * 100)}%</span>
                </div>

                <div className="glass-panel p-3.5 bg-warning/5 border border-warning/15 rounded-xl text-xs text-text-secondary leading-relaxed shadow-sm">
                  <p className="font-bold text-warning mb-1 flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                    <Sparkles size={11} />
                    Luận Điểm Quyết Định
                  </p>
                  {aiSummary.summary}
                </div>

                {/* Drivers & Risks list stack */}
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <span className="block text-bullish font-bold text-[10px] uppercase tracking-wider mb-2">Động lực tăng trưởng (Catalysts)</span>
                    <ul className="text-[10.5px] text-text-secondary pl-4 flex flex-col gap-1 list-disc">
                      {aiSummary.drivers.slice(0, 3).map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                    <span className="block text-bearish font-bold text-[10px] uppercase tracking-wider mb-2">Rủi ro cần lưu ý (Risks)</span>
                    <ul className="text-[10.5px] text-text-secondary pl-4 flex flex-col gap-1 list-disc">
                      {aiSummary.risks.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleAIScan}
                  className="py-2 bg-white/2 border border-white/5 hover:border-warning/30 hover:bg-warning/5 text-warning font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-200 mt-auto"
                >
                  <RefreshCwIcon size={12} />
                  Làm mới phân tích AI
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center flex-grow py-8 px-4 gap-4">
                <div className="w-14 h-14 rounded-full bg-warning/5 border border-warning/10 flex items-center justify-center">
                  <Sparkles size={28} className="text-warning animate-pulse" />
                </div>
                <div>
                  <h4 className="font-outfit text-white text-sm font-extrabold mb-1.5">Trí Tuệ Cố Vấn AI Chưa Chạy</h4>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[260px] mx-auto">
                    Kích hoạt hệ hệ thống GPT-4o quét các xung động kỹ thuật và biên soạn luận điểm đầu tư cho cổ phiếu {symbol}.
                  </p>
                </div>
                <button
                  onClick={handleAIScan}
                  className="py-2.5 px-5 rounded-lg bg-warning border-0 font-bold text-xs text-slate-900 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-warning/10 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Play size={12} fill="currentColor" />
                  Chạy Phân Tích AI
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

// Internal icons to avoid import errors
function RefreshCwIcon({ size = 16, className = '' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M16 3h5v5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 21H3v-5" />
    </svg>
  );
}
