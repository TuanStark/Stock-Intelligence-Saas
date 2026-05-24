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
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '1200px',
        backgroundColor: 'var(--board-bg)',
        border: '1px solid var(--border-board)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-board)',
          backgroundColor: 'var(--board-header)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h2 className="font-outfit" style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {symbol.toUpperCase()}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>HOSE (Ho Chi Minh Stock Exchange)</p>
            </div>
            
            {/* Live Price stats */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginLeft: '12px' }}>
              <span className={`font-outfit ${priceColor}`} style={{ fontSize: '26px', fontWeight: 800 }}>
                {currentPrice.toLocaleString()}
              </span>
              <span className={`badge ${currentPrice > tc ? 'badge-bullish' : currentPrice < tc ? 'badge-bearish' : 'badge-warning'}`} style={{ fontSize: '12px' }}>
                {currentPrice > tc ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {currentChange > 0 ? '+' : ''}{currentChange.toLocaleString()} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Core Prices Mini Card (Trần, Sàn, TC) */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TRẦN</span>
              <span className="text-ceil" style={{ fontWeight: 700 }}>{tran.toLocaleString()}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>SÀN</span>
              <span className="text-floor" style={{ fontWeight: 700 }}>{san.toLocaleString()}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>TC</span>
              <span className="text-ref" style={{ fontWeight: 700 }}>{tc.toLocaleString()}</span>
            </div>

            <button 
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                marginLeft: '10px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 2-COLUMN VIEWPORT */}
        <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          
          {/* LEFT: TECHNICAL CHART */}
          <div style={{ flexGrow: 1, padding: '20px', borderRight: '1px solid var(--border-board)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="font-outfit" style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} />
                ĐỒ THỊ KỸ THUẬT 1D
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['1m', '5m', '15m', '1D', '1W'].map(tf => (
                  <button 
                    key={tf}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                      border: tf === '1D' ? '1px solid var(--color-accent)' : '1px solid var(--border-board)',
                      background: tf === '1D' ? 'var(--color-accent-bg)' : 'transparent',
                      color: tf === '1D' ? 'var(--color-accent)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flexGrow: 1, minHeight: '380px', position: 'relative', background: '#0b0e14', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-board)' }}>
              {loadingChart && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,14,20,0.8)', zIndex: 10 }}>
                  <Loader2 size={32} className="pulse" style={{ color: 'var(--color-accent)' }} />
                </div>
              )}
              <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>

          {/* RIGHT: ORDER BOOK & LIVE TRANSACTIONS */}
          <div style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderLeft: '1px solid var(--border-board)' }}>
            
            {/* 1. ORDER BOOK (ĐỘ SÂU THỊ TRƯỜNG) */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-board)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="font-outfit" style={{ fontSize: '13px', fontWeight: 700 }}>ĐỘ SÂU THỊ TRƯỜNG</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tổng KL Mua/Bán</span>
              </div>

              {/* Buy vs Sell Ratio Bar */}
              <div style={{ display: 'flex', height: '18px', borderRadius: '9px', overflow: 'hidden', fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ width: `${buyPercent}%`, backgroundColor: 'var(--color-up)', transition: 'width 0.3s ease', lineHeight: '18px', paddingLeft: '8px', textAlign: 'left' }}>
                  {buyPercent.toFixed(0)}% Mua
                </div>
                <div style={{ width: `${100 - buyPercent}%`, backgroundColor: 'var(--color-down)', transition: 'width 0.3s ease', lineHeight: '18px', paddingRight: '8px', textAlign: 'right' }}>
                  {(100 - buyPercent).toFixed(0)}% Bán
                </div>
              </div>

              {/* Bids & Asks list */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-board)' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '4px' }}>MUA (BID)</th>
                    <th style={{ textAlign: 'right', paddingBottom: '4px' }}>KL</th>
                    <th style={{ textAlign: 'right', paddingBottom: '4px' }}>BÁN (ASK)</th>
                    <th style={{ textAlign: 'right', paddingBottom: '4px' }}>KL</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, idx) => {
                    const ask = asks[idx] || { price: 0, volume: 0, percentage: 0 };
                    const bidPriceColor = bid.price > tc ? 'text-up' : bid.price < tc ? 'text-down' : 'text-ref';
                    const askPriceColor = ask.price > tc ? 'text-up' : ask.price < tc ? 'text-down' : 'text-ref';
                    
                    return (
                      <tr key={idx} style={{ height: '26px' }}>
                        {/* BID PRICE */}
                        <td className={bidPriceColor} style={{ fontWeight: 700, textAlign: 'left' }}>
                          {bid.price.toLocaleString()}
                        </td>
                        {/* BID VOLUME BAR */}
                        <td style={{ position: 'relative', textAlign: 'right', paddingRight: '8px', color: 'var(--text-primary)' }}>
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '4px',
                            bottom: '4px',
                            width: `${bid.percentage}%`,
                            backgroundColor: 'rgba(0, 230, 118, 0.1)',
                            borderRadius: '2px',
                            zIndex: 1,
                            transition: 'width 0.3s ease'
                          }} />
                          <span style={{ position: 'relative', zIndex: 2 }}>{bid.volume.toLocaleString()}</span>
                        </td>
                        
                        {/* ASK PRICE */}
                        <td className={askPriceColor} style={{ fontWeight: 700, textAlign: 'right', paddingLeft: '8px' }}>
                          {ask.price.toLocaleString()}
                        </td>
                        {/* ASK VOLUME BAR */}
                        <td style={{ position: 'relative', textAlign: 'right', color: 'var(--text-primary)' }}>
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '4px',
                            bottom: '4px',
                            width: `${ask.percentage}%`,
                            backgroundColor: 'rgba(255, 23, 68, 0.1)',
                            borderRadius: '2px',
                            zIndex: 1,
                            transition: 'width 0.3s ease'
                          }} />
                          <span style={{ position: 'relative', zIndex: 2 }}>{ask.volume.toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. LIVE TRADES STREAM */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
              <span className="font-outfit" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>KHỚP LỆNH LIÊN TỤC</span>
              
              <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '200px', border: '1px solid var(--border-board)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--board-header)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-board)', height: '24px' }}>
                      <th style={{ textAlign: 'left', paddingLeft: '8px' }}>Thời gian</th>
                      <th style={{ textAlign: 'right' }}>Giá</th>
                      <th style={{ textAlign: 'right', paddingRight: '8px' }}>Khối lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                          Waiting for live trades…
                        </td>
                      </tr>
                    ) : (
                      trades.map((t, idx) => (
                        <tr key={idx} style={{ height: '22px', borderBottom: '1px solid var(--border-board)' }}>
                          <td style={{ paddingLeft: '8px', color: 'var(--text-muted)' }}>{t.time}</td>
                          <td className={t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref'} style={{ fontWeight: 700, textAlign: 'right' }}>
                            {t.price.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: '8px', color: t.type === 'BUY' ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 600 }}>
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
