import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, ISeriesApi } from 'lightweight-charts';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2, Sparkles, Activity, MousePointer, LineChart, Hash, Square, MessageSquare, Ruler, Search, Magnet, Lock, Unlock, Trash2, AlertTriangle, Calendar, Newspaper } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { marketApi } from '@/lib/api/market.api';
import { CompanyFinancials } from '@/lib/helpers/company-data';

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

const renderParsedSummary = (summaryText: string) => {
  if (!summaryText) return null;

  const hasPosition = summaryText.includes('ĐÁNH GIÁ VỊ THẾ');
  const hasAction = summaryText.includes('CHIẾN LƯỢC');
  const hasPrice = summaryText.includes('VÙNG GIÁ');

  if (hasPosition || hasAction || hasPrice) {
    const extractPart = (text: string, markers: string[], nextMarkers?: string[]) => {
      let startIndex = -1;
      let matchedMarker = '';
      for (const m of markers) {
        startIndex = text.indexOf(m);
        if (startIndex !== -1) {
          matchedMarker = m;
          break;
        }
      }

      if (startIndex === -1) return '';

      const contentStart = startIndex + matchedMarker.length;

      let endIndex = text.length;
      if (nextMarkers) {
        for (const nm of nextMarkers) {
          const idx = text.indexOf(nm);
          if (idx !== -1 && idx > contentStart) {
            endIndex = idx;
            break;
          }
        }
      }

      let chunk = text.slice(contentStart, endIndex).trim();
      chunk = chunk.replace(/^[:\*\s]+/, '').replace(/[:\*\s]+$/, '');
      return chunk;
    };

    const positionStart = ['📌 **ĐÁNH GIÁ VỊ THẾ & LÝ DO:**', '📌 **ĐÁNH GIÁ VỊ THẾ:**', 'ĐÁNH GIÁ VỊ THẾ & LÝ DO', 'ĐÁNH GIÁ VỊ THẾ'];
    const actionStart = ['🎯 **CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT:**', '🎯 **CHIẾN LƯỢC HÀNH ĐỘNG:**', 'CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT', 'CHIẾN LƯỢC HÀNH ĐỘNG'];
    const priceStart = ['💸 **VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG:**', '💸 **VÙNG GIÁ THAM KHẢO:**', 'VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG', 'VÙNG GIÁ THAM KHẢO'];

    const positionText = extractPart(summaryText, positionStart, actionStart);
    const actionText = extractPart(summaryText, actionStart, priceStart);
    const priceText = extractPart(summaryText, priceStart);

    return (
      <div className="flex flex-col gap-2.5 mb-3">
        {positionText && (
          <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold text-[10.5px] uppercase tracking-wider mb-1.5">
              📌 Đánh giá vị thế & Lý do
            </span>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0">{positionText}</p>
          </div>
        )}
        {actionText && (
          <div className="p-3 bg-warning/5 border border-warning/15 rounded-xl">
            <span className="flex items-center gap-1.5 text-warning font-bold text-[10.5px] uppercase tracking-wider mb-1.5">
              🎯 Chiến lược phân bổ & Hành động chi tiết
            </span>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0">{actionText}</p>
          </div>
        )}
        {priceText && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[10.5px] uppercase tracking-wider mb-1.5">
              💸 Vùng giá tham khảo & Điểm dừng quản trị
            </span>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0">{priceText}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap text-[11.5px] text-text-secondary leading-relaxed mb-3">
      {summaryText}
    </div>
  );
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

  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [financials, setFinancials] = useState<any>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

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
  const [isMagnet, setIsMagnet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
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
  const isMagnetRef = useRef(false);
  const isLockedRef = useRef(false);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    isMagnetRef.current = isMagnet;
  }, [isMagnet]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

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
    setFinancials(null);

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
            generateMockTradesHistory(Number(quote.price) || basePrice, basePrice);
          }
          if (res.data.aiSummary) {
            setAiSummary(res.data.aiSummary);
          }
        }
      } catch (err) {
        console.error('Failed to load instrument detail:', err);
      }
    }

    async function fetchFinancials() {
      setLoadingFinancials(true);
      try {
        const res = await marketApi.getFinancials(symbol);
        if (res && res.success && res.data) {
          setFinancials(res.data);
        }
      } catch (err) {
        console.error('Failed to load financials:', err);
      } finally {
        setLoadingFinancials(false);
      }
    }

    fetchDetails();
    fetchFinancials();

    function generateMockTradesHistory(price: number, basePrice: number) {
      const mockTrades: TradeLog[] = [];
      const now = new Date();
      
      for (let i = 0; i < 15; i++) {
        const tradeTime = new Date(now.getTime() - i * Math.floor(3 + Math.random() * 12) * 1000);
        const timeStr = tradeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const priceOffset = (Math.floor(Math.random() * 5) - 2) * 50;
        const tradePrice = Math.max(Math.round(basePrice * 0.93), Math.min(Math.round(basePrice * 1.07), price + priceOffset));
        
        const tradeType: 'BUY' | 'SELL' = Math.random() > 0.48 ? 'BUY' : 'SELL';
        const tradeVol = Math.floor(1 + Math.random() * 75) * 100;
        
        mockTrades.push({
          time: timeStr,
          price: tradePrice,
          volume: tradeVol,
          type: tradeType,
          change: tradePrice - basePrice
        });
      }
      
      setTrades(mockTrades);
    }

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
    if (!isOpen || !symbol || activeTab !== 'Giao dịch') return;

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
          height: chartContainerRef.current.clientHeight || 550,
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

        // Subscribe to clicks inside the chart to draw interactive trendlines & professional tools!
        chart.subscribeClick((param: any) => {
          if (!param.time || !param.point) return;
          if (!activeToolRef.current) return;

          if (isLockedRef.current) {
            setDrawStatus('Hình vẽ đã bị khóa! Hãy mở khóa (Unlock) trên thanh công cụ để tiếp tục vẽ.');
            setTimeout(() => setDrawStatus(''), 3000);
            return;
          }

          let activePrice = candlestickSeries.coordinateToPrice(param.point.y);
          if (activePrice === null || activePrice === undefined) return;

          // 🧲 Magnet snap logic! Snaps to nearest High/Low of the hovered candlestick
          if (isMagnetRef.current && rawCandlesRef.current.length > 0) {
            const candle = rawCandlesRef.current.find(c => {
              if (typeof c.time === 'string' && typeof param.time === 'string') {
                return c.time === param.time;
              }
              if (typeof c.time === 'object' && typeof param.time === 'object' && c.time && param.time) {
                return c.time.year === param.time.year && c.time.month === param.time.month && c.time.day === param.time.day;
              }
              return JSON.stringify(c.time) === JSON.stringify(param.time);
            });
            if (candle) {
              const highDiff = Math.abs(activePrice - candle.high);
              const lowDiff = Math.abs(activePrice - candle.low);
              activePrice = highDiff < lowDiff ? candle.high : candle.low;
            }
          }

          const currentTool = activeToolRef.current;

          // 📈 Tool 1: Trendline
          if (currentTool === 'trendline') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm thứ hai trên đồ thị để vẽ đường xu hướng');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

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

              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setDrawStatus('Đã vẽ đường xu hướng (Trendline) hoàn tất!');
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
          // 🔱 Tool 2: Fibonacci Retracement
          else if (currentTool === 'fibonacci') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm thứ hai (Swing High/Low) để hoàn tất tỷ lệ Fibonacci');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

              const diff = p2.price - p1.price;
              const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 1.0];
              const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff'];

              // Add dashed connection line
              const connectLine = chart.addSeries(LineSeries, {
                color: '#7b8a9b',
                lineWidth: 1,
                lineStyle: 1, // Dotted
                title: 'Fib Connect'
              });
              connectLine.setData([
                { time: p1.time, value: p1.price },
                { time: p2.time, value: p2.price }
              ]);
              trendlineSeriesArrayRef.current.push(connectLine);

              // Draw horizontal ratio levels
              fibLevels.forEach((level, idx) => {
                const levelPrice = p1.price + diff * level;
                const levelSeries = chart.addSeries(LineSeries, {
                  color: colors[idx],
                  lineWidth: 1.5,
                  title: `Fib ${(level * 100).toFixed(1)}%`
                });
                levelSeries.setData([
                  { time: p1.time, value: levelPrice },
                  { time: p2.time, value: levelPrice }
                ]);
                trendlineSeriesArrayRef.current.push(levelSeries);
              });

              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setDrawStatus('Vẽ tỷ lệ Fibonacci Retracement hoàn tất!');
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
          // 🟩 Tool 3: Shapes (Rectangle Zone)
          else if (currentTool === 'shapes') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm chéo đối diện thứ hai để hoàn tất vùng giá');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

              const topPrice = Math.max(p1.price, p2.price);
              const bottomPrice = Math.min(p1.price, p2.price);
              const zoneColor = '#00c58e';

              // Drawing border lines of the rectangle box zone
              const topLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1.5, title: 'Zone Top' });
              topLine.setData([{ time: p1.time, value: topPrice }, { time: p2.time, value: topPrice }]);
              trendlineSeriesArrayRef.current.push(topLine);

              const bottomLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1.5, title: 'Zone Bottom' });
              bottomLine.setData([{ time: p1.time, value: bottomPrice }, { time: p2.time, value: bottomPrice }]);
              trendlineSeriesArrayRef.current.push(bottomLine);

              const leftLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, lineStyle: 2, title: 'Zone Left' });
              leftLine.setData([{ time: p1.time, value: bottomPrice }, { time: p1.time, value: topPrice }]);
              trendlineSeriesArrayRef.current.push(leftLine);

              const rightLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, lineStyle: 2, title: 'Zone Right' });
              rightLine.setData([{ time: p2.time, value: bottomPrice }, { time: p2.time, value: topPrice }]);
              trendlineSeriesArrayRef.current.push(rightLine);

              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setDrawStatus('Đã vẽ vùng giá chữ nhật (Price Zone) hoàn tất!');
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
          // 💬 Tool 4: Text Annotation
          else if (currentTool === 'text') {
            const userText = prompt('Nhập nội dung ghi chú/chú thích tại vị trí nến này:');
            if (userText && userText.trim()) {
              const newMarker = {
                time: param.time,
                position: 'aboveBar',
                color: '#e040fb',
                shape: 'arrowDown',
                text: userText.trim(),
                size: 1.5
              };
              markersRef.current.push(newMarker);
              (candlestickSeries as any).setMarkers([...markersRef.current]);
              setDrawStatus('Đã tạo chú thích văn bản thành công!');
            }
            setActiveTool('');
            setTimeout(() => setDrawStatus(''), 4000);
          }
          // 📏 Tool 5: Ruler (Time & Price Range measurements)
          else if (currentTool === 'ruler') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm thứ hai để tính toán chênh lệch đo lường');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

              const priceDiff = p2.price - p1.price;
              const priceDiffPct = (priceDiff / p1.price) * 100;

              let barsCount = 1;
              if (rawCandlesRef.current.length > 0) {
                const idx1 = rawCandlesRef.current.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p1.time));
                const idx2 = rawCandlesRef.current.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p2.time));
                if (idx1 !== -1 && idx2 !== -1) {
                  barsCount = Math.abs(idx2 - idx1) + 1;
                }
              }

              // Draw temporary dashed measurement line
              const rulerLine = chart.addSeries(LineSeries, {
                color: '#00cfff',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                title: 'Ruler Measurement'
              });
              rulerLine.setData([
                { time: p1.time, value: p1.price },
                { time: p2.time, value: p2.price }
              ]);
              trendlineSeriesArrayRef.current.push(rulerLine);

              alert(`📏 ĐO LƯỜNG PHÂN TÍCH KHOẢNG GIÁ & THỜI GIAN:\n\n` +
                    `- Điểm bắt đầu: ${p1.price.toLocaleString()}đ\n` +
                    `- Điểm kết thúc: ${p2.price.toLocaleString()}đ\n` +
                    `- Chênh lệch giá: ${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()}đ (${priceDiffPct >= 0 ? '+' : ''}${priceDiffPct.toFixed(2)}%)\n` +
                    `- Số nến giao dịch: ${barsCount} nến`);

              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setDrawStatus('Đo lường khoảng giá hoàn tất!');
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
          // 🔍 Tool 6: Zoom Range
          else if (currentTool === 'zoom') {
            if (drawingStepRef.current === 0) {
              setDrawingPoint1({ time: param.time, price: activePrice });
              drawingPoint1Ref.current = { time: param.time, price: activePrice };
              setDrawingStep(1);
              setDrawStatus('Click điểm thứ hai để hoàn tất vùng thời gian thu phóng');
            } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
              const p1 = drawingPoint1Ref.current;
              const p2 = { time: param.time, price: activePrice };

              try {
                chart.timeScale().setVisibleRange({
                  from: p1.time,
                  to: p2.time
                });
                setDrawStatus('Đã thu phóng cận cảnh vùng thời gian thành công!');
              } catch (e) {
                setDrawStatus('Thu phóng bằng con lăn chuột.');
              }

              setActiveTool('');
              setDrawingStep(0);
              setDrawingPoint1(null);
              setTimeout(() => setDrawStatus(''), 4000);
            }
          }
        });
      }
    }, 150);

    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
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
      candlestickSeriesRef.current = null;
      latestBarRef.current = null;
      trendlineSeriesArrayRef.current = [];
    };
  }, [isOpen, symbol, activeTab]);

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
    markersRef.current = [];
    if (candlestickSeriesRef.current) {
      try { (candlestickSeriesRef.current as any).setMarkers([]); } catch (e) {}
    }
    setDrawStatus('Đã xóa tất cả đường vẽ & chú thích.');
    setTimeout(() => setDrawStatus(''), 3000);
  };

  const renderSubTab = () => {
    if (loadingFinancials || !financials) {
      return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in font-inter">
          <Loader2 className="w-8 h-8 text-[#00c58e] animate-spin mb-3" />
          <span className="text-text-muted text-[11px] font-bold tracking-wider uppercase">Đang đồng bộ dữ liệu tài chính thực tế...</span>
        </div>
      );
    }

    const comp = financials as CompanyFinancials;

    switch (activeTab) {
      case 'Hồ sơ':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in font-inter text-xs">
            {/* Left Card: Company Description */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
                <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-3 pb-2 border-b border-[#222b3e]">Giới Thiệu Doanh Nghiệp</h4>
                <p className="text-text-secondary leading-relaxed text-[11.5px] whitespace-pre-line">{comp.overview.description}</p>
              </div>

              <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
                <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-3 pb-2 border-b border-[#222b3e]">Ban Lãnh Đạo Chủ Chốt</h4>
                <div className="flex flex-col gap-2.5">
                  {comp.overview.management.map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#141a27] p-3 rounded-lg border border-[#232d42]/40 hover:border-[#31405b]/60 transition-colors">
                      <span className="font-bold text-white text-[11.5px]">{m.name}</span>
                      <span className="text-[10px] text-text-muted font-bold uppercase">{m.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Card: Valuation Info */}
            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg h-fit">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Chỉ Số Định Giá & Cơ Bản</h4>
              <div className="flex flex-col gap-3 font-mono text-[11px]">
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Ngành nghề</span>
                  <span className="font-bold text-white font-sans">{comp.overview.industry}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Vốn điều lệ</span>
                  <span className="font-bold text-white">{(comp.valuation.charterCapital / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ VND</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Cổ phiếu lưu hành</span>
                  <span className="font-bold text-white">{comp.valuation.outstandingShares.toLocaleString()} CP</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Vốn hóa thị trường</span>
                  <span className="font-bold text-[#00c58e]">{(comp.valuation.marketCap / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ VND</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Hệ số Beta</span>
                  <span className="font-bold text-white">{comp.valuation.beta.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">EPS cơ bản</span>
                  <span className="font-bold text-[#00c58e]">{comp.valuation.eps.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">P/E</span>
                  <span className="font-bold text-white">{comp.valuation.pe}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">P/B</span>
                  <span className="font-bold text-white">{comp.valuation.pb}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-sans font-medium">Tỷ suất cổ tức</span>
                  <span className="font-bold text-[#e040fb]">{comp.valuation.dividendYield}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Cổ đông':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            {/* Left Box: Shareholders Structure */}
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Cơ Cấu Sở Hữu</h4>
              <div className="flex flex-col gap-4">
                {comp.shareholders.structure.map((item, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between font-bold text-[10.5px]">
                      <span className="text-text-secondary flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-mono" style={{ color: item.color }}>{item.percentage.toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#141a27] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Major Shareholders List */}
            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Danh Sách Cổ Đông Lớn</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">Tên cổ đông</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Số lượng cổ phiếu</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">Tỷ lệ sở hữu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.shareholders.major.map((sh, i) => (
                      <tr key={i} className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors">
                        <td className="text-white font-sans font-bold">{sh.name}</td>
                        <td className="text-right text-text-secondary">{sh.shares.toLocaleString()} CP</td>
                        <td className="text-right font-bold text-[#00c58e] pr-2">{sh.percentage.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'Vốn và cổ tức':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            {/* Left Box: Capital History timeline */}
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Lịch Sử Tăng Vốn</h4>
              <div className="relative pl-6 border-l border-[#232d42] flex flex-col gap-6 py-2">
                {comp.capitalHistory.map((cap, i) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[30px] top-1 w-2 h-2 rounded-full bg-[#00c58e] border-4 border-[#080b11]" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-outfit font-extrabold text-white text-[12px]">{cap.year}</span>
                        <span className="text-[10px] text-text-muted font-bold">Vốn: {(cap.value / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷđ</span>
                      </div>
                      <span className="text-[10.5px] text-text-secondary">{cap.event}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Dividends Table */}
            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Lịch Sử Chi Trả Cổ Tức</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8">
                      <th className="font-bold text-[9px] uppercase pb-2">Ngày GDKHQ</th>
                      <th className="font-bold text-[9px] uppercase pb-2">Hình thức chi trả</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">Tỷ lệ chi trả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.dividends.map((div, i) => (
                      <tr key={i} className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors font-mono">
                        <td className="text-white font-sans font-bold">{div.exDate}</td>
                        <td className="text-sans">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${div.type === 'Tiền mặt' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                            {div.type}
                          </span>
                        </td>
                        <td className="text-right font-bold text-white pr-2">{div.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'Tin tức':
        return (
          <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg animate-fade-in font-inter text-xs max-w-[1000px] mx-auto">
            <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Tin Tức Doanh Nghiệp Liên Quan</h4>
            <div className="flex flex-col gap-4">
              {comp.news.map((item, i) => {
                const badgeColor = item.sentiment === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : item.sentiment === 'BEARISH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
                const badgeText = item.sentiment === 'BULLISH' ? 'Tích cực' : item.sentiment === 'BEARISH' ? 'Tiêu cực' : 'Trung lập';

                return (
                  <div key={i} className="bg-[#141a27] p-4 rounded-xl border border-[#232d42]/30 hover:border-[#31405b]/60 transition-all duration-200 flex flex-col gap-2 relative group">
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-bold text-white text-[12px] group-hover:text-[#00c58e] transition-colors leading-snug cursor-pointer">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                    <div className="flex gap-4 text-[9.5px] text-text-muted font-bold">
                      <span><Calendar size={11} className="inline mr-1 text-text-muted" /> {item.date}</span>
                      <span><Newspaper size={11} className="inline mr-1 text-text-muted" /> Nguồn: {item.source}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'Lịch sự kiện':
        return (
          <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg animate-fade-in font-inter text-xs max-w-[800px] mx-auto">
            <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-6 pb-2 border-b border-[#222b3e]">Lịch Sự Kiện Doanh Nghiệp</h4>
            <div className="relative pl-8 border-l-2 border-[#232d42] flex flex-col gap-6 py-2">
              {comp.events.map((evt, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[38px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#00c58e] border-[3px] border-[#080b11] shadow-lg flex items-center justify-center text-[7px]" />
                  <div className="bg-[#141a27] p-4 rounded-xl border border-[#232d42]/30 flex justify-between items-center gap-4 hover:border-[#31405b]/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white text-[12px]">{evt.title}</span>
                      <span className="text-[10px] text-text-muted font-bold flex items-center gap-1.5"><Calendar size={12} className="text-text-muted" /> Dự kiến diễn ra ngày: {evt.date}</span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-right shrink-0">
                      <span className="text-[8px] text-text-muted font-bold block uppercase scale-90">Còn lại</span>
                      <span className="font-outfit font-extrabold text-[#00c58e] text-sm">{evt.daysLeft} ngày</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'Thống kê':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            {/* Left Box: 52-week pricing statistics */}
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg h-fit">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Biến Động Giá 52 Tuần</h4>
              <div className="flex flex-col gap-3.5 font-mono text-[11px]">
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Thấp nhất 52 tuần</span>
                  <span className="font-bold text-down">{comp.stats.yearlyRange.low.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">Cao nhất 52 tuần</span>
                  <span className="font-bold text-up">{comp.stats.yearlyRange.high.toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-sans font-medium">KL Khớp TB/Phiên</span>
                  <span className="font-bold text-white">{comp.stats.yearlyRange.avgVolume.toLocaleString()} CP</span>
                </div>
              </div>
            </div>

            {/* Right Box: Foreign Trading Net History */}
            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Giao Dịch Khối Ngoại (10 Phiên Gần Nhất)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">Phiên GD</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">KL Mua</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">KL Bán</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">Giá trị ròng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.stats.foreignTrading.map((trade, i) => {
                      const valueColor = trade.netValue >= 0 ? 'text-up' : 'text-down';
                      const absValueTỷ = Math.abs(trade.netValue) / 1000000000;

                      return (
                        <tr key={i} className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors">
                          <td className="text-white font-sans font-bold">{trade.date}</td>
                          <td className="text-right text-text-secondary">{trade.buyVol.toLocaleString()}</td>
                          <td className="text-right text-text-secondary">{trade.sellVol.toLocaleString()}</td>
                          <td className={`text-right font-bold pr-2 ${valueColor}`}>
                            {trade.netValue >= 0 ? '+' : '-'}{absValueTỷ.toFixed(2)} Tỷđ
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'Tài chính':
        return (
          <div className="grid grid-cols-1 gap-6 animate-fade-in font-inter text-xs max-w-[1200px] mx-auto">
            {/* Box 1: Income Statement summary quarterly */}
            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Kết Quả Kinh Doanh Theo Quý (VND)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">Kỳ Báo Cáo</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Doanh Thu Thuần</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Lợi Nhuận Gộp</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">Lợi Nhuận Sau Thuế</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.financials.quarters.map((q, i) => (
                      <tr key={i} className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors">
                        <td className="text-white font-sans font-bold">{q.quarter}</td>
                        <td className="text-right text-text-secondary">{(q.revenue / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ</td>
                        <td className="text-right text-text-secondary">{(q.grossProfit / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ</td>
                        <td className="text-right font-bold text-[#00c58e] pr-2">{(q.netProfit / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Box 2: Financial statement yearly with efficiency ratios */}
            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">Hiệu Quả Vận Hành & Tài Chính Theo Năm (VND)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">Năm Tài Chính</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Tổng Doanh Thu</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Lợi Nhuận Ròng</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">Hệ Số ROE (%)</th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">Hệ Số ROA (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.financials.years.map((y, i) => (
                      <tr key={i} className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors">
                        <td className="text-white font-sans font-bold">{y.year}</td>
                        <td className="text-right text-text-secondary">{(y.revenue / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ</td>
                        <td className="text-right text-[#00c58e] font-bold">{(y.netProfit / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Tỷ</td>
                        <td className="text-right text-white font-bold">{y.roe.toFixed(2)}%</td>
                        <td className="text-right text-[#00cfff] font-bold pr-2">{y.roa.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="text-center py-8 text-text-muted italic">Không tìm thấy thông tin phù hợp.</div>;
    }
  };

  if (!isOpen) return null;

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  const totalVolume = buyVolumeTotal + sellVolumeTotal;
  const buyPercent = totalVolume > 0 ? (buyVolumeTotal / totalVolume) * 100 : 50;

  return (
    <div className="fixed inset-0  backdrop-blur-sm flex items-center justify-center z-[1000] p-4 select-none animate-fade-in font-inter">
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

        {/* ─── 3. MAIN WORKSPACE ─── */}
        <div className="flex-grow flex w-full overflow-hidden">
          {activeTab === 'Giao dịch' ? (
            <>
              {/* COLUMN 1: CHART & TOOLS (58% width) */}
              <section className="w-[58%] h-full flex border-r border-[#151a24] bg-[#06070a] overflow-hidden">

                {/* Interactive Drawing tools bar (Fully functional TradingView style!) */}
                <div className="w-[45px] shrink-0 h-full border-r border-[#151a24] bg-[#090b11] flex flex-col items-center py-4 gap-3.5 text-text-muted select-none">
                  <button
                    onClick={() => {
                      setActiveTool('');
                      setDrawStatus('');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${!activeTool ? 'text-white bg-white/10' : 'text-text-muted hover:text-white'}`}
                    title="Con trỏ chuột (Cursor select)"
                  >
                    <MousePointer size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('trendline');
                      setDrawingStep(0);
                      setDrawingPoint1(null);
                      setDrawStatus('Click điểm bắt đầu trên đồ thị để chọn điểm 1');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'trendline' ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-text-muted hover:text-white'}`}
                    title="Vẽ đường xu hướng (Trendline)"
                  >
                    <LineChart size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('fibonacci');
                      setDrawStatus('Chỉ báo Fibonacci Retracement: Click điểm Swing High/Low để vẽ tỷ lệ');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'fibonacci' ? 'text-[#00cfff] bg-[#00cfff]/10' : 'text-text-muted hover:text-white'}`}
                    title="Thoái lui Fibonacci (Fibonacci Retracement)"
                  >
                    <Hash size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('shapes');
                      setDrawStatus('Vẽ hình học: Rê chuột và vẽ hình chữ nhật để đánh dấu vùng giá');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'shapes' ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-text-muted hover:text-white'}`}
                    title="Vẽ hình khối hình học (Geometric Shapes)"
                  >
                    <Square size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('text');
                      setDrawStatus('Thêm chú thích văn bản: Click điểm trên biểu đồ để viết ghi chú');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'text' ? 'text-purple-400 bg-purple-400/10' : 'text-text-muted hover:text-white'}`}
                    title="Chú thích văn bản (Text annotations)"
                  >
                    <MessageSquare size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('ruler');
                      setDrawStatus('Thước đo tỷ lệ phần trăm khoảng giá & thời gian');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'ruler' ? 'text-teal-400 bg-teal-400/10' : 'text-text-muted hover:text-white'}`}
                    title="Thước đo khoảng giá (Price & Time Ruler)"
                  >
                    <Ruler size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setActiveTool('zoom');
                      setDrawStatus('Thu phóng chi tiết khung nến');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'zoom' ? 'text-indigo-400 bg-indigo-400/10' : 'text-text-muted hover:text-white'}`}
                    title="Thu phóng vùng biểu đồ (Zoom Tool)"
                  >
                    <Search size={15} />
                  </button>

                  {/* Magnet snap toggle */}
                  <button
                    onClick={() => {
                      setIsMagnet(!isMagnet);
                      setDrawStatus(!isMagnet ? 'Đã bật chế độ tự động hút nam châm vào râu nến' : 'Đã tắt chế độ hút nam châm');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isMagnet ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-text-muted hover:text-white'}`}
                    title="Chế độ hút nam châm (Magnet snap mode)"
                  >
                    <Magnet size={15} />
                  </button>

                  {/* Lock snap toggle */}
                  <button
                    onClick={() => {
                      setIsLocked(!isLocked);
                      setDrawStatus(!isLocked ? 'Đã khóa tất cả nét vẽ trên biểu đồ' : 'Đã mở khóa các nét vẽ');
                    }}
                    className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isLocked ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                    title="Khóa tất cả hình vẽ (Lock drawings)"
                  >
                    {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                  </button>

                  <button
                    onClick={() => {
                      clearDrawings();
                      setDrawStatus('Đã xóa tất cả nét vẽ');
                    }}
                    className="bg-transparent border-0 cursor-pointer p-1.5 rounded text-rose-500 hover:text-rose-400 transition-colors mt-auto flex items-center justify-center"
                    title="Xóa tất cả đường vẽ (Clear all drawings)"
                  >
                    <Trash2 size={15} />
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
                          <Sparkles size={11} className="text-purple-400 inline mr-1 animate-pulse" /> {drawStatus}
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
                        <AlertTriangle size={13} className="text-bearish inline mr-1" /> {aiMessage}
                      </div>
                    )}

                    {/* AI Summary report overlay card */}
                    {aiSummary && (
                      <div className="absolute top-4 left-4 right-4 bg-[#0d1017]/95 border border-warning/30 rounded-xl p-4 z-25 max-h-[90%] overflow-y-auto shadow-2xl animate-scale-up font-inter">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-warning font-bold text-xs uppercase tracking-wide flex items-center gap-1">
                            <Sparkles size={13} className="text-warning inline mr-1" /> Luận Điểm Đầu Tư AI - {symbol.toUpperCase()}
                          </span>
                          <button
                            onClick={() => setAiSummary(null)}
                            className="bg-transparent border-0 text-text-muted hover:text-white cursor-pointer p-0.5"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {renderParsedSummary(aiSummary.summary)}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg text-[10.5px]">
                            <span className="text-emerald-400 font-bold block mb-1"><TrendingUp size={13} className="text-emerald-400 inline mr-1" /> Động lực tăng trưởng:</span>
                            <ul className="pl-3 list-disc text-text-muted flex flex-col gap-0.5">
                              {aiSummary.drivers.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                          <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg text-[10.5px]">
                            <span className="text-rose-400 font-bold block mb-1"><TrendingDown size={13} className="text-rose-400 inline mr-1" /> Rủi ro catalysts:</span>
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
            </>
          ) : (
            <div className="w-full h-full overflow-y-auto bg-[#06080d] p-6 text-text-primary scrollbar-thin">
              {renderSubTab()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
