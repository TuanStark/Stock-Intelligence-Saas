'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
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
  RefreshCw,
  MousePointer,
  LineChart as LucideLineChart,
  Hash,
  Square,
  MessageSquare,
  Ruler,
  Search,
  Magnet,
  Lock,
  Unlock,
  Trash2,
  ChevronRight,
  Newspaper,
  BookOpen
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

  // Technical Indicators
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);

  // Drawing Tools States
  const [activeTool, setActiveToolState] = useState('');
  const [drawStatus, setDrawStatus] = useState('');
  const [drawingPoint1, setDrawingPoint1] = useState<any>(null);
  const [drawingStep, setDrawingStepState] = useState(0);
  const [isMagnet, setIsMagnet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const activeToolRef = useRef('');
  const drawingStepRef = useRef(0);
  const drawingPoint1Ref = useRef<any>(null);
  const trendlineSeriesArrayRef = useRef<any[]>([]);
  const isMagnetRef = useRef(false);
  const isLockedRef = useRef(false);
  const markersRef = useRef<any[]>([]);

  const setActiveTool = (t: string) => {
    activeToolRef.current = t;
    setActiveToolState(t);
  };
  const setDrawingStep = (s: number) => {
    drawingStepRef.current = s;
    setDrawingStepState(s);
  };

  useEffect(() => {
    isMagnetRef.current = isMagnet;
  }, [isMagnet]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  // AI manual trigger states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Live order book & matching trades
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [trades, setTrades] = useState<TradeLog[]>([]);

  // Base Reference Prices
  const [tc, setTc] = useState(22850);
  const [tran, setTran] = useState(24440);
  const [san, setSan] = useState(21260);

  // TradingView Chart State
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);

  // Real-time chart bar tracking
  const latestBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const rawCandlesRef = useRef<any[]>([]);

  const getCompanyName = (sym: string): string => {
    const dictionary: Record<string, string> = {
      'FPT': 'Công ty Cổ phần FPT',
      'VNM': 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)',
      'VIC': 'Tập đoàn Vingroup - Công ty Cổ phần',
      'HPG': 'Công ty Cổ phần Tập đoàn Hòa Phát',
      'TCB': 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)',
      'VCB': 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
      'SSI': 'Công ty Cổ phần Chứng khoán SSI',
      'MWG': 'Công ty Cổ phần Đầu tư Thế giới Di động',
      'VRE': 'Công ty Cổ phần Vincom Retail',
      'GAS': 'Tổng Công ty Khí Việt Nam - Công ty Cổ phần',
      'MSN': 'Tập đoàn Masan',
      'VJC': 'Công ty Cổ phần Hàng không VietJet',
      'PLX': 'Tập đoàn Xăng dầu Việt Nam',
      'HDB': 'Ngân hàng TMCP Phát triển TP. HCM (HDBank)',
      'STB': 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)',
      'MBB': 'Ngân hàng TMCP Quân đội (MBBank)',
      'ACB': 'Ngân hàng TMCP Á Châu',
      'VPB': 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
      'TPB': 'Ngân hàng TMCP Tiên Phong (TPBank)',
      'LPB': 'Ngân hàng TMCP Lộc Phát Việt Nam'
    };
    return dictionary[sym.toUpperCase()] || 'Tổng Công ty Cổ phần Đầu tư & Phát triển';
  };

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
          const quote = resData.data.latestQuote;
          setLatestQuote(quote);
          setSignals(resData.data.signals || []);
          setAiSummary(resData.data.aiSummary);

          if (quote) {
            const basePrice = Number(quote.previousClose) || Number(quote.price) || 22850;
            setTc(basePrice);
            setTran(Math.round(basePrice * 1.07));
            setSan(Math.round(basePrice * 0.93));
            generateMockDepth(Number(quote.price) || basePrice);
            generateMockTradesHistory(Number(quote.price) || basePrice, basePrice);
          }

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

      const maxVol = Math.max(...[...mockBids, ...mockAsks].map(x => x.volume), 1);
      mockBids.forEach(x => x.percentage = (x.volume / maxVol) * 100);
      mockAsks.forEach(x => x.percentage = (x.volume / maxVol) * 100);

      setBids(mockBids);
      setAsks(mockAsks);
    }

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
  }, [symbol, t]);

  // 2. Fetch candle data and render Lightweight Charts + Subscribe WebSockets
  useEffect(() => {
    if (loading || errorMsg || !chartContainerRef.current || !symbol) return;

    // A. Create Candlestick Chart
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
      width: chartContainerRef.current.clientWidth,
      height: 480,
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

          // Save the latest REST candle in the ref for live updates
          const lastCandle = resData.data[resData.data.length - 1];
          latestBarRef.current = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          };

          // Redraw indicator lines
          recalculateIndicators();
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

      // 2. Continuous Matching trade logs
      const timeStr = new Date(tick.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const tradeType: 'BUY' | 'SELL' = Math.random() > 0.45 ? 'BUY' : 'SELL';
      const tradeVol = Math.floor(100 + Math.random() * 8000);

      setTrades(prev => [
        { time: timeStr, price: tick.price, volume: tradeVol, type: tradeType, change: tick.change },
        ...prev.slice(0, 18)
      ]);

      // 3. Feed standard daily candlestick updates
      const date = new Date(tick.timestamp);
      date.setUTCHours(0, 0, 0, 0);
      const time = Math.floor(date.getTime() / 1000);

      if (latestBarRef.current) {
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
    });

    // C. Subscribe to clicks inside the chart to draw interactive trendlines & professional tools!
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

          const price1 = Number(p1.price || 0);
          const price2 = Number(p2.price || 0);
          const diff = price2 - price1;
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 1.0];
          const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff'];

          const connectLine = chart.addSeries(LineSeries, {
            color: '#7b8a9b',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            title: 'Fib Connect'
          });
          connectLine.setData([
            { time: p1.time, value: price1 },
            { time: p2.time, value: price2 }
          ]);
          trendlineSeriesArrayRef.current.push(connectLine);

          fibLevels.forEach((level, idx) => {
            const levelPrice = price1 + diff * level;
            const levelSeries = chart.addSeries(LineSeries, {
              color: colors[idx],
              lineWidth: 1,
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

          const price1 = Number(p1.price || 0);
          const price2 = Number(p2.price || 0);
          const topPrice = Math.max(price1, price2);
          const bottomPrice = Math.min(price1, price2);
          const zoneColor = '#00c58e';

          const topLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, title: 'Zone Top' });
          topLine.setData([{ time: p1.time, value: topPrice }, { time: p2.time, value: topPrice }]);
          trendlineSeriesArrayRef.current.push(topLine);

          const bottomLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, title: 'Zone Bottom' });
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
      // 📏 Tool 5: Ruler
      else if (currentTool === 'ruler') {
        if (drawingStepRef.current === 0) {
          setDrawingPoint1({ time: param.time, price: activePrice });
          drawingPoint1Ref.current = { time: param.time, price: activePrice };
          setDrawingStep(1);
          setDrawStatus('Click điểm thứ hai để tính toán chênh lệch đo lường');
        } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
          const p1 = drawingPoint1Ref.current;
          const p2 = { time: param.time, price: activePrice };

          const price1 = Number(p1.price || 0);
          const price2 = Number(p2.price || 0);
          const priceDiff = price2 - price1;
          const priceDiffPct = (priceDiff / price1) * 100;

          let barsCount = 1;
          if (rawCandlesRef.current.length > 0) {
            const idx1 = rawCandlesRef.current.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p1.time));
            const idx2 = rawCandlesRef.current.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p2.time));
            if (idx1 !== -1 && idx2 !== -1) {
              barsCount = Math.abs(idx2 - idx1) + 1;
            }
          }

          const rulerLine = chart.addSeries(LineSeries, {
            color: '#00cfff',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            title: 'Ruler Measurement'
          });
          rulerLine.setData([
            { time: p1.time, value: price1 },
            { time: p2.time, value: price2 }
          ]);
          trendlineSeriesArrayRef.current.push(rulerLine);

          alert(`📏 ĐO LƯỜNG PHÂN TÍCH KHOẢNG GIÁ & THỜI GIAN:\n\n` +
                `- Điểm bắt đầu: ${price1.toLocaleString()}đ\n` +
                `- Điểm kết thúc: ${price2.toLocaleString()}đ\n` +
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

    // Handle resizing
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 480
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log(`🔌 Unsubscribing and disconnecting WebSockets for symbol: ${symbol}`);
      socket.emit('unsubscribe_instrument', { symbol });
      socket.disconnect();
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      candlestickSeriesRef.current = null;
      trendlineSeriesArrayRef.current = [];
    };
  }, [loading, errorMsg, symbol, t]);

  // Recalculates indicators
  const recalculateIndicators = () => {
    const chart = chartRef.current;
    const candles = rawCandlesRef.current;
    if (!chart || candles.length === 0) return;

    // SMA Indicator
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

    // EMA Indicator
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

  const clearDrawings = () => {
    const chart = chartRef.current;
    if (!chart) return;
    trendlineSeriesArrayRef.current.forEach(series => {
      try { chart.removeSeries(series); } catch (e) { }
    });
    trendlineSeriesArrayRef.current = [];
    markersRef.current = [];
    if (candlestickSeriesRef.current) {
      try { (candlestickSeriesRef.current as any).setMarkers([]); } catch (e) {}
    }
    setDrawStatus('Đã xóa tất cả nét vẽ & chú thích.');
    setTimeout(() => setDrawStatus(''), 3000);
  };

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
  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
  const totalVolume = trades.reduce((acc, t) => acc + t.volume, 0) || 45300;
  const buyPercent = 55; // Baseline split

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
          <div className="glass-panel p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1017]">
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
                  {currentPrice.toLocaleString()}
                </span>
                <span className={`text-xs font-bold ${priceColor}`}>
                  {currentChange >= 0 ? '+' : ''}{currentChange.toLocaleString()} ({currentChange >= 0 ? '+' : ''}{(currentPct * 100).toFixed(2)}%)
                </span>
              </div>

              <div className="flex gap-4 text-[10px] text-text-muted font-bold bg-white/2 p-2 px-3 rounded-lg border border-white/5">
                <div className="flex flex-col">
                  <span>Trần</span>
                  <span className="text-ceil">{tran.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span>Sàn</span>
                  <span className="text-floor">{san.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span>TC</span>
                  <span className="text-ref">{tc.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* B. TECHNICAL CANDLESTICK CHART */}
          <div className="glass-panel p-0 bg-[#06070a] overflow-hidden flex border border-[#1b2233] rounded-xl relative flex-col">
            
            {/* Chart Toolbar & Timeframes top header bar */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-[#131822] bg-[#080b11] text-[10px] font-bold text-text-secondary shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[#00c58e]">{instrument.symbol.toUpperCase()}</span>
                <span className="text-white bg-white/10 px-1 rounded">1D</span>
                <span>HOSE</span>

                {/* Indicators checkboxes */}
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
                    <Sparkles size={11} className="text-purple-400 inline mr-1" /> {drawStatus}
                  </span>
                )}
              </div>

              <span className="text-[9px] text-[#7b8a9b] font-extrabold tracking-wide">PHÂN TÍCH KỸ THUẬT CHUYÊN NGHIỆP</span>
            </div>

            {/* Main chart wrapper with Drawing Toolbar */}
            <div className="w-full flex-grow flex overflow-hidden min-h-[480px]">
              
              {/* Sidebar Toolbar drawings */}
              <div className="w-[45px] shrink-0 border-r border-[#151a24] bg-[#090b11] flex flex-col items-center py-4 gap-3.5 text-[#7b8a9b] select-none">
                <button
                  onClick={() => {
                    setActiveTool('');
                    setDrawStatus('');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${!activeTool ? 'text-white bg-white/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Con trỏ chuột"
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
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'trendline' ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Đường xu hướng (Trendline)"
                >
                  <LucideLineChart size={15} />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('fibonacci');
                    setDrawStatus('Chỉ báo Fibonacci Retracement: Click điểm Swing High/Low để vẽ tỷ lệ');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'fibonacci' ? 'text-[#00cfff] bg-[#00cfff]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Thoái lui Fibonacci"
                >
                  <Hash size={15} />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('shapes');
                    setDrawStatus('Vẽ hình chữ nhật: Click điểm chéo thứ hai để đánh dấu vùng giá');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'shapes' ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Hộp vùng giá (Rectangle Price Zone)"
                >
                  <Square size={15} />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('text');
                    setDrawStatus('Thêm chú thích văn bản: Click điểm trên biểu đồ để viết ghi chú');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'text' ? 'text-purple-400 bg-purple-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Ghi chú chú thích (Annotations)"
                >
                  <MessageSquare size={15} />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('ruler');
                    setDrawStatus('Thước đo tỷ lệ phần trăm khoảng giá & thời gian');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'ruler' ? 'text-teal-400 bg-teal-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Thước đo khoảng giá"
                >
                  <Ruler size={15} />
                </button>
                <button
                  onClick={() => {
                    setActiveTool('zoom');
                    setDrawStatus('Thu phóng chi tiết khung nến');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'zoom' ? 'text-indigo-400 bg-indigo-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Thu phóng vùng biểu đồ"
                >
                  <Search size={15} />
                </button>

                <button
                  onClick={() => {
                    setIsMagnet(!isMagnet);
                    setDrawStatus(!isMagnet ? 'Đã bật chế độ tự động hút nam châm vào râu nến' : 'Đã tắt chế độ hút nam châm');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isMagnet ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Hút nam châm (Magnet Mode)"
                >
                  <Magnet size={15} />
                </button>
                <button
                  onClick={() => {
                    setIsLocked(!isLocked);
                    setDrawStatus(!isLocked ? 'Đã khóa tất cả nét vẽ trên biểu đồ' : 'Đã mở khóa các nét vẽ');
                  }}
                  className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isLocked ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-[#7b8a9b] hover:text-white'}`}
                  title="Khóa hình vẽ"
                >
                  {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>

                <button
                  onClick={() => {
                    clearDrawings();
                    setDrawStatus('Đã xóa tất cả nét vẽ');
                  }}
                  className="bg-transparent border-0 cursor-pointer p-1.5 rounded text-rose-500 hover:text-rose-400 transition-colors mt-auto flex items-center justify-center"
                  title="Xóa tất cả nét vẽ"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Chart container */}
              <div ref={chartContainerRef} className="flex-grow w-full relative bg-[#06070a]" style={{ minHeight: '480px' }} />
            </div>
          </div>

          {/* C. BOTTOM STATS GRID: FINANCIAL STATISTICS & LIVE TRANSACTION MATCHING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* C1. Financial stats list */}
            {latestQuote && (
              <div className="glass-panel p-5 bg-[#0d1017]">
                <h3 className="font-outfit text-sm font-bold flex items-center gap-2 border-b border-[#1b2233] pb-3 mb-4 text-[#00c58e] uppercase tracking-wider">
                  <DollarSign size={16} />
                  Thống kê tài chính & Biên độ giao dịch
                </h3>
                <div className="flex flex-col gap-3 font-mono text-xs md:text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-muted">Giá Mở Cửa</span>
                    <span className="font-semibold text-white">{Number(latestQuote.open).toLocaleString()} VND</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-muted">Giá Cao Nhất</span>
                    <span className="font-semibold text-up">{Number(latestQuote.high).toLocaleString()} VND</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-muted">Giá Thấp Nhất</span>
                    <span className="font-semibold text-down">{Number(latestQuote.low).toLocaleString()} VND</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-muted">Giá Đóng Cửa Trước</span>
                    <span className="font-semibold text-ref">{Number(latestQuote.previousClose).toLocaleString()} VND</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-muted">Tổng Khối Lượng</span>
                    <span className="font-semibold text-white">{Number(latestQuote.volume).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-text-muted">Giá trị giao dịch</span>
                    <span className="font-semibold text-[#00cfff]">{Number(latestQuote.value).toLocaleString()} VND</span>
                  </div>
                </div>
              </div>
            )}

            {/* C2. Live trade matching log */}
            <div className="glass-panel p-5 bg-[#0d1017] flex flex-col max-h-[300px]">
              <div className="border-b border-[#1b2233] pb-3 mb-3 flex justify-between items-center shrink-0">
                <h3 className="font-outfit text-sm font-bold flex items-center gap-2 text-[#00c58e] uppercase tracking-wider m-0">
                  <Activity size={16} /> Nhật ký Khớp lệnh Live
                </h3>
                <div className="flex gap-2 text-[9px] font-bold text-[#7b8a9b]">
                  <span>KL: <span className="text-white">{totalVolume.toLocaleString()}</span></span>
                  <span className="text-up">M: {buyPercent}%</span>
                  <span className="text-down">B: {100 - buyPercent}%</span>
                </div>
              </div>

              <div className="flex-grow overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="sticky top-0 bg-[#0d1017] text-text-muted border-b border-white/5 h-6 z-10 text-[9px] uppercase">
                      <th className="text-left pl-2 font-semibold">Thời gian</th>
                      <th className="text-right font-semibold">Giá</th>
                      <th className="text-right font-semibold">+/-</th>
                      <th className="text-right pr-2 font-semibold">KL</th>
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
                          <tr key={idx} className="h-6 border-b border-white/5 hover:bg-white/2 transition-colors">
                            <td className="pl-2 text-text-muted font-mono text-[10.5px]">{t.time}</td>
                            <td className={`${t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref'} font-extrabold text-right font-mono`}>
                              {t.price.toLocaleString()}
                            </td>
                            <td className={`${diff >= 0 ? 'text-up' : 'text-down'} text-right font-semibold font-mono text-[9px]`}>
                              {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                            </td>
                            <td className={`text-right pr-2 font-semibold font-mono ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}>
                              {t.volume.toLocaleString()}
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

        </div>

        {/* ==================== RIGHT AREA (4 COLUMNS) ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* D. AI INVESTMENT THESIS SUMMARY CARD */}
          <div className="glass-panel p-5 bg-[#0d1017] border border-warning/20 shadow-xl rounded-2xl relative min-h-[350px] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1b2233] pb-3 mb-4">
              <h3 className="font-outfit text-sm font-bold flex items-center gap-2 text-warning uppercase tracking-wider m-0">
                <Sparkles size={16} />
                Luận điểm phân tích AI
              </h3>
              {aiSummary && !aiLoading && (
                <button
                  onClick={handleTriggerAi}
                  className="bg-white/5 border border-white/10 text-warning cursor-pointer p-1.5 rounded-md flex items-center justify-center hover:bg-warning/10 hover:border-warning/30 transition-all duration-200 outline-none"
                  title="Làm mới phân tích AI"
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>

            {aiMessage && (
              <div className="py-2 px-3 bg-red-500/10 border border-red-500/15 rounded-md text-red-400 text-xs text-center mb-3">
                {aiMessage}
              </div>
            )}

            {aiLoading ? (
              <div className="flex flex-col gap-4 flex-grow justify-center py-8">
                <div className="flex flex-col items-center justify-center text-center gap-3">
                  <Loader2 className="animate-spin text-warning" size={32} />
                  <div>
                    <h5 className="font-outfit font-bold text-warning text-sm mb-1">Mạng Nơ-ron AI Đang Quét...</h5>
                    <p className="text-[10px] text-text-muted leading-relaxed max-w-[240px]">Đang nén tin tức vĩ mô, chỉ số SMA/EMA & khối lượng giao dịch</p>
                  </div>
                </div>
              </div>
            ) : aiSummary ? (
              <div className="flex flex-col gap-4 flex-grow text-xs md:text-sm">
                <div className="flex justify-between items-center">
                  <span className={`badge ${aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' :
                    aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-accent'
                    } py-1 px-2.5`}>
                    XU HƯỚNG: {aiSummary.sentiment}
                  </span>
                  <span className="text-[11px] text-text-muted font-bold">
                    Độ tin cậy: {Math.round(Number(aiSummary.confidence) * 100)}%
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-lg bg-warning/5 border border-warning/10 leading-relaxed text-text-secondary text-xs">
                  <p className="font-bold text-warning mb-1.5 uppercase tracking-wide">Luận Điểm Đầu Tư</p>
                  {aiSummary.summary}
                </div>

                {/* Driver & Risk lists */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg text-[11px]">
                    <span className="text-emerald-400 font-bold block mb-1">ĐỘNG LỰC TĂNG TRƯỞNG</span>
                    <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                      {Array.isArray(aiSummary.drivers) ? aiSummary.drivers.slice(0, 3).map((d, i) => (
                        <li key={i}>{d}</li>
                      )) : <li>Động lực dòng tiền mở rộng</li>}
                    </ul>
                  </div>

                  <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg text-[11px]">
                    <span className="text-rose-400 font-bold block mb-1">RỦI RO KỸ THUẬT</span>
                    <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                      {Array.isArray(aiSummary.risks) ? aiSummary.risks.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      )) : <li>Biến động thị trường chung</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center flex-grow py-8 text-center gap-4">
                <Sparkles size={36} className="text-warning animate-pulse" />
                <div>
                  <h4 className="font-outfit text-text-primary text-sm font-semibold mb-1">
                    Chưa có Phân Tích AI
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[240px] mx-auto">
                    Yêu cầu AI quét luồng tín hiệu SMA/EMA & tin tức của {instrument.symbol} để trích xuất luận điểm.
                  </p>
                </div>
                <button
                  onClick={handleTriggerAi}
                  className="py-2 px-4 rounded-lg bg-warning text-slate-900 border-none font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Sparkles size={13} /> Phân Tích Ngay
                </button>
              </div>
            )}
          </div>

          {/* E. TECHNICAL SIGNALS CROSSOVER LOG LIST */}
          <div className="glass-panel p-5 bg-[#0d1017]">
            <h3 className="font-outfit text-sm font-bold flex items-center gap-2 border-b border-[#1b2233] pb-3 mb-4 text-[#00c58e] uppercase tracking-wider">
              <Activity size={16} /> Nhật ký tín hiệu kỹ thuật
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
