import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, ISeriesApi } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2, Sparkles, Activity } from 'lucide-react';
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

interface AiSummary {
  summary: string;
  sentiment: string; // BULLISH / BEARISH / NEUTRAL
  confidence: string;
  drivers: string[];
  risks: string[];
}

function getCompanyName(symbol: string): string {
  const sym = symbol.toUpperCase().trim();
  const directory: Record<string, string> = {
    ACB: 'Ngân hàng Thương mại Cổ phần Á Châu',
    FPT: 'Công ty Cổ phần FPT',
    HPG: 'Công ty Cổ phần Tập đoàn Hòa Phát',
    TCB: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)',
    VCB: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    VHM: 'Công ty Cổ phần Vinhomes',
    VIC: 'Tập đoàn Vingroup - Công ty CP',
    SHS: 'Công ty Cổ phần Chứng khoán Sài Gòn - Hà Nội',
    PVS: 'Tổng Công ty Cổ phần Dịch vụ Kỹ thuật Dầu khí Việt Nam',
    IDC: 'Tổng Công ty IDICO - Công ty Cổ phần',
    CEO: 'Công ty Cổ phần Tập đoàn C.E.O',
    ACV: 'Tổng công ty Cảng hàng không Việt Nam - CTCP',
    BSR: 'Công ty Cổ phần Lọc hóa dầu Bình Sơn',
    VEA: 'Tổng công ty Máy động lực và Máy nông nghiệp Việt Nam',
    VGI: 'Tổng Công ty Cổ phần Đầu tư Quốc tế Viettel',
  };
  return directory[sym] || 'Công ty Cổ phần Đầu tư & Phát triển Thị trường';
}

// Math logic helpers for indicators
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

// Aggregates standard raw daily candles or mocks convincing intraday candles for dynamic intervals
const getIntervalCandles = (raw: any[], interval: '1m' | '5m' | '15m' | '1D' | '1W') => {
  if (interval === '1D') return raw;
  if (interval === '1W') {
    const weekly = [];
    for (let i = 0; i < raw.length; i += 5) {
      const chunk = raw.slice(i, i + 5);
      const open = chunk[0].open;
      const close = chunk[chunk.length - 1].close;
      const high = Math.max(...chunk.map(x => x.high));
      const low = Math.min(...chunk.map(x => x.low));
      weekly.push({ time: chunk[0].time, open, high, low, close });
    }
    return weekly;
  }
  // Mocks intraday chart by utilizing daily raw price walk blocks
  const intraday = [];
  const spacing = interval === '1m' ? 60 : interval === '5m' ? 300 : 900;
  let baseTime = Math.floor(Date.now() / 1000) - 80 * spacing;
  const lastClose = raw.length > 0 ? raw[raw.length - 1].close : 22850;
  let lastVal = lastClose - 1500;

  for (let i = 0; i < 80; i++) {
    const change = (Math.random() - 0.5) * 60;
    const o = lastVal;
    const c = lastVal + change;
    const h = Math.max(o, c) + Math.random() * 20;
    const l = Math.min(o, c) - Math.random() * 20;
    intraday.push({
      time: baseTime + i * spacing,
      open: Number(o.toFixed(2)),
      high: Number(h.toFixed(2)),
      low: Number(l.toFixed(2)),
      close: Number(c.toFixed(2))
    });
    lastVal = c;
  }
  return intraday;
};

