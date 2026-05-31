import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ISeriesApi } from 'lightweight-charts';
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
    const actionStart = ['🎯 **CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT:**', '🎯 **CHIẾN LƯỢC HÀNH ĐỘNG:**', 'CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT', 'CHIẾN LƯỢC HÀ HÀNH ĐỘNG'];
    const priceStart = ['💸 **VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG:**', '💸 **VÙNG GIÁ THAM KHẢO:**', 'VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG', 'VÙNG GIÁ THAM KHẢO'];

    const positionText = extractPart(summaryText, positionStart, actionStart);
    const actionText = extractPart(summaryText, actionStart, priceStart);
    const priceText = extractPart(summaryText, priceStart);

    return (
      <div className="flex flex-col gap-2.5 mb-1">
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
    <div className="whitespace-pre-wrap text-[11.5px] text-text-secondary leading-relaxed mb-1">
      {summaryText}
    </div>
  );
};
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
      const volume = chunk.reduce((acc, x) => acc + (x.volume || 0), 0);
      weekly.push({ time: chunk[0].time, open, high, low, close, volume });
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
    const vol = Math.floor(1000 + Math.random() * 50000);
    intraday.push({
      time: baseTime + i * spacing,
      open: Number(o.toFixed(2)),
      high: Number(h.toFixed(2)),
      low: Number(l.toFixed(2)),
      close: Number(c.toFixed(2)),
      volume: vol
    });
    lastVal = c;
  }
  return intraday;
};

