import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  BarSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import {
  X,
  TrendingUp,
  Loader2,
  Sparkles,
  Activity,
  CalendarRange,
  Search,
  Plus,
  ChevronDown,
  Settings,
  Maximize2,
  Camera,
  Check,
  Cloud,
} from "lucide-react";

// Custom Hooks & Centralized Helpers
import { useStockDetailData } from "@/lib/hooks/useStockDetailData";
import { useStockWebSocket } from "@/lib/hooks/useStockWebSocket";
import { useStockChartDrawing } from "@/lib/hooks/useStockChartDrawing";
import { getCompanyName } from "@/lib/helpers/company.helper";
import {
  calculatePricingBounds,
  formatCurrency,
} from "@/lib/helpers/price.helper";
import { marketApi } from "@/lib/api/market.api";

// Shared Dumb UI Widgets
import { DrawingToolbar } from "@/components/terminal/DrawingToolbar";
import { CumulativeOrderBook } from "@/components/terminal/CumulativeOrderBook";
import { LiveMatchedTradesLog } from "@/components/terminal/LiveMatchedTradesLog";

interface TickerDetailPanelProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TickerDetailPanel: React.FC<TickerDetailPanelProps> = ({
  symbol,
  isOpen,
  onClose,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Compact Sub tabs
  const [activeSubTab, setActiveSubTab] = useState<
    "chart" | "orderbook" | "ai"
  >("chart");
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "1D" | "1W">(
    "1D",
  );

  // TradingView custom controls states
  const [currentSymbol, setCurrentSymbol] = useState<string>(symbol);
  const [chartType, setChartType] = useState<string>("candle");
  const [compareSymbol, setCompareSymbol] = useState<string>("");
  const [compareInput, setCompareInput] = useState<string>("");

  // Dropdown visibility states
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const [isChartTypeOpen, setIsChartTypeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search symbol states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  // Sync currentSymbol with symbol prop when it changes
  useEffect(() => {
    setCurrentSymbol(symbol);
    setCompareSymbol("");
    setSearchQuery("");
  }, [symbol]);

  // TradingView Bottom Bar states
  const [timeRange, setTimeRange] = useState<string>("1y");
  const [currentTime, setCurrentTime] = useState("");
  const [scalePercent, setScalePercent] = useState(false);
  const [scaleLog, setScaleLog] = useState(false);
  const [scaleAuto, setScaleAuto] = useState(true);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
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
    handleTriggerAi,
  } = useStockDetailData(currentSymbol, mockTranslate);

  // Apply chart scaling options dynamically
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    let mode = 0; // Normal
    if (scalePercent)
      mode = 2; // Percentage
    else if (scaleLog) mode = 1; // Logarithmic

    chart.priceScale("right").applyOptions({
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

    if (timeRange === "All") {
      timeScale.fitContent();
      return;
    }

    let barsToShow = 250;
    switch (timeRange) {
      case "1d":
        barsToShow = 5;
        break;
      case "5d":
        barsToShow = 10;
        break;
      case "1m":
        barsToShow = 22;
        break;
      case "3m":
        barsToShow = 66;
        break;
      case "6m":
        barsToShow = 132;
        break;
      case "1y":
        barsToShow = 250;
        break;
      case "5y":
        barsToShow = 1250;
        break;
    }

    const startIndex = Math.max(0, totalCount - barsToShow);
    const fromTime = candles[startIndex].time;
    const toTime = candles[totalCount - 1].time;

    try {
      timeScale.setVisibleRange({ from: fromTime, to: toTime });
    } catch (e) {
      console.warn("Failed to set visible range in sidebar panel:", e);
    }
  }, [timeRange, loading]);

  // Dynamic Pricing Margin Calculations
  const basePrice = latestQuote
    ? Number(latestQuote.previousClose) || Number(latestQuote.price) || 22850
    : 22850;
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
    resetAllDrawingsArray,
  } = useStockChartDrawing();

  // TradingView Chart API Refs
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | any>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);

  const latestBarRef = useRef<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const rawCandlesRef = useRef<any[]>([]);

  // 3. WebSockets Real-time Trades Subscription Custom Hook
  const { bids, asks, trades } = useStockWebSocket(
    currentSymbol,
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
      if (
        candlestickSeries &&
        latestBarRef.current &&
        activeSubTab === "chart"
      ) {
        if (latestBarRef.current.time === time) {
          latestBarRef.current.close = tick.price;
          latestBarRef.current.high = Math.max(
            latestBarRef.current.high,
            tick.price,
          );
          latestBarRef.current.low = Math.min(
            latestBarRef.current.low,
            tick.price,
          );
        } else {
          latestBarRef.current = {
            time,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
          };
        }
        try {
          candlestickSeries.update(latestBarRef.current as any);
        } catch (e) {}
      }
    },
  );

  // Search handler
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setLoadingSearch(true);
    setShowSearchDropdown(true);
    try {
      const res = await marketApi.search(val);
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setCurrentSymbol(sym.toUpperCase());
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  // Helper for rendering custom chart type icons
  const renderChartTypeIcon = (type: string) => {
    switch (type) {
      case "bar":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M4 2v10M2 4h2M4 9h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M10 2v10M8 5h2M10 8h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "hollow":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <rect
              x="4"
              y="3"
              width="6"
              height="8"
              rx="0.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M7 1v2M7 11v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "line":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M1 11l4-5 4 4 4-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "line-markers":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M1 11l4-5 4 4 4-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="5" cy="6" r="1.5" fill="currentColor" />
            <circle cx="9" cy="10" r="1.5" fill="currentColor" />
            <circle cx="13" cy="3" r="1.5" fill="currentColor" />
          </svg>
        );
      case "step":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M1 11h4V6h4v4h4V3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "area":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M1 11l4-5 4 4 4-7v8H1z"
              fill="currentColor"
              fillOpacity="0.2"
            />
            <path
              d="M1 11l4-5 4 4 4-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "hlc-area":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "#e91e63" }}
          >
            <path
              d="M1 9l4-3 4 5 4-8v8H1z"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <path
              d="M1 9l4-3 4 5 4-8"
              stroke="#e91e63"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "baseline":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M1 7h12"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <path
              d="M1 9l4-4 4 5 4-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "columns":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <rect
              x="2"
              y="5"
              width="2.5"
              height="7"
              rx="0.5"
              fill="currentColor"
            />
            <rect
              x="6"
              y="2"
              width="2.5"
              height="10"
              rx="0.5"
              fill="currentColor"
            />
            <rect
              x="10"
              y="7"
              width="2.5"
              height="5"
              rx="0.5"
              fill="currentColor"
            />
          </svg>
        );
      case "high-low":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <path
              d="M4 1v12M10 2v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
      case "heikin-ashi":
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <rect
              x="4"
              y="3"
              width="6"
              height="8"
              rx="0.5"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 1v2M7 11v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <text
              x="3"
              y="10"
              fontSize="5"
              fontWeight="bold"
              fill="#080b11"
              style={{ pointerEvents: "none" }}
            >
              HA
            </text>
          </svg>
        );
      case "candle":
      default:
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ color: "currentColor" }}
          >
            <rect
              x="4"
              y="3"
              width="6"
              height="8"
              rx="0.5"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7 1v2M7 11v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        );
    }
  };

  const chartTypesList = [
    { id: "bar", label: "Hình Thanh" },
    { id: "candle", label: "Biểu đồ nến" },
    { id: "hollow", label: "Biểu đồ nến Hollow" },
    { id: "line", label: "Đường thẳng" },
    { id: "line-markers", label: "Biểu đồ Đường có điểm đánh dấu" },
    { id: "step", label: "Biểu đồ Đường bậc" },
    { id: "area", label: "Biểu đồ vùng" },
    { id: "hlc-area", label: "Vùng HLC" },
    { id: "baseline", label: "Đường cơ sở" },
    { id: "columns", label: "Các cột" },
    { id: "high-low", label: "Đỉnh-Đáy" },
    { id: "heikin-ashi", label: "Mô hình Heikin Ashi" },
  ];

  // Mocks intraday candles for dynamic intervals
  const getIntervalCandles = (
    raw: any[],
    interval: "1m" | "5m" | "15m" | "1D" | "1W",
  ) => {
    if (interval === "1D") return raw;
    if (interval === "1W") {
      const weekly = [];
      for (let i = 0; i < raw.length; i += 5) {
        const chunk = raw.slice(i, i + 5);
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map((x) => x.high));
        const low = Math.min(...chunk.map((x) => x.low));
        weekly.push({ time: chunk[0].time, open, high, low, close });
      }
      return weekly;
    }
    const intraday = [];
    const spacing = interval === "1m" ? 60 : interval === "5m" ? 300 : 900;
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
        close: Number(c.toFixed(2)),
      });
      lastVal = c;
    }
    return intraday;
  };

  // 4. REST Candlesticks loading & chart initialization (when tab is chart)
  useEffect(() => {
    if (
      !isOpen ||
      loading ||
      errorMsg ||
      activeSubTab !== "chart" ||
      !chartContainerRef.current
    )
      return;

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#06070a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#131822" },
        horzLines: { color: "#131822" },
      },
      timeScale: {
        borderColor: "#1a2233",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#1a2233",
      },
      width: chartContainerRef.current.clientWidth || 320,
      height: chartContainerRef.current.clientHeight || 380,
    });

    let mainSeries: any = null;
    const seriesOptions: any = {
      upColor: "#00e676",
      downColor: "#ff1744",
      borderUpColor: "#00e676",
      borderDownColor: "#ff1744",
      wickUpColor: "#00e676",
      wickDownColor: "#ff1744",
    };

    if (chartType === "candle" || chartType === "heikin-ashi") {
      mainSeries = chart.addSeries(CandlestickSeries, seriesOptions);
    } else if (chartType === "hollow") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        ...seriesOptions,
        upColor: "transparent",
      });
    } else if (chartType === "bar" || chartType === "high-low") {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: "#00e676",
        downColor: "#ff1744",
      });
    } else if (chartType === "line") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#00c58e",
        lineWidth: 2,
      });
    } else if (chartType === "line-markers") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#00c58e",
        lineWidth: 2,
        pointMarkersVisible: true,
        pointMarkersRadius: 4,
      });
    } else if (chartType === "step") {
      mainSeries = chart.addSeries(LineSeries, {
        color: "#00c58e",
        lineWidth: 2,
        lineType: 1, // LineType.WithSteps
      });
    } else if (chartType === "area") {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(0, 197, 142, 0.4)",
        bottomColor: "rgba(0, 197, 142, 0.0)",
        lineColor: "#00c58e",
        lineWidth: 2,
      });
    } else if (chartType === "hlc-area") {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(233, 30, 99, 0.4)",
        bottomColor: "rgba(33, 150, 243, 0.0)",
        lineColor: "#e91e63",
        lineWidth: 2,
      });
    } else if (chartType === "baseline") {
      mainSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: basePrice },
        topFillColor1: "rgba(0, 230, 118, 0.28)",
        topFillColor2: "rgba(0, 230, 118, 0.05)",
        topLineColor: "#00e676",
        bottomFillColor1: "rgba(255, 23, 68, 0.05)",
        bottomFillColor2: "rgba(255, 23, 68, 0.28)",
        bottomLineColor: "#ff1744",
        lineWidth: 2,
      });
    } else if (chartType === "columns") {
      mainSeries = chart.addSeries(HistogramSeries, {
        color: "#00c58e",
      });
    }

    chartRef.current = chart;
    candlestickSeriesRef.current = mainSeries;

    // Optional comparison overlay series
    let overlaySeries: any = null;
    if (compareSymbol) {
      overlaySeries = chart.addSeries(LineSeries, {
        color: "#ff9800",
        lineWidth: 2,
        title: compareSymbol.toUpperCase(),
      });
    }

    const calculateHeikinAshi = (candles: any[]) => {
      if (candles.length === 0) return [];
      const haData = [];
      let prevOpen = candles[0].open;
      let prevClose = candles[0].close;
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const haClose = (c.open + c.high + c.low + c.close) / 4;
        const haOpen = (prevOpen + prevClose) / 2;
        const haHigh = Math.max(c.high, haOpen, haClose);
        const haLow = Math.min(c.low, haOpen, haClose);
        haData.push({
          time: c.time,
          open: haOpen,
          high: haHigh,
          low: haLow,
          close: haClose,
        });
        prevOpen = haOpen;
        prevClose = haClose;
      }
      return haData;
    };

    async function loadCandles() {
      try {
        const resData = await marketApi.getCandles(currentSymbol);
        if (resData.success && resData.data && resData.data.length > 0) {
          const processedCandles = getIntervalCandles(resData.data, timeframe);
          rawCandlesRef.current = processedCandles;

          let formattedData: any[] = [];
          if (
            chartType === "candle" ||
            chartType === "hollow" ||
            chartType === "bar"
          ) {
            formattedData = processedCandles;
          } else if (chartType === "heikin-ashi") {
            formattedData = calculateHeikinAshi(processedCandles);
          } else if (chartType === "high-low") {
            formattedData = processedCandles.map((c) => ({
              time: c.time,
              open: c.low,
              high: c.high,
              low: c.low,
              close: c.high,
            }));
          } else {
            formattedData = processedCandles.map((c) => ({
              time: c.time,
              value: c.close,
            }));
          }

          mainSeries.setData(formattedData);
          chart.timeScale().fitContent();

          const lastCandle = processedCandles[processedCandles.length - 1];
          latestBarRef.current = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          };

          recalculateIndicators();
        }

        if (compareSymbol && overlaySeries) {
          const compRes = await marketApi.getCandles(compareSymbol);
          if (compRes.success && compRes.data && compRes.data.length > 0) {
            const compCandles = getIntervalCandles(compRes.data, timeframe);
            const compData = compCandles.map((c) => ({
              time: c.time,
              value: c.close,
            }));
            overlaySeries.setData(compData);
          }
        }
      } catch (err) {
        console.error("Error loading candles in sidebar panel:", err);
      }
    }

    loadCandles();

    // Attach click events handlers to hook
    chart.subscribeClick((param: any) => {
      handleChartClick(
        param,
        chart,
        candlestickSeriesRef.current,
        rawCandlesRef.current,
      );
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
  }, [
    isOpen,
    loading,
    errorMsg,
    activeSubTab,
    timeframe,
    currentSymbol,
    chartType,
    compareSymbol,
  ]);

  // Recalculates SMA/EMA indicators
  const recalculateIndicators = () => {
    const chart = chartRef.current;
    const candles = rawCandlesRef.current;
    if (!chart || candles.length === 0) return;

    if (showSMA) {
      if (!smaSeriesRef.current) {
        smaSeriesRef.current = chart.addSeries(LineSeries, {
          color: "#ffb300",
          lineWidth: 2,
          title: "SMA (20)",
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
          color: "#00cfff",
          lineWidth: 2,
          title: "EMA (50)",
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
  const priceColor =
    currentPrice > tc
      ? "text-up"
      : currentPrice < tc
        ? "text-down"
        : "text-ref";

  if (!isOpen) return null;

  return (
    <div
      className={`right-slide-panel flex flex-col ${isOpen ? "panel-open" : "panel-closed"} font-inter`}
    >
      {/* PANEL HEADER */}
      <div className="flex justify-between items-center p-3 border-b border-border-board bg-board-header">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#090b11] p-1 px-2.5 rounded border border-[#1b2233] text-[11px]">
            <span className="text-text-muted">🔍</span>
            <span className="font-extrabold text-[#00c58e] tracking-tight">
              {currentSymbol.toUpperCase()}
            </span>
            <span className="text-[9px] text-text-muted font-bold bg-white/5 px-0.5 rounded uppercase">
              HOSE
            </span>
          </div>
          <span className="text-[10px] text-text-secondary font-bold truncate max-w-[120px]">
            {getCompanyName(currentSymbol)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              alert(
                `Đặt lệnh nhanh mã ${currentSymbol.toUpperCase()} trên Sidebar.`,
              )
            }
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
            <span
              className={`${priceColor} font-outfit text-xl font-extrabold tracking-tight`}
            >
              {formatCurrency(currentPrice)}
            </span>
            <span className={`text-[9.5px] font-bold ${priceColor}`}>
              {currentChange >= 0 ? "+" : ""}
              {formatCurrency(currentChange)} ({currentChange >= 0 ? "+" : ""}
              {(currentPct * 100).toFixed(1)}%)
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
          onClick={() => setActiveSubTab("chart")}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === "chart"
              ? "border-accent text-accent bg-accent/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-white/2"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <TrendingUp size={14} />
            Đồ thị
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab("orderbook")}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === "orderbook"
              ? "border-accent text-accent bg-accent/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-white/2"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Activity size={14} />
            Sổ lệnh
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab("ai")}
          className={`flex-1 py-3 border-b-2 font-outfit font-bold text-xs uppercase tracking-wider cursor-pointer border-0 transition-all duration-200 ${
            activeSubTab === "ai"
              ? "border-accent text-accent bg-accent/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-white/2"
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
        {activeSubTab === "chart" && (
          <div className="flex flex-col gap-3 h-full min-h-[480px]">
            {/* TradingView Top Toolbar Strip */}
            <div className="flex justify-between items-center bg-[#1c2030] h-9 border-b border-[#2d313e] px-2 select-none text-xs font-semibold text-[#c5cbdb] relative shrink-0">
              <div className="flex items-center gap-1.5 h-full">
                {/* Search box symbol switcher */}
                <div className="relative flex items-center h-full">
                  <div className="relative flex items-center bg-[#2a2e3f] hover:bg-[#32364c] border border-transparent focus-within:border-[#2962ff] rounded px-1.5 py-0.5 h-6 text-xs transition-all w-20">
                    <Search size={9} className="text-[#848e9c] mr-1 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder={currentSymbol}
                      className="bg-transparent border-none outline-none text-white font-extrabold text-[10px] placeholder:text-white w-full uppercase"
                      onFocus={() => setShowSearchDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSearchDropdown(false), 200)
                      }
                    />
                  </div>

                  {/* Search dropdown autocomplete */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 max-h-48 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl overflow-y-auto z-[200] p-1 scrollbar-none animate-scale-up">
                      {searchResults.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectSymbol(item.symbol)}
                          className="flex justify-between items-center px-2 py-1 hover:bg-[#2a2e3f] rounded cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-extrabold text-[#00c58e] text-[10px] mr-1.5">
                              {item.symbol}
                            </span>
                            <span className="text-[9px] text-text-secondary truncate max-w-[80px] inline-block">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[8px] text-[#848e9c] bg-[#141823] px-0.5 rounded uppercase font-bold">
                            HOSE
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compare Symbol (+) */}
                <div className="relative flex items-center h-full">
                  <button
                    onClick={() => {
                      setIsCompareOpen(!isCompareOpen);
                      setIsTimeframeOpen(false);
                      setIsChartTypeOpen(false);
                      setIsSettingsOpen(false);
                    }}
                    className={`h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c] ${compareSymbol ? "text-[#ff9800] bg-[#ff9800]/10" : ""}`}
                    title="So sánh hoặc thêm mã"
                  >
                    <Plus size={12} />
                  </button>
                  {isCompareOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-40 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-1.5 z-[200] flex flex-col gap-1">
                      <span className="text-[8.5px] text-[#848e9c] font-extrabold uppercase">
                        So sánh
                      </span>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={compareInput}
                          onChange={(e) => {
                            setCompareInput(e.target.value);
                          }}
                          placeholder="Mã..."
                          className="bg-[#2a2e3f] border border-[#3c4155] rounded px-1 py-0.5 text-white text-[10px] font-bold w-full outline-none focus:border-[#2962ff] uppercase"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (compareInput.trim()) {
                                setCompareSymbol(
                                  compareInput.trim().toUpperCase(),
                                );
                                setIsCompareOpen(false);
                                setCompareInput("");
                              }
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (compareInput.trim()) {
                              setCompareSymbol(
                                compareInput.trim().toUpperCase(),
                              );
                              setIsCompareOpen(false);
                              setCompareInput("");
                            }
                          }}
                          className="bg-[#2962ff] hover:bg-[#1e4fe2] text-white text-[9px] font-bold px-1.5 rounded cursor-pointer border-none transition-colors"
                        >
                          OK
                        </button>
                      </div>
                      {compareSymbol && (
                        <button
                          onClick={() => {
                            setCompareSymbol("");
                            setIsCompareOpen(false);
                          }}
                          className="text-[9px] text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer text-left font-bold"
                        >
                          Xóa ({compareSymbol})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-[1px] h-3 bg-[#2b2e3a] mx-0.5" />

                {/* Timeframe Dropdown */}
                <div className="relative flex items-center h-full">
                  <button
                    onClick={() => {
                      setIsTimeframeOpen(!isTimeframeOpen);
                      setIsCompareOpen(false);
                      setIsChartTypeOpen(false);
                      setIsSettingsOpen(false);
                    }}
                    className="h-6 px-1 flex items-center gap-0.5 rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent font-bold text-[10px] text-[#c5cbdb]"
                  >
                    <span>{timeframe}</span>
                    <ChevronDown size={7} className="text-[#848e9c]" />
                  </button>
                  {isTimeframeOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-20 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-0.5 z-[200] flex flex-col gap-0.5">
                      {(["1m", "5m", "15m", "1D", "1W"] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => {
                            setTimeframe(tf);
                            setIsTimeframeOpen(false);
                          }}
                          className={`w-full text-left px-1.5 py-1 rounded text-[9.5px] font-bold cursor-pointer border-none bg-transparent transition-colors ${timeframe === tf ? "text-[#00c58e] bg-[#00c58e]/10" : "text-[#c5cbdb] hover:bg-[#2a2e3f] hover:text-white"}`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-[1px] h-3 bg-[#2b2e3a] mx-0.5" />

                {/* Chart Type Dropdown */}
                <div className="relative flex items-center h-full">
                  <button
                    onClick={() => {
                      setIsChartTypeOpen(!isChartTypeOpen);
                      setIsCompareOpen(false);
                      setIsTimeframeOpen(false);
                      setIsSettingsOpen(false);
                    }}
                    className="h-6 px-1 flex items-center gap-0.5 rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent font-bold text-[10px] text-[#c5cbdb]"
                    title="Loại biểu đồ"
                  >
                    {renderChartTypeIcon(chartType)}
                    <ChevronDown size={7} className="text-[#848e9c]" />
                  </button>
                  {isChartTypeOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-44 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-0.5 z-[200] flex flex-col gap-0.5 max-h-56 overflow-y-auto scrollbar-none">
                      {chartTypesList.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setChartType(item.id);
                            setIsChartTypeOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[9.5px] font-bold cursor-pointer border-none bg-transparent transition-colors ${chartType === item.id ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#c5cbdb] hover:bg-[#2a2e3f] hover:text-white"}`}
                        >
                          <span className="shrink-0 text-[#848e9c]">
                            {renderChartTypeIcon(item.id)}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {drawStatus && (
                  <span className="text-[9px] text-purple-400 font-extrabold animate-pulse truncate max-w-[60px] ml-1">
                    {drawStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0.5 h-full">
                {/* Cloud Save Icon */}
                <button
                  onClick={() => {
                    setToastMessage("Đã lưu bố cục!");
                    setTimeout(() => setToastMessage(""), 3000);
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                  title="Lưu bố cục biểu đồ"
                >
                  <Cloud size={12} />
                </button>

                {/* Settings (Gear) Icon */}
                <div className="relative flex items-center h-full">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(!isSettingsOpen);
                      setIsCompareOpen(false);
                      setIsTimeframeOpen(false);
                      setIsChartTypeOpen(false);
                    }}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                    title="Cài đặt thuộc tính"
                  >
                    <Settings size={12} />
                  </button>
                  {isSettingsOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-36 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-1.5 z-[200] flex flex-col gap-1.5">
                      <span className="text-[8.5px] text-[#848e9c] font-extrabold uppercase pb-0.5 border-b border-[#2d313e]">
                        Chỉ báo
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-[9.5px] font-bold text-[#c5cbdb]">
                        <input
                          type="checkbox"
                          checked={showSMA}
                          onChange={(e) => setShowSMA(e.target.checked)}
                          className="rounded border-[#3c4155] accent-[#ffb300]"
                        />
                        <span className="text-[#ffb300]">SMA (20)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-[9.5px] font-bold text-[#c5cbdb]">
                        <input
                          type="checkbox"
                          checked={showEMA}
                          onChange={(e) => setShowEMA(e.target.checked)}
                          className="rounded border-[#3c4155] accent-[#00cfff]"
                        />
                        <span className="text-[#00cfff]">EMA (50)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Fullscreen Icon */}
                <button
                  onClick={() => {
                    const el = chartContainerRef.current?.parentElement;
                    if (!el) return;
                    if (!document.fullscreenElement) {
                      el.requestFullscreen().catch((err) => console.error(err));
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                  title="Chế độ toàn màn hình"
                >
                  <Maximize2 size={12} />
                </button>

                {/* Snapshot (Camera) Icon */}
                <button
                  onClick={() => {
                    const chart = chartRef.current;
                    if (!chart) return;
                    try {
                      const canvas = chart.takeScreenshot();
                      const url = canvas.toDataURL("image/png");
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${currentSymbol}_Chart_${timeframe}.png`;
                      link.click();
                      setToastMessage("Đã tải ảnh!");
                      setTimeout(() => setToastMessage(""), 3000);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                  title="Chụp ảnh biểu đồ"
                >
                  <Camera size={12} />
                </button>
              </div>
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
              <div className="flex-grow h-full flex flex-col overflow-hidden relative">
                <div
                  ref={chartContainerRef}
                  className="flex-grow w-full h-full relative bg-[#06070a]"
                />
                {toastMessage && (
                  <div className="absolute bottom-4 right-4 bg-emerald-500 text-slate-950 font-extrabold text-[9px] px-2 py-1 rounded shadow-2xl z-[210] flex items-center gap-1 select-none">
                    <Check size={10} className="stroke-[3px]" />
                    {toastMessage}
                  </div>
                )}

                {/* Bottom Status Bar */}
                <div className="h-7 border-t border-[#131822] bg-[#080b11] px-3 flex justify-between items-center text-[10px] text-[#7b8a9b] font-mono shrink-0 select-none">
                  <div className="flex items-center gap-2.5">
                    {(
                      ["1d", "5d", "1m", "3m", "6m", "1y", "5y", "All"] as const
                    ).map((r) => (
                      <span
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`cursor-pointer transition-colors font-bold text-[9px] ${
                          timeRange === r
                            ? "text-[#00c58e] font-extrabold"
                            : "text-[#7b8a9b] hover:text-white"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                    <span className="text-[#1a2233]">|</span>
                    <CalendarRange
                      size={11}
                      className="hover:text-white cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span>{currentTime}</span>
                    <span className="text-[#1a2233]">|</span>
                    <div className="flex gap-2">
                      <span
                        onClick={() => {
                          setScalePercent(!scalePercent);
                          setScaleLog(false);
                        }}
                        className={`cursor-pointer transition-colors ${scalePercent ? "text-[#00c58e] font-bold" : "hover:text-white"}`}
                      >
                        %
                      </span>
                      <span
                        onClick={() => {
                          setScaleLog(!scaleLog);
                          setScalePercent(false);
                        }}
                        className={`cursor-pointer transition-colors ${scaleLog ? "text-[#00c58e] font-bold" : "hover:text-white"}`}
                      >
                        log
                      </span>
                      <span
                        onClick={() => setScaleAuto(!scaleAuto)}
                        className={`cursor-pointer transition-colors ${scaleAuto ? "text-[#00c58e] font-bold" : "hover:text-white"}`}
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
        {activeSubTab === "orderbook" && (
          <div className="flex flex-col gap-4">
            <CumulativeOrderBook bids={bids} asks={asks} tc={tc} />
            <LiveMatchedTradesLog trades={trades} tc={tc} />
          </div>
        )}

        {/* SUBTAB 3: AI ANALYSIS */}
        {activeSubTab === "ai" && (
          <div className="flex flex-col gap-4">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center text-center p-12 gap-3 bg-[#0d1017] border border-white/5 rounded-xl min-h-[300px]">
                <Loader2 className="animate-spin text-warning" size={32} />
                <div>
                  <h5 className="font-outfit font-bold text-warning text-sm mb-1">
                    Mạng Nơ-ron AI Đang Quét...
                  </h5>
                  <p className="text-[10px] text-text-muted leading-relaxed max-w-[200px]">
                    Đang nén tin tức vĩ mô, chỉ số SMA/EMA & khối lượng giao
                    dịch
                  </p>
                </div>
              </div>
            ) : aiSummary ? (
              <div className="flex flex-col gap-3.5 text-xs md:text-sm bg-[#0d1017] p-4 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center border-b border-[#1b2233] pb-3.5 mb-1">
                  <span
                    className={`badge ${
                      aiSummary.sentiment === "BULLISH"
                        ? "badge-bullish"
                        : aiSummary.sentiment === "BEARISH"
                          ? "badge-bearish"
                          : "badge-accent"
                    } py-1 px-2.5`}
                  >
                    XU HƯỚNG: {aiSummary.sentiment}
                  </span>

                  <span className="text-[10px] text-text-muted font-bold font-mono">
                    Độ tin cậy: {Math.round(Number(aiSummary.confidence) * 100)}
                    %
                  </span>
                </div>

                <div className="glass-panel p-3.5 rounded-lg bg-warning/5 border border-warning/10 leading-relaxed text-text-secondary text-xs">
                  <p className="font-bold text-warning mb-1.5 uppercase tracking-wide">
                    Luận Điểm Đầu Tư
                  </p>
                  {aiSummary.summary}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg text-[10.5px]">
                  <span className="text-emerald-400 font-bold block mb-1">
                    ĐỘNG LỰC TĂNG TRƯỞNG
                  </span>
                  <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                    {Array.isArray(aiSummary.drivers) ? (
                      aiSummary.drivers
                        .slice(0, 3)
                        .map((d, i) => <li key={i}>{d}</li>)
                    ) : (
                      <li>Động lực dòng tiền mạnh</li>
                    )}
                  </ul>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg text-[10.5px]">
                  <span className="text-rose-400 font-bold block mb-1">
                    RỦI RO KỸ THUẬT
                  </span>
                  <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                    {Array.isArray(aiSummary.risks) ? (
                      aiSummary.risks
                        .slice(0, 3)
                        .map((r, i) => <li key={i}>{r}</li>)
                    ) : (
                      <li>Biến động giá cực lớn</li>
                    )}
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
                  <h4 className="font-outfit text-text-primary text-sm font-semibold mb-1">
                    Chưa có Phân Tích AI
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed max-w-[200px] mx-auto">
                    Yêu cầu AI quét tín hiệu kỹ thuật của {symbol} để lấy khuyến
                    nghị.
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