export function TickerDetailModal({ symbol, isOpen, onClose }: TickerDetailModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const latestBarRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // States
  const [activeTab, setActiveTab] = useState<'Giao dịch' | 'Hồ sơ' | 'Cổ đông' | 'Vốn và cổ tức' | 'Tin tức' | 'Lịch sự kiện' | 'Thống kê' | 'Tài chính'>('Giao dịch');
  const [latestQuote, setLatestQuote] = useState<any>(null);
  const [loadingChart, setLoadingChart] = useState(true);

  // AI Summary States
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Fetch AI summary dynamically
  const handleAIScan = async () => {
    if (!symbol) return;
    setAiLoading(true);
    setAiMessage('');
    setAiSummary(null);
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

  // Interactive Interval & Range states
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1D' | '1W'>('1D');
  const [range, setRange] = useState<'1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'All'>('All');

  // Technical Indicator lines toggles states
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const rawCandlesRef = useRef<any[]>([]);

  // Drawing Tools Interactive States
  const [activeTool, setActiveToolState] = useState('');
  const [drawStatus, setDrawStatus] = useState('');
  const [drawingPoint1, setDrawingPoint1] = useState<any>(null);
  const [drawingStep, setDrawingStepState] = useState(0);

  const activeToolRef = useRef('');
  const drawingStepRef = useRef(0);
  const drawingPoint1Ref = useRef<any>(null);
  const trendlineSeriesArrayRef = useRef<any[]>([]);

  const setActiveTool = (t: string) => {
    activeToolRef.current = t;
    setActiveToolState(t);
  };
  const setDrawingStep = (s: number) => {
    drawingStepRef.current = s;
    setDrawingStepState(s);
  };

  // Real-time Bids/Asks Market Depth states
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [buyVolumeTotal, setBuyVolumeTotal] = useState(566700);
  const [sellVolumeTotal, setSellVolumeTotal] = useState(149100);

  // Live matching logs state
  const [trades, setTrades] = useState<TradeLog[]>([]);

  // Base Reference Prices
  const [tc, setTc] = useState(22850);
  const [tran, setTran] = useState(2440);
  const [san, setSan] = useState(2130);

  // Fetch Quotes & Details
  useEffect(() => {
    if (!isOpen || !symbol) return;

    setTrades([]);

    async function fetchDetails() {
      try {
        const res = await marketApi.getDetail(symbol);
        if (res.success && res.data) {
          const quote = res.data.latestQuote;
          if (quote) {
            setLatestQuote(quote);
            const basePrice = Number(quote.previousClose) || Number(quote.price) || 22850;
            setTc(basePrice);
            setTran(Math.round(basePrice * 1.07));
            setSan(Math.round(basePrice * 0.93));
            generateMockDepth(Number(quote.price) || basePrice);
          }
        }
      } catch (err) {
        console.error('Failed to load instrument detail:', err);
      }
    }
    fetchDetails();

    function generateMockDepth(price: number) {
      const step = 50;
      const mockBids: OrderBookRow[] = [
        { price: price, volume: 9300, percentage: 0 },
        { price: price - step, volume: 237600, percentage: 0 },
        { price: price - step * 2, volume: 319800, percentage: 0 }
      ];
      const mockAsks: OrderBookRow[] = [
        { price: price + step, volume: 33300, percentage: 0 },
        { price: price + step * 2, volume: 96000, percentage: 0 },
        { price: price + step * 3, volume: 19800, percentage: 0 }
      ];

      const maxVol = Math.max(...[...mockBids, ...mockAsks].map(x => x.volume), 1);
      mockBids.forEach(x => x.percentage = (x.volume / maxVol) * 100);
      mockAsks.forEach(x => x.percentage = (x.volume / maxVol) * 100);

      setBids(mockBids);
      setAsks(mockAsks);
    }

    // Connect WebSockets
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

      // Trade Matching continuous log pushes
      const timeStr = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const tradeType: 'BUY' | 'SELL' = Math.random() > 0.45 ? 'BUY' : 'SELL';
      const tradeVol = Math.floor(100 + Math.random() * 8000);

      setTrades(prev => [
        { time: timeStr, price: tick.price, volume: tradeVol, type: tradeType, change: tick.change },
        ...prev.slice(0, 18)
      ]);

      // Fluctuate Depth
      setBids(prevBids => {
        const step = 50;
        const updated = prevBids.map((b, idx) => {
          const delta = (Math.random() - 0.5) * 5000;
          const vol = Math.max(2000, Math.round(b.volume + delta));
          return { price: tick.price - step * idx, volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume), 1);
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      setAsks(prevAsks => {
        const step = 50;
        const updated = prevAsks.map((a, idx) => {
          const delta = (Math.random() - 0.5) * 5000;
          const vol = Math.max(2000, Math.round(a.volume + delta));
          return { price: tick.price + step * (idx + 1), volume: vol, percentage: 0 };
        });
        const maxVol = Math.max(...updated.map(x => x.volume), 1);
        updated.forEach(x => x.percentage = (x.volume / maxVol) * 100);
        return updated;
      });

      setBuyVolumeTotal(prev => Math.max(50000, Math.round(prev + (tradeType === 'BUY' ? tradeVol : -tradeVol * 0.4))));
      setSellVolumeTotal(prev => Math.max(50000, Math.round(prev + (tradeType === 'SELL' ? tradeVol : -tradeVol * 0.4))));

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
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isOpen, symbol]);

  // Load raw candles, setup Lightweight chart and handle drawing callbacks
  useEffect(() => {
    if (!isOpen || !symbol) return;

    setLoadingChart(true);
    let chart: any;

    const timer = setTimeout(() => {
      if (chartContainerRef.current) {
        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#06070a' },
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
          width: chartContainerRef.current.clientWidth || 700,
          height: 400,
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

        // Fetch Raw Candle Data
        async function fetchRawData() {
          try {
            const res = await marketApi.getCandles(symbol);
            if (res.success && res.data && res.data.length > 0) {
              rawCandlesRef.current = res.data;
              renderIntervalChart(timeframe);
            }
          } catch (e) {
            console.error('Error fetching candles:', e);
          } finally {
            setLoadingChart(false);
          }
        }
        fetchRawData();

        // Subscribe to clicks inside the chart to draw interactive trendlines!
        chart.subscribeClick((param: any) => {
          if (!param.time || !param.point) return;
          if (!activeToolRef.current) return;

          const activePrice = candlestickSeries.coordinateToPrice(param.point.y);
          if (activePrice === null || activePrice === undefined) return;

          if (activeToolRef.current === 'trendline') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm thứ hai trên đồ thị để vẽ đường xu hướng');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

              // Add a straight line series directly inside the lightweight chart
              const trendlineSeries = chart.addSeries(LineSeries, {
                color: '#e040fb',
                lineWidth: 2,
                title: 'Trendline'
              });
              trendlineSeries.setData([
                { time: p1.time, value: p1.price },
                { time: p2.time, value: p2.price }
              ]);

              trendlineSeriesArrayRef.current.push(trendlineSeries);

              // Reset tool
              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setDrawStatus('Vẽ đường xu hướng hoàn tất! Chọn lại công cụ vẽ nếu muốn tiếp tục.');
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
        });
      }
    }, 150);

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
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      trendlineSeriesArrayRef.current = [];
    };
  }, [isOpen, symbol]);

  // Recalculates and renders candlestick data when timeframe or indicators change
  const renderIntervalChart = (newInterval: '1m' | '5m' | '15m' | '1D' | '1W') => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    const formatted = getIntervalCandles(rawCandlesRef.current, newInterval);
    candlestickSeriesRef.current.setData(formatted);
    chartRef.current.timeScale().fitContent();

    if (formatted.length > 0) {
      latestBarRef.current = formatted[formatted.length - 1];
    }

    // Toggle Technical Indicators Lines
    renderIndicators(formatted);
  };

  const renderIndicators = (activeCandles: any[]) => {
    if (!chartRef.current) return;

    // Redraw SMA(20) line
    if (smaSeriesRef.current) {
      try { chartRef.current.removeSeries(smaSeriesRef.current); } catch (e) { }
      smaSeriesRef.current = null;
    }
    if (showSMA && activeCandles.length >= 20) {
      const smaData = calculateSMA(activeCandles, 20);
      const smaLine = chartRef.current.addSeries(LineSeries, {
        color: '#ffb300',
        lineWidth: 1.5,
        title: 'SMA(20)'
      });
      smaLine.setData(smaData);
      smaSeriesRef.current = smaLine;
    }

    // Redraw EMA(50) line
    if (emaSeriesRef.current) {
      try { chartRef.current.removeSeries(emaSeriesRef.current); } catch (e) { }
      emaSeriesRef.current = null;
    }
    if (showEMA && activeCandles.length >= 50) {
      const emaData = calculateEMA(activeCandles, 50);
      const emaLine = chartRef.current.addSeries(LineSeries, {
        color: '#00cfff',
        lineWidth: 1.5,
        title: 'EMA(50)'
      });
      emaLine.setData(emaData);
      emaSeriesRef.current = emaLine;
    }
  };

  // Re-run indicators mapping on toggle
  useEffect(() => {
    if (!isOpen || !chartRef.current || !rawCandlesRef.current.length) return;
    const formatted = getIntervalCandles(rawCandlesRef.current, timeframe);
    renderIndicators(formatted);
  }, [showSMA, showEMA]);

  // Handle interval updates
  const handleTimeframeChange = (newTf: '1m' | '5m' | '15m' | '1D' | '1W') => {
    setTimeframe(newTf);
    renderIntervalChart(newTf);
  };

  // Range zoom handler using lightweight charts priceScale visible timeline range
  const handleRangeChange = (rangeType: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'All') => {
    setRange(rangeType);
    if (!chartRef.current || !latestBarRef.current) return;

    const now = latestBarRef.current.time;
    let pastTime = now;

    if (rangeType === '1d') pastTime = now - 24 * 3600;
    else if (rangeType === '5d') pastTime = now - 5 * 24 * 3600;
    else if (rangeType === '1m') pastTime = now - 30 * 24 * 3600;
    else if (rangeType === '3m') pastTime = now - 90 * 24 * 3600;
    else if (rangeType === '6m') pastTime = now - 180 * 24 * 3600;
    else if (rangeType === '1y') pastTime = now - 365 * 24 * 3600;
    else if (rangeType === '5y') pastTime = now - 5 * 365 * 24 * 3600;
    else {
      chartRef.current.timeScale().fitContent();
      return;
    }

    chartRef.current.timeScale().setVisibleRange({
      from: pastTime,
      to: now
    });
  };

  // Clear drawn items
  const clearDrawings = () => {
    if (!chartRef.current) return;
    trendlineSeriesArrayRef.current.forEach(series => {
      try { chartRef.current.removeSeries(series); } catch (e) { }
    });
    trendlineSeriesArrayRef.current = [];
    setDrawStatus('Đã xóa tất cả đường vẽ.');
    setTimeout(() => setDrawStatus(''), 3000);
  };

  if (!isOpen) return null;

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  const totalVolume = buyVolumeTotal + sellVolumeTotal;
  const buyPercent = totalVolume > 0 ? (buyVolumeTotal / totalVolume) * 100 : 50;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[1000] p-4 select-none animate-fade-in font-inter">
      {/* Click outside backdrop container to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Centered Modal Card Container (80-90% viewport size) */}
      <div className="relative w-[92vw] max-w-[1450px] h-[85vh] bg-[#080b11] border border-[#1b2233] rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary z-10 animate-scale-up">

        {/* ─── 1. TOP HEADER BAR ─── */}
        <header className="flex justify-between items-center py-2 px-4 border-b border-[#181e2b] bg-[#0d1017] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#171d2a] p-1.5 px-3 rounded border border-[#2d3748]/40">
              <span className="font-extrabold text-[#00c58e] text-base tracking-tight">{symbol.toUpperCase()}</span>
              <span className="text-[10px] text-text-muted font-bold bg-[#0d1017] px-1 rounded uppercase">HOSE</span>
            </div>

            <div className="hidden md:block">
              <p className="text-xs text-text-secondary font-semibold m-0 leading-tight">
                {getCompanyName(symbol)}
              </p>
            </div>

            {/* Live Quotes Price specs */}
            <div className="flex items-center gap-4 ml-6 pl-6 border-l border-[#1a2233]">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-outfit ${priceColor} text-2xl font-extrabold tracking-tight`}>
                  {currentPrice.toLocaleString()}
                </span>
                <span className={`text-[10.5px] font-bold ${priceColor}`}>
                  {currentChange >= 0 ? '+' : ''}{currentChange.toLocaleString()} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(2)}%)
                </span>
              </div>

              <div className="hidden lg:flex gap-3 text-[10px] text-text-muted font-bold">
                <span>Mở cửa: <span className="text-white">{(tc - 50).toLocaleString()}</span></span>
                <span>Cao nhất: <span className="text-up">{(currentPrice + 100).toLocaleString()}</span></span>
                <span>Thấp nhất: <span className="text-down">{(currentPrice - 100).toLocaleString()}</span></span>
              </div>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-[10px] font-bold">
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90">TRẦN</span>
                <span className="text-ceil">{tran.toLocaleString()}</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90">SÀN</span>
                <span className="text-floor">{san.toLocaleString()}</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90">THAM CHIẾU</span>
                <span className="text-ref">{tc.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-[#1a2233] pl-4">
              <button
                className="bg-[#141923] border border-[#2d3748] hover:border-[#4a5568] text-white text-xs px-3.5 py-1.5 rounded font-bold cursor-pointer transition-colors shrink-0"
                onClick={handleAIScan}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang quét...
                  </>
                ) : (
                  <div className='flex flex-row'>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Phân tích với AI
                  </div>
                )}
              </button>
              <button
                onClick={onClose}
                className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer p-1.5 ml-1 transition-colors flex items-center shrink-0"
                title="Đóng chi tiết"
              >
                <X size={22} />
              </button>
            </div>
          </div>
        </header>

        {/* ─── 2. TABS STRIP ─── */}
        <nav className="flex gap-1.5 px-4 bg-[#080b11] border-b border-[#181e2b] overflow-x-auto shrink-0 scrollbar-none">
          {(['Giao dịch', 'Hồ sơ', 'Cổ đông', 'Vốn và cổ tức', 'Tin tức', 'Lịch sự kiện', 'Thống kê', 'Tài chính'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 border-0 border-b-2 font-outfit font-extrabold text-[11.5px] uppercase tracking-wider cursor-pointer bg-transparent transition-all duration-150 whitespace-nowrap ${activeTab === tab
                ? 'border-[#00c58e] text-[#00c58e] bg-[#00c58e]/3'
                : 'border-transparent text-text-muted hover:text-white hover:bg-white/2'
                }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* ─── 3. MAIN WORKSPACE 3-COLUMN ─── */}
        <div className="flex-grow flex w-full overflow-hidden">

          {/* COLUMN 1: CHART & TOOLS (58% width) */}
          <section className="w-[58%] h-full flex border-r border-[#151a24] bg-[#06070a] overflow-hidden">

            {/* Interactive Drawing tools bar (Fully functional trendline draw togglers!) */}
            <div className="w-[45px] shrink-0 h-full border-r border-[#151a24] bg-[#090b11] flex flex-col items-center py-4 gap-4 text-text-muted text-[13px]">
              <button
                onClick={() => setActiveTool('')}
                className={`bg-transparent border-0 cursor-pointer p-1 rounded transition-colors ${!activeTool ? 'text-white bg-white/10' : 'text-text-muted hover:text-white'}`}
                title="Con trỏ chuột"
              >
                🖱️
              </button>
              <button
                onClick={() => {
                  setActiveTool('trendline');
                  setDrawingStep(0);
                  setDrawingPoint1(null);
                  setDrawStatus('Click điểm bắt đầu trên đồ thị để chọn điểm 1');
                }}
                className={`bg-transparent border-0 cursor-pointer p-1 rounded transition-colors ${activeTool === 'trendline' ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-text-muted hover:text-white'}`}
                title="Vẽ đường xu hướng (Click 2 điểm trên chart)"
              >
                📈
              </button>
              <button
                onClick={clearDrawings}
                className="bg-transparent border-0 cursor-pointer p-1 rounded text-red-400 hover:text-red-300 transition-colors"
                title="Xóa tất cả đường vẽ"
              >
                🗑️
              </button>
            </div>

            <div className="flex-grow h-full flex flex-col overflow-hidden">
              {/* Chart details top strip */}
              <div className="flex justify-between items-center px-4 py-2 border-b border-[#131822] bg-[#080b11] text-[10px] font-bold text-text-secondary">
                <div className="flex items-center gap-3">
                  <span className="text-[#00c58e]">{symbol.toUpperCase()}</span>
                  <span className="text-white bg-white/10 px-1 rounded">{timeframe}</span>
                  <span>HOSE</span>

                  {/* Indicators toggle bar */}
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-[#1a2233]">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSMA}
                        onChange={(e) => setShowSMA(e.target.checked)}
                        className="rounded border-[#2d3748] accent-[#ffb300]"
                      />
                      <span className="text-[#ffb300]">SMA(20)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
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
                    <span className="ml-4 text-purple-400 font-extrabold animate-pulse">
                      ✏️ {drawStatus}
                    </span>
                  )}
                </div>

                {/* Interactive Intervals */}
                <div className="flex gap-1.5 bg-white/2 p-0.5 rounded border border-white/5">
                  {(['1m', '5m', '15m', '1D', '1W'] as const).map(tf => (
                    <span
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-1.5 py-0.5 rounded text-[8px] cursor-pointer font-extrabold transition-colors ${timeframe === tf ? 'bg-[#00c58e]/20 text-[#00c58e]' : 'text-text-muted hover:text-white'}`}
                    >
                      {tf}
                    </span>
                  ))}
                </div>
              </div>

              {/* Candlestick chart viewport */}
              <div className="flex-grow w-full relative bg-[#06070a]">
                {loadingChart && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#06070a]/90 z-20">
                    <Loader2 size={32} className="pulse text-[#00c58e] animate-spin" />
                  </div>
                )}

                {/* AI Loading overlay */}
                {aiLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#06070a]/95 z-25 text-center p-4">
                    <Loader2 className="animate-spin text-warning mb-3" size={32} />
                    <h5 className="font-outfit text-warning font-bold text-sm mb-1">Mạng Nơ-ron AI Đang Quét...</h5>
                    <p className="text-[10px] text-text-secondary leading-relaxed">Đang đối chiếu các tín hiệu kỹ thuật & tin tức của {symbol.toUpperCase()}</p>
                  </div>
                )}

                {/* AI Summary Error banner */}
                {aiMessage && (
                  <div className="absolute top-4 left-4 right-4 bg-rose-500/10 border border-rose-500/20 text-bearish text-xs text-center p-2.5 rounded-lg z-25 font-medium">
                    ⚠️ {aiMessage}
                  </div>
                )}

                {/* AI Summary report overlay card */}
                {aiSummary && (
                  <div className="absolute top-4 left-4 right-4 bg-[#0d1017]/95 border border-warning/30 rounded-xl p-4 z-25 max-h-[90%] overflow-y-auto shadow-2xl animate-scale-up font-inter">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-warning font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                        ⭐ Luận Điểm Đầu Tư AI - {symbol.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setAiSummary(null)}
                        className="bg-transparent border-0 text-text-muted hover:text-white cursor-pointer p-0.5"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed mb-3">
                      {aiSummary.summary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg text-[10.5px]">
                        <span className="text-emerald-400 font-bold block mb-1">📈 Động lực tăng trưởng:</span>
                        <ul className="pl-3 list-disc text-text-muted flex flex-col gap-0.5">
                          {aiSummary.drivers.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg text-[10.5px]">
                        <span className="text-rose-400 font-bold block mb-1">📉 Rủi ro catalysts:</span>
                        <ul className="pl-3 list-disc text-text-muted flex flex-col gap-0.5">
                          {aiSummary.risks.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chartContainerRef} className="w-full h-full" />
              </div>

              {/* Timeframe controls bar & ranges (Functional zooming!) */}
              <div className="flex justify-between items-center py-2 px-4 border-t border-[#131822] bg-[#080b11] text-[9.5px] text-text-muted font-bold">
                <div className="flex gap-2">
                  {(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'All'] as const).map(rangeType => (
                    <span
                      key={rangeType}
                      onClick={() => handleRangeChange(rangeType)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${range === rangeType ? 'bg-white/10 text-white font-extrabold' : 'hover:text-white'}`}
                    >
                      {rangeType.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3 text-text-muted">
                  <span className="cursor-pointer hover:text-white">%</span>
                  <span className="cursor-pointer hover:text-white">log</span>
                  <span className="text-[#00c58e] cursor-pointer" title="Auto fit scaling" onClick={() => handleRangeChange('All')}>tự động</span>
                </div>
              </div>
            </div>
          </section>

          {/* COLUMN 2: DEPTH BOOK & VISUAL DEPTH CHART (21% width) */}
          <section className="w-[21%] h-full flex flex-col border-r border-[#151a24] bg-[#080b11] overflow-y-auto shrink-0 select-none">

            {/* Depth values card */}
            <div className="p-3 border-b border-[#151a24]">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Độ sầu thị trường</span>
                <span className="text-[8.5px] text-text-muted font-bold">Tổng KL Mua/Bán</span>
              </div>

              {/* Buy/Sell Volume Ratio indicator bar */}
              <div className="flex h-3 rounded-full overflow-hidden text-[8px] font-extrabold text-white text-center mb-3">
                <div
                  className="bg-emerald-500 transition-[width] duration-300 leading-3 pl-1.5 text-left"
                  style={{ width: `${buyPercent}%` }}
                >
                  Dư mua: {buyVolumeTotal.toLocaleString()}
                </div>
                <div
                  className="bg-red-500 transition-[width] duration-300 leading-3 pr-1.5 text-right"
                  style={{ width: `${100 - buyPercent}%` }}
                >
                  Dư bán: {sellVolumeTotal.toLocaleString()}
                </div>
              </div>

              {/* Bids/Asks depth table grid */}
              <table className="w-full text-[10.5px] border-collapse">
                <thead>
                  <tr className="text-text-muted border-b border-[#151a24]/80 h-5">
                    <th className="text-left pb-0.5 font-bold uppercase text-[9px] w-2/5">KL</th>
                    <th className="text-right pb-0.5 font-bold uppercase text-[9px] w-1/5 pr-1">Giá mua</th>
                    <th className="text-left pb-0.5 font-bold uppercase text-[9px] w-1/5 pl-1">Giá bán</th>
                    <th className="text-right pb-0.5 font-bold uppercase text-[9px] w-2/5">KL</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, idx) => {
                    const ask = asks[idx] || { price: 0, volume: 0, percentage: 0 };
                    const bidPriceColor = bid.price > tc ? 'text-up' : bid.price < tc ? 'text-down' : 'text-ref';
                    const askPriceColor = ask.price > tc ? 'text-up' : ask.price < tc ? 'text-down' : 'text-ref';

                    return (
                      <tr key={idx} className="h-6 hover:bg-white/2 transition-colors">
                        <td className="relative text-left text-white font-medium pl-1">
                          <div
                            className="absolute left-0 top-0.5 bottom-0.5 bg-emerald-500/10 rounded transition-[width] duration-300"
                            style={{ width: `${bid.percentage}%` }}
                          />
                          <span className="relative z-10">{bid.volume.toLocaleString()}</span>
                        </td>
                        <td className={`${bidPriceColor} font-extrabold text-right pr-1`}>{bid.price.toLocaleString()}</td>

                        <td className={`${askPriceColor} font-extrabold text-left pl-1`}>{ask.price.toLocaleString()}</td>
                        <td className="relative text-right text-white font-medium pr-1">
                          <div
                            className="absolute right-0 top-0.5 bottom-0.5 bg-red-500/10 rounded transition-[width] duration-300"
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

            {/* Visual Depth Chart columns */}
            <div className="flex flex-col gap-2 p-3 bg-[#0c0f16]/30 border-b border-[#151a24]">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Biểu đồ độ sâu thị trường</span>
              <div className="h-[120px] w-full flex items-end justify-between gap-1 px-2 pt-2 relative">
                {/* Bids volume bars */}
                <div className="flex-1 h-full flex items-end justify-end gap-1 border-r border-[#1a2233]/40 pr-1">
                  {bids.slice().reverse().map((bid, i) => {
                    const maxVolume = Math.max(...[...bids, ...asks].map(x => x.volume), 1);
                    const h = (bid.volume / maxVolume) * 90;
                    return (
                      <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                        <div
                          style={{ height: `${h}%` }}
                          className="w-full bg-emerald-500/25 border border-emerald-500/40 rounded-t hover:bg-emerald-500/45 transition-all duration-150"
                        />
                        <span className="text-[8px] text-emerald-500 font-bold scale-90">{bid.price.toLocaleString()}</span>
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#141923] border border-[#2d3748]/60 text-[8px] text-white p-1 rounded z-30 shadow-xl whitespace-nowrap">
                          Mua: {bid.price} | KL: {bid.volume.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Asks volume bars */}
                <div className="flex-1 h-full flex items-end justify-start gap-1 pl-1">
                  {asks.map((ask, i) => {
                    const maxVolume = Math.max(...[...bids, ...asks].map(x => x.volume), 1);
                    const h = (ask.volume / maxVolume) * 90;
                    return (
                      <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                        <div
                          style={{ height: `${h}%` }}
                          className="w-full bg-red-500/25 border border-red-500/40 rounded-t hover:bg-red-500/45 transition-all duration-150"
                        />
                        <span className="text-[8px] text-red-500 font-bold scale-90">{ask.price.toLocaleString()}</span>
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#141923] border border-[#2d3748]/60 text-[8px] text-white p-1 rounded z-30 shadow-xl whitespace-nowrap">
                          Bán: {ask.price} | KL: {ask.volume.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </section>

          {/* COLUMN 3: REAL-TIME TRANSACTION LOGS (21% width) */}
          <section className="w-[21%] h-full flex flex-col bg-[#080b11] overflow-hidden shrink-0">

            <div className="p-3 border-b border-[#151a24] flex justify-between items-center shrink-0">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Khớp lệnh</span>
              <div className="flex gap-2 text-[9px] font-bold text-[#7b8a9b]">
                <span>KL: <span className="text-white">{(trades.reduce((acc, t) => acc + t.volume, 0) || 45300).toLocaleString()}</span></span>
                <span className="text-up">M: {buyPercent.toFixed(0)}%</span>
                <span className="text-down">B: {(100 - buyPercent).toFixed(0)}%</span>
              </div>
            </div>

            {/* Trades history dynamic stream */}
            <div className="flex-grow overflow-y-auto">
              <table className="w-full text-[10.5px]">
                <thead>
                  <tr className="sticky top-0 bg-[#0d1017] text-text-muted border-b border-[#151a24] h-7 z-10">
                    <th className="text-left pl-3 font-semibold text-[9px] uppercase">Thời gian</th>
                    <th className="text-right font-semibold text-[9px] uppercase">Giá</th>
                    <th className="text-right font-semibold text-[9px] uppercase">+/-</th>
                    <th className="text-right pr-3 font-semibold text-[9px] uppercase">KL</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-8 text-text-muted font-bold text-xs italic">
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    trades.map((t, idx) => {
                      const diff = Number(t.price) - tc;
                      return (
                        <tr key={idx} className="h-6 border-b border-[#151a24]/30 hover:bg-white/2 transition-colors">
                          <td className="pl-3 text-text-muted font-mono">{t.time}</td>
                          <td className={`${t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref'} font-extrabold text-right`}>
                            {t.price.toLocaleString()}
                          </td>
                          <td className={`${diff >= 0 ? 'text-up' : 'text-down'} text-right font-semibold font-mono text-[9px]`}>
                            {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                          </td>
                          <td className={`text-right pr-3 font-semibold font-mono ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}>
                            {t.volume.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </section>

        </div>
      </div>
    </div>
  );
}
