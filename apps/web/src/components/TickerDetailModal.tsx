import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ISeriesApi } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { marketApi } from '@/lib/api/market.api';

interface TickerDetailModalProps {
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

export function TickerDetailModal({ symbol, isOpen, onClose }: TickerDetailModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const latestBarRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // States
  const [latestQuote, setLatestQuote] = useState<any>(null);
  const [loadingChart, setLoadingChart] = useState(true);
  
  // Real-time Order Book Depth State (Option A: Smart simulation fluctuated by live ticks)
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [buyVolumeTotal, setBuyVolumeTotal] = useState(542000);
  const [sellVolumeTotal, setSellVolumeTotal] = useState(489000);

  // Live transaction logs
  const [trades, setTrades] = useState<TradeLog[]>([]);

  // Base Prices
  const [tc, setTc] = useState(25000);
  const [tran, setTran] = useState(26750);
  const [san, setSan] = useState(23250);

  useEffect(() => {
    if (!isOpen || !symbol) return;

    setLoadingChart(true);
    setTrades([]);

    // 1. Initial REST fetch for Latest Quote to set ceiling/floor/reference
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
        }
      } catch (err) {
        console.error('Failed to load instrument details:', err);
      }
    }
    fetchDetails();

    // 2. Initialize Order Book Depth Mock
    function generateMockDepth(price: number) {
      const step = 50; // HOSE stock tick step
      const mockBids: OrderBookRow[] = [
        { price: price - step, volume: Math.floor(100000 + Math.random() * 500000), percentage: 0 },
        { price: price - step * 2, volume: Math.floor(80000 + Math.random() * 400000), percentage: 0 },
        { price: price - step * 3, volume: Math.floor(50000 + Math.random() * 300000), percentage: 0 }
      ];
      const mockAsks: OrderBookRow[] = [
        { price: price + step, volume: Math.floor(90000 + Math.random() * 450000), percentage: 0 },
        { price: price + step * 2, volume: Math.floor(75000 + Math.random() * 350000), percentage: 0 },
        { price: price + step * 3, volume: Math.floor(40000 + Math.random() * 250000), percentage: 0 }
      ];

      const maxVol = Math.max(...[...mockBids, ...mockAsks].map(x => x.volume));
      mockBids.forEach(x => x.percentage = (x.volume / maxVol) * 100);
      mockAsks.forEach(x => x.percentage = (x.volume / maxVol) * 100);

      setBids(mockBids);
      setAsks(mockAsks);
    }