export function TickerDetailPanel({ symbol, isOpen, onClose }: TickerDetailPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'>>(null);
  const volumeSeriesRef = useRef<any>(null);
  const latestBarRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // States
  const [hoverBar, setHoverBar] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1D' | '1W'>('1D');
  const [range, setRange] = useState<'1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'All'>('All');
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);

  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const rawCandlesRef = useRef<any[]>([]);
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
            generateMockTradesHistory(Number(quote.price) || basePrice, basePrice);
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
          if (latestBarRef.current.volume !== undefined) {
            latestBarRef.current.volume += tradeVol;
          }
        } else {
          latestBarRef.current = {
            time: timeSec,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: tradeVol,
          };
        }
        candlestickSeriesRef.current.update(latestBarRef.current);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: latestBarRef.current.time,
            value: latestBarRef.current.volume || tradeVol,
            color: latestBarRef.current.close >= latestBarRef.current.open ? '#26a69a' : '#ef5350',
          });
        }
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

        // Split vertical space for Candlestick and Volume
        candlestickSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.1,
            bottom: 0.28,
          },
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '', // Overlay
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.78,
            bottom: 0,
          },
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;

        // Hook crosshairMove listener to update OHLCV legend dynamically on hover
        chart.subscribeCrosshairMove((param: any) => {
          if (!param.time || param.point === undefined) {
            setHoverBar(null);
            return;
          }
          const priceData = param.seriesData.get ? param.seriesData.get(candlestickSeries) : param.seriesData[candlestickSeries];
          const volumeData = param.seriesData.get ? param.seriesData.get(volumeSeries) : param.seriesData[volumeSeries];
          
          if (priceData) {
            setHoverBar({
              time: param.time,
              open: priceData.open,
              high: priceData.high,
              low: priceData.low,
              close: priceData.close,
              volume: volumeData ? (volumeData.value !== undefined ? volumeData.value : volumeData.close) : null,
            });
          } else {
            setHoverBar(null);
          }
        });

        async function loadCandles() {
          try {
            const res = await marketApi.getCandles(symbol);
            if (res.success && res.data && res.data.length > 0) {
              rawCandlesRef.current = res.data;
              renderIntervalChart(timeframe);
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
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      latestBarRef.current = null;
    };
  }, [isOpen, symbol, activeSubTab]);

  // Recalculates and renders candlestick data when timeframe or indicators change
  const renderIntervalChart = (newInterval: '1m' | '5m' | '15m' | '1D' | '1W') => {
    if (!candlestickSeriesRef.current || !chartRef.current) return;

    const formatted = getIntervalCandles(rawCandlesRef.current, newInterval);
    candlestickSeriesRef.current.setData(formatted);

    if (volumeSeriesRef.current) {
      const volumeFormatted = formatted.map((c: any) => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? '#26a69a' : '#ef5350',
      }));
      volumeSeriesRef.current.setData(volumeFormatted);
    }

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

  // Range zoom handler
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

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  
  const totalVolume = buyVolumeTotal + sellVolumeTotal;
  const buyPercent = totalVolume > 0 ? (buyVolumeTotal / totalVolume) * 100 : 50;

  return (
    <div className={`right-slide-panel flex flex-col ${isOpen ? 'panel-open' : 'panel-closed'} font-inter`}>
      {/* PANEL HEADER */}
      <div className="flex justify-between items-center p-3 border-b border-border-board bg-board-header">
        <div className="flex items-center gap-2">
          {/* Search box styling Ticker info */}
          <div className="flex items-center gap-1.5 bg-[#090b11] p-1 px-2.5 rounded border border-[#1b2233] text-[11px]">
            <span className="text-text-muted">🔍</span>
            <span className="font-extrabold text-[#00c58e] tracking-tight">{symbol.toUpperCase()}</span>
            <span className="text-[9px] text-text-muted font-bold bg-white/5 px-0.5 rounded uppercase">HOSE</span>
          </div>
          <span className="text-[10px] text-text-secondary font-bold truncate max-w-[120px]">{getCompanyName(symbol)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Green Place Order button */}
          <button
            onClick={() => alert(`Đặt lệnh nhanh mã ${symbol.toUpperCase()} trên Sidebar.`)}
            className="bg-[#00c58e] hover:bg-[#00e69c] text-black text-[10px] px-2.5 py-1 rounded font-extrabold cursor-pointer transition-all shrink-0"
          >
            Đặt lệnh
          </button>
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer p-1 transition-colors flex items-center"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* QUICK REAL-TIME QUOTE PANEL */}
      <div className="p-3 bg-[#080b11] border-b border-border-board text-xs select-none">
        <div className="flex justify-between items-center">
          <div className="flex items-baseline gap-1.5">
            <span className={`${priceColor} font-outfit text-xl font-extrabold tracking-tight`}>
              {currentPrice.toLocaleString()}
            </span>
            <span className={`text-[9.5px] font-bold ${priceColor}`}>
              {currentChange >= 0 ? '+' : ''}{currentChange.toLocaleString()} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(1)}%)
            </span>
          </div>

          {/* Trần, Sàn, TC list */}
          <div className="flex gap-1.5 text-[9px] font-bold">
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
              <span className="text-ceil">{tran.toLocaleString()}</span>
            </div>
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
              <span className="text-floor">{san.toLocaleString()}</span>
            </div>
            <div className="bg-[#171c26]/60 border border-[#2a303d] p-0.5 px-1.5 rounded">
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
          <div className="flex flex-col gap-3 flex-1">
            {/* Chart controls and intervals */}
            <div className="flex justify-between items-center bg-[#080b11] p-1 px-2 rounded-lg border border-white/5 text-[10px] font-bold text-text-secondary">
              {/* Indicators toggle bar */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSMA}
                    onChange={(e) => setShowSMA(e.target.checked)}
                    className="rounded border-[#2d3748] accent-[#ffb300]"
                  />
                  <span className="text-[#ffb300] text-[9px]">SMA</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEMA}
                    onChange={(e) => setShowEMA(e.target.checked)}
                    className="rounded border-[#2d3748] accent-[#00cfff]"
                  />
                  <span className="text-[#00cfff] text-[9px]">EMA</span>
                </label>
              </div>

              {/* Intervals */}
              <div className="flex gap-1 bg-white/2 p-0.5 rounded border border-white/5">
                {(['1m', '5m', '15m', '1D', '1W'] as const).map(tf => (
                  <span
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer font-extrabold transition-colors ${timeframe === tf ? 'bg-[#00c58e]/20 text-[#00c58e]' : 'text-text-muted hover:text-white'}`}
                  >
                    {tf}
                  </span>
                ))}
              </div>
            </div>

            {/* Price Candlestick Viewport Container */}
            <div className="relative w-full bg-[#06070a] rounded-xl border border-border-board overflow-hidden min-h-[290px] h-[290px]">
              {/* Floating OHLCV Stats Legend */}
              <div className="absolute top-2 left-2 z-10 bg-slate-950/80 border border-white/5 backdrop-blur-sm p-1.5 px-2.5 rounded text-[8.5px] font-mono flex flex-wrap gap-2 text-[#7b8a9b] pointer-events-none select-none">
                {hoverBar || latestBarRef.current ? (
                  <>
                    <span>O: <span className={(hoverBar || latestBarRef.current).close >= (hoverBar || latestBarRef.current).open ? 'text-up' : 'text-down'}>{(hoverBar || latestBarRef.current).open?.toLocaleString()}</span></span>
                    <span>H: <span className="text-up">{(hoverBar || latestBarRef.current).high?.toLocaleString()}</span></span>
                    <span>L: <span className="text-down">{(hoverBar || latestBarRef.current).low?.toLocaleString()}</span></span>
                    <span>C: <span className={(hoverBar || latestBarRef.current).close >= (hoverBar || latestBarRef.current).open ? 'text-up' : 'text-down'}>{(hoverBar || latestBarRef.current).close?.toLocaleString()}</span></span>
                  </>
                ) : (
                  <span>Di chuyển chuột trên đồ thị</span>
                )}
              </div>

              {loadingChart && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#06070a]/90 z-20">
                  <Loader2 size={24} className="pulse text-[#00c58e] animate-spin" />
                </div>
              )}
              <div ref={chartContainerRef} className="w-full h-full" />
            </div>

            {/* Timeframe controls bar & ranges (Functional zooming!) */}
            <div className="flex justify-between items-center py-1.5 px-3 rounded-lg border border-white/5 bg-[#080b11] text-[9px] text-text-muted font-bold">
              <div className="flex gap-2">
                {(['1d', '5d', '1m', '3m', '6m', '1y', '5y', 'All'] as const).map(rangeType => (
                  <span
                    key={rangeType}
                    onClick={() => handleRangeChange(rangeType)}
                    className={`px-1 rounded cursor-pointer transition-colors ${range === rangeType ? 'bg-white/10 text-white font-extrabold' : 'hover:text-white'}`}
                  >
                    {rangeType.toUpperCase()}
                  </span>
                ))}
              </div>
              <span className="text-[#00c58e] cursor-pointer" title="Auto fit scaling" onClick={() => handleRangeChange('All')}>tự động</span>
            </div>
            
            {/* Legend guide */}
            <p className="text-[10px] text-text-muted bg-white/2 p-2 px-3 border border-white/5 rounded-lg leading-relaxed">
              💡 <strong>Đồ thị nến Nhật & Cột Volume:</strong> Hỗ trợ phân tích kỹ thuật đa khung thời gian kết hợp biểu đồ khối lượng chuyên nghiệp.
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
                  className="bg-[#00c58e] text-black font-extrabold transition-[width] duration-300 leading-3.5 pl-2 text-left"
                  style={{ width: `${buyPercent}%` }}
                >
                  {buyPercent.toFixed(0)}% Mua
                </div>
                <div 
                  className="bg-[#ff3b30] text-white font-extrabold transition-[width] duration-300 leading-3.5 pr-2 text-right"
                  style={{ width: `${100 - buyPercent}%` }}
                >
                  {(100 - buyPercent).toFixed(0)}% Bán
                </div>
              </div>

              {/* Depth Bid Ask grid */}
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-text-muted border-b border-border-board h-6">
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
                            className="absolute right-0 top-0.5 bottom-0.5 bg-[#00c58e]/10 rounded transition-[width] duration-300"
                            style={{ width: `${bid.percentage}%` }}
                          />
                          <span className="relative z-10">{bid.volume.toLocaleString()}</span>
                        </td>
                        <td className={`${askPriceColor} font-bold text-right pl-1.5`}>{ask.price.toLocaleString()}</td>
                        <td className="relative text-right text-white font-medium">
                          <div 
                            className="absolute right-0 top-0.5 bottom-0.5 bg-[#ff3b30]/10 rounded transition-[width] duration-300"
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
            <div className="flex-grow flex flex-col bg-[#0c0f16]/30 border border-border-board/80 p-3 rounded-xl max-h-[260px]">
              <span className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">Khớp Lệnh Liên Tục</span>
              <div className="flex-grow overflow-y-auto rounded-lg">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="sticky top-0 bg-[#0d1017] text-text-muted border-b border-[#151a24] h-6 z-10">
                      <th className="text-left pl-2 font-bold text-[8.5px] uppercase">Giờ</th>
                      <th className="text-right font-bold text-[8.5px] uppercase">KL</th>
                      <th className="text-right font-bold text-[8.5px] uppercase">Giá</th>
                      <th className="text-right font-bold text-[8.5px] uppercase">+/-</th>
                      <th className="text-center pr-2 font-bold text-[8.5px] uppercase">M/B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-6 text-text-muted text-[10px] italic">
                          Chờ các lệnh khớp real-time...
                        </td>
                      </tr>
                    ) : (
                      trades.map((t, idx) => {
                        const diff = Number(t.price) - tc;
                        return (
                          <tr key={idx} className="h-5.5 border-b border-border-board/20 hover:bg-white/2 transition-colors">
                            <td className="pl-2 text-text-muted font-mono text-[9px]">{t.time}</td>
                            <td className="text-right text-white font-medium font-mono text-[9px]">{t.volume.toLocaleString()}</td>
                            <td className={`${t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref'} font-bold text-right font-mono text-[9px]`}>
                              {t.price.toLocaleString()}
                            </td>
                            <td className={`${diff >= 0 ? 'text-up' : 'text-down'} text-right font-semibold font-mono text-[9px]`}>
                              {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                            </td>
                            <td className="text-center pr-2">
                              <span className={`inline-block text-[8px] font-extrabold px-1 rounded ${t.type === 'BUY' ? 'bg-[#00c58e]/20 text-[#00c58e]' : 'bg-[#ff3b30]/20 text-[#ff3b30]'}`}>
                                {t.type === 'BUY' ? 'M' : 'B'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
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

                {renderParsedSummary(aiSummary.summary)}

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