    // 3. Setup Lightweight Charts
    let chart: any;
    if (chartContainerRef.current) {
      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: '#0b0e14' },
          textColor: '#7b8a9b',
        },
        grid: {
          vertLines: { color: '#141822' },
          horzLines: { color: '#141822' },
        },
        crosshair: {
          mode: 0,
        },
        timeScale: {
          borderColor: '#1e2433',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#1e2433',
        },
        width: chartContainerRef.current.clientWidth,
        height: 380,
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

      // Load candles
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

    // 4. Connect to WebSockets
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_instrument', { symbol });
    });

    socket.on('instrument_tick', (tick) => {
      // A. Update latest quote state
      setLatestQuote((prev: any) => ({
        ...prev,
        price: tick.price,
        change: tick.change,
        changePercent: tick.changePercent,
        timestamp: new Date(tick.timestamp).toISOString(),
      }));

      // B. Push trade to scrolling transaction log
      const timeStr = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const tradeType: 'BUY' | 'SELL' = Math.random() > 0.45 ? 'BUY' : 'SELL';
      const tradeVol = Math.floor(100 + Math.random() * 5000);
      
      setTrades(prev => [
        {
          time: timeStr,
          price: tick.price,
          volume: tradeVol,
          type: tradeType,
          change: tick.change,
        },
        ...prev.slice(0, 24) // limit to 25 items
      ]);

      // C. Update Order Book Depth Mock with slight fluctuations
      setBids(prevBids => {
        const step = 50;
        const updated = prevBids.map((b, idx) => {
          const delta = (Math.random() - 0.5) * 5000;
          const vol = Math.max(10000, Math.round(b.volume + delta));
          return { price: tick.price - step * (idx + 1), volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume));
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      setAsks(prevAsks => {
        const step = 50;
        const updated = prevAsks.map((a, idx) => {
          const delta = (Math.random() - 0.5) * 5000;
          const vol = Math.max(10000, Math.round(a.volume + delta));
          return { price: tick.price + step * (idx + 1), volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume));
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      // D. Update Buy/Sell ratio bar
      setBuyVolumeTotal(prev => Math.max(200000, Math.round(prev + (tradeType === 'BUY' ? tradeVol : -tradeVol * 0.8))));
      setSellVolumeTotal(prev => Math.max(200000, Math.round(prev + (tradeType === 'SELL' ? tradeVol : -tradeVol * 0.8))));

      // E. Update Technical Candle in real-time
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

    // Cleanup resize handler & socket
    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) chart.remove();
      if (socket) socket.disconnect();
    };
  }, [isOpen, symbol]);

  if (!isOpen) return null;

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  
  const totalVolume = buyVolumeTotal + sellVolumeTotal;
  const buyPercent = totalVolume > 0 ? (buyVolumeTotal / totalVolume) * 100 : 50;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[1000] p-5">
      <div className="glass-panel w-full max-w-[1200px] bg-board-bg border border-border-board rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* HEADER */}
        <div className="flex justify-between items-center py-4 px-6 border-b border-border-board bg-board-header">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-outfit text-2xl font-extrabold m-0 text-text-primary">
                {symbol.toUpperCase()}
              </h2>
              <p className="text-xs text-text-muted m-0">HOSE (Ho Chi Minh Stock Exchange)</p>
            </div>
            
            {/* Live Price stats */}
            <div className="flex items-baseline gap-2 ml-3">
              <span className={`font-outfit ${priceColor} text-[26px] font-extrabold`}>
                {currentPrice.toLocaleString()}
              </span>
              <span className={`badge ${currentPrice > tc ? 'badge-bullish' : currentPrice < tc ? 'badge-bearish' : 'badge-warning'} text-xs`}>
                {currentPrice > tc ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {currentChange > 0 ? '+' : ''}{currentChange.toLocaleString()} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Core Prices Mini Card (Trần, Sàn, TC) */}
          <div className="flex gap-5 text-sm">
            <div className="text-center">
              <span className="text-text-muted block text-[10px]">TRẦN</span>
              <span className="text-ceil font-bold">{tran.toLocaleString()}</span>
            </div>
            <div className="text-center">
              <span className="text-text-muted block text-[10px]">SÀN</span>
              <span className="text-floor font-bold">{san.toLocaleString()}</span>
            </div>
            <div className="text-center">
              <span className="text-text-muted block text-[10px]">TC</span>
              <span className="text-ref font-bold">{tc.toLocaleString()}</span>
            </div>

            <button 
              onClick={onClose}
              className="bg-transparent border-none text-text-muted hover:text-text-primary cursor-pointer p-1 ml-2.5 flex items-center transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 2-COLUMN VIEWPORT */}
        <div className="flex flex-grow overflow-hidden">
          
          {/* LEFT: TECHNICAL CHART */}
          <div className="flex-grow p-5 border-r border-border-board flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <span className="font-outfit text-base font-bold flex items-center gap-2">
                <TrendingUp size={16} className="text-accent" />
                ĐỒ THỊ KỸ THUẬT 1D
              </span>
              <div className="flex gap-1.5">
                {['1m', '5m', '15m', '1D', '1W'].map(tf => (
                  <button 
                    key={tf}
                    className={`py-1 px-2.5 text-[11px] font-bold rounded-[6px] cursor-pointer transition-colors border ${
                      tf === '1D' 
                        ? 'border-accent bg-accent/15 text-accent' 
                        : 'border-border-board bg-transparent text-text-secondary hover:text-text-primary hover:border-text-muted'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-grow min-h-[380px] relative bg-board-bg rounded-lg overflow-hidden border border-border-board">
              {loadingChart && (
                <div className="absolute inset-0 flex items-center justify-center bg-board-bg/80 z-10">
                  <Loader2 size={32} className="pulse text-accent" />
                </div>
              )}
              <div ref={chartContainerRef} className="w-full h-full" />
            </div>
          </div>

          {/* RIGHT: ORDER BOOK & LIVE TRANSACTIONS */}
          <div className="w-[380px] shrink-0 flex flex-col overflow-y-auto border-l border-border-board">
            
            {/* 1. ORDER BOOK (ĐỘ SÂU THỊ TRƯỜNG) */}
            <div className="p-4 border-b border-border-board">
              <div className="flex justify-between mb-2">
                <span className="font-outfit text-xs font-bold">ĐỘ SÂU THỊ TRƯỜNG</span>
                <span className="text-[11px] text-text-muted">Tổng KL Mua/Bán</span>
              </div>

              {/* Buy vs Sell Ratio Bar */}
              <div className="flex h-[18px] rounded-[9px] overflow-hidden text-[10px] font-bold text-white text-center mb-3.5">
                <div 
                  className="bg-up transition-[width] duration-300 ease-in-out leading-[18px] pl-2 text-left" 
                  style={{ width: `${buyPercent}%` }}
                >
                  {buyPercent.toFixed(0)}% Mua
                </div>
                <div 
                  className="bg-down transition-[width] duration-300 ease-in-out leading-[18px] pr-2 text-right" 
                  style={{ width: `${100 - buyPercent}%` }}
                >
                  {(100 - buyPercent).toFixed(0)}% Bán
                </div>
              </div>

              {/* Bids & Asks list */}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border-board">
                    <th className="text-left pb-1 font-semibold">MUA (BID)</th>
                    <th className="text-right pb-1 font-semibold">KL</th>
                    <th className="text-right pb-1 font-semibold">BÁN (ASK)</th>
                    <th className="text-right pb-1 font-semibold">KL</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, idx) => {
                    const ask = asks[idx] || { price: 0, volume: 0, percentage: 0 };
                    const bidPriceColor = bid.price > tc ? 'text-up' : bid.price < tc ? 'text-down' : 'text-ref';
                    const askPriceColor = ask.price > tc ? 'text-up' : ask.price < tc ? 'text-down' : 'text-ref';
                    
                    return (
                      <tr key={idx} className="h-[26px]">
                        {/* BID PRICE */}
                        <td className={`${bidPriceColor} font-bold text-left`}>
                          {bid.price.toLocaleString()}
                        </td>
                        {/* BID VOLUME BAR */}
                        <td className="relative text-right pr-2 text-text-primary">
                          <div 
                            className="absolute right-0 top-1 bottom-1 bg-up/10 rounded-[2px] z-10 transition-[width] duration-300 ease-in-out" 
                            style={{ width: `${bid.percentage}%` }}
                          />
                          <span className="relative z-20">{bid.volume.toLocaleString()}</span>
                        </td>
                        
                        {/* ASK PRICE */}
                        <td className={`${askPriceColor} font-bold text-right pl-2`}>
                          {ask.price.toLocaleString()}
                        </td>
                        {/* ASK VOLUME BAR */}
                        <td className="relative text-right text-text-primary">
                          <div 
                            className="absolute right-0 top-1 bottom-1 bg-down/10 rounded-[2px] z-10 transition-[width] duration-300 ease-in-out" 
                            style={{ width: `${ask.percentage}%` }}
                          />
                          <span className="relative z-20">{ask.volume.toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. LIVE TRADES STREAM */}
            <div className="p-4 flex flex-col flex-grow overflow-hidden">
              <span className="font-outfit text-xs font-bold mb-2.5">KHỚP LỆNH LIÊN TỤC</span>
              
              <div className="flex-grow overflow-y-auto max-h-[200px] border border-border-board rounded-lg">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="sticky top-0 bg-board-header text-text-muted border-b border-border-board h-6">
                      <th className="text-left pl-2 font-semibold">Thời gian</th>
                      <th className="text-right font-semibold">Giá</th>
                      <th className="text-right pr-2 font-semibold">Khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center p-4 text-text-muted">
                          Waiting for live trades…
                        </td>
                      </tr>
                    ) : (
                      trades.map((t, idx) => (
                        <tr key={idx} className="h-[22px] border-b border-border-board hover:bg-board-row-hover/30 transition-colors">
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

        </div>
      </div>
    </div>
  );
}
