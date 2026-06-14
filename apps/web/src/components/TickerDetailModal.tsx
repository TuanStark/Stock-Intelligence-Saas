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
  Loader2,
  Sparkles,
  AlertTriangle,
  Calendar,
  Newspaper,
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
import { CompanyFinancials } from "@/lib/helpers/company-data";

// Atomic Widgets
import { DrawingToolbar } from "@/components/terminal/DrawingToolbar";
import { CumulativeOrderBook } from "@/components/terminal/CumulativeOrderBook";

interface TickerDetailModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TickerDetailModal: React.FC<TickerDetailModalProps> = ({
  symbol,
  isOpen,
  onClose,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Tab states
  const [activeTab, setActiveTab] = useState<
    | "Giao dịch"
    | "Hồ sơ"
    | "Cổ đông"
    | "Vốn và cổ tức"
    | "Tin tức"
    | "Lịch sự kiện"
    | "Thống kê"
    | "Tài chính"
  >("Giao dịch");
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

  // Technical Indicators states
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);

  // Sub-tabs financial data states
  const [financials, setFinancials] = useState<CompanyFinancials | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // 1. Core Data Custom React Hook (Mock translation wrapper to keep it generic)
  const mockTranslate = (key: string) => key;
  const {
    latestQuote,
    loading,
    errorMsg,
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
      console.warn("Failed to set visible range in modal:", e);
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
      if (candlestickSeries && latestBarRef.current && timeframe === "1D") {
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

  // 4. REST Candlesticks loading & chart initialization (when tab is Giao dịch)
  useEffect(() => {
    if (
      !isOpen ||
      loading ||
      errorMsg ||
      activeTab !== "Giao dịch" ||
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
      width: chartContainerRef.current.clientWidth || 800,
      height: chartContainerRef.current.clientHeight || 450,
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
        console.error("Error loading candles inside modal:", err);
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
    activeTab,
    timeframe,
    currentSymbol,
    chartType,
    compareSymbol,
  ]);

  // Load other financial sub-tabs metadata
  useEffect(() => {
    if (!isOpen || activeTab === "Giao dịch") return;

    async function loadFinancials() {
      try {
        setLoadingFinancials(true);
        const res = await marketApi.getFinancials(currentSymbol);
        if (res.success && res.data) {
          setFinancials(res.data);
        }
      } catch (err) {
        console.error("Failed to load sub-tab financials:", err);
      } finally {
        setLoadingFinancials(false);
      }
    }

    loadFinancials();
  }, [isOpen, activeTab, currentSymbol]);

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

  const onClearAllDrawings = () => {
    clearAllDrawings(chartRef.current, candlestickSeriesRef.current);
  };

  // Sub tab rendering logic
  const renderSubTab = () => {
    if (loadingFinancials || !financials) {
      return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in font-inter">
          <Loader2 className="w-8 h-8 text-[#00c58e] animate-spin mb-3" />
          <span className="text-text-muted text-[11px] font-bold tracking-wider uppercase">
            Đang đồng bộ dữ liệu tài chính thực tế...
          </span>
        </div>
      );
    }

    const comp = financials as CompanyFinancials;

    switch (activeTab) {
      case "Hồ sơ":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in font-inter text-xs">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
                <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-3 pb-2 border-b border-[#222b3e]">
                  Giới Thiệu Doanh Nghiệp
                </h4>
                <p className="text-text-secondary leading-relaxed text-[11.5px] whitespace-pre-line">
                  {comp.overview.description}
                </p>
              </div>

              <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
                <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-3 pb-2 border-b border-[#222b3e]">
                  Ban Lãnh Đạo Chủ Chốt
                </h4>
                <div className="flex flex-col gap-2.5">
                  {comp.overview.management.map((m, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-[#141a27] p-3 rounded-lg border border-[#232d42]/40 hover:border-[#31405b]/60 transition-colors"
                    >
                      <span className="font-bold text-white text-[11.5px]">
                        {m.name}
                      </span>
                      <span className="text-[10px] text-text-muted font-bold uppercase">
                        {m.position}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg h-fit">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Chỉ Số Định Giá & Cơ Bản
              </h4>
              <div className="flex flex-col gap-3 font-mono text-[11px]">
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Ngành nghề
                  </span>
                  <span className="font-bold text-white font-sans">
                    {comp.overview.industry}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Vốn điều lệ
                  </span>
                  <span className="font-bold text-white">
                    {(
                      comp.valuation.charterCapital / 1000000000
                    ).toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    Tỷ VND
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Cổ phiếu lưu hành
                  </span>
                  <span className="font-bold text-white">
                    {comp.valuation.outstandingShares.toLocaleString()} CP
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Vốn hóa thị trường
                  </span>
                  <span className="font-bold text-[#00c58e]">
                    {(comp.valuation.marketCap / 1000000000).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 1 },
                    )}{" "}
                    Tỷ VND
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Hệ số Beta
                  </span>
                  <span className="font-bold text-white">
                    {comp.valuation.beta.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    EPS cơ bản
                  </span>
                  <span className="font-bold text-[#00c58e]">
                    {comp.valuation.eps.toLocaleString()} đ
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    P/E
                  </span>
                  <span className="font-bold text-white">
                    {comp.valuation.pe}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    P/B
                  </span>
                  <span className="font-bold text-white">
                    {comp.valuation.pb}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-sans font-medium">
                    Tỷ suất cổ tức
                  </span>
                  <span className="font-bold text-[#e040fb]">
                    {comp.valuation.dividendYield}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case "Cổ đông":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Cơ Cấu Sở Hữu
              </h4>
              <div className="flex flex-col gap-4">
                {comp.shareholders.structure.map((item, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between font-bold text-[10.5px]">
                      <span className="text-text-secondary flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="font-mono" style={{ color: item.color }}>
                        {item.percentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#141a27] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Danh Sách Cổ Đông Lớn
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Tên cổ đông
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Số lượng cổ phiếu
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">
                        Tỷ lệ sở hữu
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.shareholders.major.map((sh, i) => (
                      <tr
                        key={i}
                        className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors"
                      >
                        <td className="text-white font-sans font-bold">
                          {sh.name}
                        </td>
                        <td className="text-right text-text-secondary">
                          {sh.shares.toLocaleString()} CP
                        </td>
                        <td className="text-right font-bold text-[#00c58e] pr-2">
                          {sh.percentage.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "Vốn và cổ tức":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Lịch Sử Tăng Vốn
              </h4>
              <div className="relative pl-6 border-l border-[#232d42] flex flex-col gap-6 py-2">
                {comp.capitalHistory.map((cap, i) => (
                  <div key={i} className="relative">
                    <span className="absolute -left-[30px] top-1 w-2 h-2 rounded-full bg-[#00c58e] border-4 border-[#080b11]" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-outfit font-extrabold text-white text-[12px]">
                          {cap.year}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold">
                          Vốn:{" "}
                          {(cap.value / 1000000000).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          Tỷđ
                        </span>
                      </div>
                      <span className="text-[10.5px] text-text-secondary">
                        {cap.event}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Lịch Sử Chi Trả Cổ Tức
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8">
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Ngày GDKHQ
                      </th>
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Hình thức chi trả
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">
                        Tỷ lệ chi trả
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.dividends.map((div, i) => (
                      <tr
                        key={i}
                        className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors font-mono"
                      >
                        <td className="text-white font-sans font-bold">
                          {div.exDate}
                        </td>
                        <td className="text-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${div.type === "Tiền mặt" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}
                          >
                            {div.type}
                          </span>
                        </td>
                        <td className="text-right font-bold text-white pr-2">
                          {div.rate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "Tin tức":
        return (
          <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg animate-fade-in font-inter text-xs max-w-[1000px] mx-auto">
            <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
              Tin Tức Doanh Nghiệp Liên Quan
            </h4>
            <div className="flex flex-col gap-4">
              {comp.news.map((item, i) => {
                const badgeColor =
                  item.sentiment === "BULLISH"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : item.sentiment === "BEARISH"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-gray-500/10 text-gray-400 border border-gray-500/20";
                const badgeText =
                  item.sentiment === "BULLISH"
                    ? "Tích cực"
                    : item.sentiment === "BEARISH"
                      ? "Tiêu cực"
                      : "Trung lập";

                return (
                  <div
                    key={i}
                    className="bg-[#141a27] p-4 rounded-xl border border-[#232d42]/30 hover:border-[#31405b]/60 transition-all duration-200 flex flex-col gap-2 relative group"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-bold text-white text-[12px] group-hover:text-[#00c58e] transition-colors leading-snug cursor-pointer">
                        {item.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${badgeColor}`}
                      >
                        {badgeText}
                      </span>
                    </div>
                    <div className="flex gap-4 text-[9.5px] text-text-muted font-bold">
                      <span>
                        <Calendar
                          size={11}
                          className="inline mr-1 text-text-muted"
                        />{" "}
                        {item.date}
                      </span>
                      <span>
                        <Newspaper
                          size={11}
                          className="inline mr-1 text-text-muted"
                        />{" "}
                        Nguồn: {item.source}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "Lịch sự kiện":
        return (
          <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg animate-fade-in font-inter text-xs max-w-[800px] mx-auto">
            <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-6 pb-2 border-b border-[#222b3e]">
              Lịch Sự Kiện Doanh Nghiệp
            </h4>
            <div className="relative pl-8 border-l-2 border-[#232d42] flex flex-col gap-6 py-2">
              {comp.events.map((evt, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[38px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#00c58e] border-[3px] border-[#080b11] shadow-lg flex items-center justify-center text-[7px]" />
                  <div className="bg-[#141a27] p-4 rounded-xl border border-[#232d42]/30 flex justify-between items-center gap-4 hover:border-[#31405b]/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white text-[12px]">
                        {evt.title}
                      </span>
                      <span className="text-[10px] text-text-muted font-bold flex items-center gap-1.5">
                        <Calendar size={12} className="text-text-muted" /> Dự
                        kiến diễn ra ngày: {evt.date}
                      </span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-right shrink-0">
                      <span className="text-[8px] text-text-muted font-bold block uppercase scale-90">
                        Còn lại
                      </span>
                      <span className="font-outfit font-extrabold text-[#00c58e] text-sm">
                        {evt.daysLeft} ngày
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "Thống kê":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in font-inter text-xs">
            <div className="lg:col-span-2 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg h-fit">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Biến Động Giá 52 Tuần
              </h4>
              <div className="flex flex-col gap-3.5 font-mono text-[11px]">
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Thấp nhất 52 tuần
                  </span>
                  <span className="font-bold text-down">
                    {comp.stats.yearlyRange.low.toLocaleString()} đ
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#182030]/60">
                  <span className="text-text-muted font-sans font-medium">
                    Cao nhất 52 tuần
                  </span>
                  <span className="font-bold text-up">
                    {comp.stats.yearlyRange.high.toLocaleString()} đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted font-sans font-medium">
                    KL Khớp TB/Phiên
                  </span>
                  <span className="font-bold text-white">
                    {comp.stats.yearlyRange.avgVolume.toLocaleString()} CP
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Giao Dịch Khối Ngoại (10 Phiên Gần Nhất)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Phiên GD
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        KL Mua
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        KL Bán
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">
                        Giá trị ròng
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.stats.foreignTrading.map((trade, i) => {
                      const valueColor =
                        trade.netValue >= 0 ? "text-up" : "text-down";
                      const absValueTỷ = Math.abs(trade.netValue) / 1000000000;

                      return (
                        <tr
                          key={i}
                          className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors"
                        >
                          <td className="text-white font-sans font-bold">
                            {trade.date}
                          </td>
                          <td className="text-right text-text-secondary">
                            {trade.buyVol.toLocaleString()}
                          </td>
                          <td className="text-right text-text-secondary">
                            {trade.sellVol.toLocaleString()}
                          </td>
                          <td
                            className={`text-right font-bold pr-2 ${valueColor}`}
                          >
                            {trade.netValue >= 0 ? "+" : "-"}
                            {absValueTỷ.toFixed(2)} Tỷđ
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
      case "Tài chính":
        return (
          <div className="grid grid-cols-1 gap-6 animate-fade-in font-inter text-xs max-w-[1200px] mx-auto">
            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Kết Quả Kinh Doanh Theo Quý (VND)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Kỳ Báo Cáo
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Doanh Thu Thuần
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Lợi Nhuận Gộp
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">
                        Lợi Nhuận Sau Thuế
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.financials.quarters.map((q, i) => (
                      <tr
                        key={i}
                        className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors"
                      >
                        <td className="text-white font-sans font-bold">
                          {q.quarter}
                        </td>
                        <td className="text-right text-text-secondary">
                          {(q.revenue / 1000000000).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          Tỷ
                        </td>
                        <td className="text-right text-text-secondary">
                          {(q.grossProfit / 1000000000).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          Tỷ
                        </td>
                        <td className="text-right font-bold text-[#00c58e] pr-2">
                          {(q.netProfit / 1000000000).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          Tỷ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#0d111b] border border-[#1b2233] rounded-xl p-5 shadow-lg">
              <h4 className="font-outfit text-sm font-extrabold text-[#00c58e] uppercase tracking-wider mb-4 pb-2 border-b border-[#222b3e]">
                Hiệu Quả Vận Hành & Tài Chính Theo Năm (VND)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse font-mono">
                  <thead>
                    <tr className="text-text-muted border-b border-[#1b2233] h-8 font-sans">
                      <th className="font-bold text-[9px] uppercase pb-2">
                        Năm Tài Chính
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Tổng Doanh Thu
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Lợi Nhuận Ròng
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2">
                        Hệ Số ROE (%)
                      </th>
                      <th className="font-bold text-[9px] uppercase text-right pb-2 pr-2">
                        Hệ Số ROA (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.financials.years.map((y, i) => (
                      <tr
                        key={i}
                        className="h-10 border-b border-[#1b2233]/40 hover:bg-white/2 transition-colors"
                      >
                        <td className="text-white font-sans font-bold">
                          {y.year}
                        </td>
                        <td className="text-right text-text-secondary">
                          {(y.revenue / 1000000000).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          Tỷ
                        </td>
                        <td className="text-right text-[#00c58e] font-bold">
                          {(y.netProfit / 1000000000).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 1 },
                          )}{" "}
                          Tỷ
                        </td>
                        <td className="text-right text-white font-bold">
                          {y.roe.toFixed(2)}%
                        </td>
                        <td className="text-right text-[#00cfff] font-bold pr-2">
                          {y.roa.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-8 text-text-muted italic">
            Không tìm thấy thông tin phù hợp.
          </div>
        );
    }
  };

  if (!isOpen) return null;

  const currentPrice = latestQuote ? Number(latestQuote.price) : tc;
  const currentChange = latestQuote ? Number(latestQuote.change) : 0;
  const currentPct = latestQuote ? Number(latestQuote.changePercent) : 0;
  const priceColor =
    currentPrice > tc
      ? "text-up"
      : currentPrice < tc
        ? "text-down"
        : "text-ref";
  const totalTradesVolume =
    trades.reduce((acc, t) => acc + t.volume, 0) || 45300;
  const buyTradesPercent = 55;

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 select-none animate-fade-in font-inter">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[92vw] max-w-[1450px] h-[85vh] bg-[#080b11] border border-[#1b2233] rounded-xl shadow-2xl flex flex-col overflow-hidden text-text-primary z-10 animate-scale-up">
        {/* ─── 1. TOP HEADER BAR ─── */}
        <header className="flex justify-between items-center py-2 px-4 border-b border-[#181e2b] bg-[#0d1017] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#171d2a] p-1.5 px-3 rounded border border-[#2d3748]/40">
              <span className="font-extrabold text-[#00c58e] text-base tracking-tight">
                {symbol.toUpperCase()}
              </span>
              <span className="text-[10px] text-text-muted font-bold bg-[#0d1017] px-1 rounded uppercase">
                HOSE
              </span>
            </div>

            <div className="hidden md:block">
              <p className="text-xs text-text-secondary font-semibold m-0 leading-tight">
                {getCompanyName(symbol)}
              </p>
            </div>

            {/* Live Quotes Price specs */}
            <div className="flex items-center gap-4 ml-6 pl-6 border-l border-[#1a2233]">
              <div className="flex items-baseline gap-1.5 font-mono">
                <span
                  className={`font-outfit ${priceColor} text-2xl font-extrabold tracking-tight`}
                >
                  {formatCurrency(currentPrice)}
                </span>
                <span className={`text-[10.5px] font-bold ${priceColor}`}>
                  {currentChange >= 0 ? "+" : ""}
                  {formatCurrency(currentChange)} (
                  {currentChange >= 0 ? "+" : ""}
                  {(currentPct * 100).toFixed(2)}%)
                </span>
              </div>

              <div className="hidden lg:flex gap-3 text-[10px] text-text-muted font-bold font-mono">
                <span>
                  Mở cửa:{" "}
                  <span className="text-white">{formatCurrency(tc - 50)}</span>
                </span>
                <span>
                  Cao nhất:{" "}
                  <span className="text-up">
                    {formatCurrency(currentPrice + 100)}
                  </span>
                </span>
                <span>
                  Thấp nhất:{" "}
                  <span className="text-down">
                    {formatCurrency(currentPrice - 100)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-[10px] font-bold font-mono">
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90 font-sans">
                  TRẦN
                </span>
                <span className="text-ceil">{formatCurrency(tran)}</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90 font-sans">
                  SÀN
                </span>
                <span className="text-floor">{formatCurrency(san)}</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded border border-[#2a303d] bg-white/2">
                <span className="text-text-muted block text-[8px] scale-90 font-sans">
                  THAM CHIẾU
                </span>
                <span className="text-ref">{formatCurrency(tc)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-[#1a2233] pl-4">
              <button
                className="bg-[#141923] border border-[#2d3748] hover:border-[#4a5568] text-white text-xs px-3.5 py-1.5 rounded font-bold cursor-pointer transition-all shrink-0 flex items-center"
                onClick={handleTriggerAi}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-warning" />
                    Đang quét...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 text-warning" />
                    Phân tích với AI
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer p-1.5 ml-1 transition-colors flex items-center shrink-0 outline-none"
                title="Đóng chi tiết"
              >
                <X size={22} />
              </button>
            </div>
          </div>
        </header>

        {/* ─── 2. TABS STRIP ─── */}
        <nav className="flex gap-1.5 px-4 bg-[#080b11] border-b border-[#181e2b] overflow-x-auto shrink-0 scrollbar-none">
          {(
            [
              "Giao dịch",
              "Hồ sơ",
              "Cổ đông",
              "Vốn và cổ tức",
              "Tin tức",
              "Lịch sự kiện",
              "Thống kê",
              "Tài chính",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 border-0 border-b-2 font-outfit font-extrabold text-[11.5px] uppercase tracking-wider cursor-pointer bg-transparent transition-all duration-150 whitespace-nowrap ${
                activeTab === tab
                  ? "border-[#00c58e] text-[#00c58e] bg-[#00c58e]/3"
                  : "border-transparent text-text-muted hover:text-white hover:bg-white/2"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* ─── 3. MAIN WORKSPACE ─── */}
        <div className="flex-grow flex w-full overflow-hidden">
          {activeTab === "Giao dịch" ? (
            <>
              {/* COLUMN 1: CHART & TOOLS (58% width) */}
              <section className="w-[58%] h-full flex border-r border-[#151a24] bg-[#06070a] overflow-hidden shrink-0">
                {/* Sidebar Toolbar drawings */}
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

                <div className="flex-grow h-full flex flex-col overflow-hidden">
                  {/* TradingView Top Toolbar Strip */}
                  <div className="flex justify-between items-center bg-[#1c2030] h-9 border-b border-[#2d313e] px-2 select-none text-xs font-semibold text-[#c5cbdb] relative shrink-0">
                    <div className="flex items-center gap-1.5 h-full">
                      {/* Search box symbol switcher */}
                      <div className="relative flex items-center h-full">
                        <div className="relative flex items-center bg-[#2a2e3f] hover:bg-[#32364c] border border-transparent focus-within:border-[#2962ff] rounded px-1.5 py-0.5 h-6 text-xs transition-all w-24">
                          <Search
                            size={10}
                            className="text-[#848e9c] mr-1 shrink-0"
                          />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder={currentSymbol}
                            className="bg-transparent border-none outline-none text-white font-extrabold text-[11px] placeholder:text-white w-full uppercase"
                            onFocus={() => setShowSearchDropdown(true)}
                            onBlur={() =>
                              setTimeout(
                                () => setShowSearchDropdown(false),
                                200,
                              )
                            }
                          />
                        </div>

                        {/* Search dropdown autocomplete */}
                        {showSearchDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 mt-1.5 w-60 max-h-56 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl overflow-y-auto z-[200] p-1 scrollbar-none animate-scale-up">
                            {searchResults.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => handleSelectSymbol(item.symbol)}
                                className="flex justify-between items-center px-2.5 py-1.5 hover:bg-[#2a2e3f] rounded cursor-pointer transition-colors"
                              >
                                <div>
                                  <span className="font-extrabold text-[#00c58e] text-[11.5px] mr-2">
                                    {item.symbol}
                                  </span>
                                  <span className="text-[10px] text-text-secondary truncate max-w-[120px] inline-block">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[9px] text-[#848e9c] bg-[#141823] px-1 rounded uppercase font-bold">
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
                          <Plus size={13} />
                        </button>
                        {isCompareOpen && (
                          <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-2 z-[200] flex flex-col gap-1.5">
                            <span className="text-[9px] text-[#848e9c] font-extrabold uppercase">
                              So sánh với mã
                            </span>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={compareInput}
                                onChange={(e) => {
                                  setCompareInput(e.target.value);
                                }}
                                placeholder="Ví dụ: VCB, HPG"
                                className="bg-[#2a2e3f] border border-[#3c4155] rounded px-1.5 py-0.5 text-white text-[10.5px] font-bold w-full outline-none focus:border-[#2962ff] uppercase"
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
                                className="bg-[#2962ff] hover:bg-[#1e4fe2] text-white text-[10px] font-bold px-1.5 rounded cursor-pointer border-none transition-colors"
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
                                className="text-[9.5px] text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer text-left font-bold"
                              >
                                Xóa so sánh hiện tại ({compareSymbol})
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
                          className="h-6 px-1.5 flex items-center gap-0.5 rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent font-bold text-[11px] text-[#c5cbdb]"
                        >
                          <span>{timeframe}</span>
                          <ChevronDown size={8} className="text-[#848e9c]" />
                        </button>
                        {isTimeframeOpen && (
                          <div className="absolute top-full left-0 mt-1.5 w-24 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-0.5 z-[200] flex flex-col gap-0.5">
                            {(["1m", "5m", "15m", "1D", "1W"] as const).map(
                              (tf) => (
                                <button
                                  key={tf}
                                  onClick={() => {
                                    setTimeframe(tf);
                                    setIsTimeframeOpen(false);
                                  }}
                                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-bold cursor-pointer border-none bg-transparent transition-colors ${timeframe === tf ? "text-[#00c58e] bg-[#00c58e]/10" : "text-[#c5cbdb] hover:bg-[#2a2e3f] hover:text-white"}`}
                                >
                                  {tf === "1D"
                                    ? "1 Ngày"
                                    : tf === "1W"
                                      ? "1 Tuần"
                                      : `${tf.replace("m", "")} Phút`}
                                </button>
                              ),
                            )}
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
                          className="h-6 px-1.5 flex items-center gap-1 rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent font-bold text-[11px] text-[#c5cbdb]"
                          title="Loại biểu đồ"
                        >
                          {renderChartTypeIcon(chartType)}
                          <ChevronDown size={8} className="text-[#848e9c]" />
                        </button>
                        {isChartTypeOpen && (
                          <div className="absolute top-full left-0 mt-1.5 w-52 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-1 z-[200] flex flex-col gap-0.5 max-h-72 overflow-y-auto scrollbar-none">
                            {chartTypesList.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setChartType(item.id);
                                  setIsChartTypeOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-[10.5px] font-bold cursor-pointer border-none bg-transparent transition-colors ${chartType === item.id ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#c5cbdb] hover:bg-[#2a2e3f] hover:text-white"}`}
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

                      <div className="w-[1px] h-3 bg-[#2b2e3a] mx-0.5" />

                      {drawStatus && (
                        <span className="text-[10px] text-purple-400 font-extrabold animate-pulse ml-2">
                          {drawStatus}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 h-full">
                      {/* Guest name */}
                      <span className="text-[10px] text-[#848e9c] font-semibold mr-1">
                        Guest_79036
                      </span>

                      {/* Cloud Save Icon */}
                      <button
                        onClick={() => {
                          setToastMessage("Đã lưu bố cục biểu đồ thành công!");
                          setTimeout(() => setToastMessage(""), 3000);
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                        title="Lưu bố cục biểu đồ"
                      >
                        <Cloud size={13} />
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
                          <Settings size={13} />
                        </button>
                        {isSettingsOpen && (
                          <div className="absolute top-full right-0 mt-1.5 w-40 bg-[#1e222d] border border-[#2d313e] rounded shadow-2xl p-2 z-[200] flex flex-col gap-2">
                            <span className="text-[9px] text-[#848e9c] font-extrabold uppercase pb-1 border-b border-[#2d313e]">
                              Chỉ báo kỹ thuật
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer select-none text-[10.5px] font-bold text-[#c5cbdb]">
                              <input
                                type="checkbox"
                                checked={showSMA}
                                onChange={(e) => setShowSMA(e.target.checked)}
                                className="rounded border-[#3c4155] accent-[#ffb300]"
                              />
                              <span className="text-[#ffb300]">SMA (20)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none text-[10.5px] font-bold text-[#c5cbdb]">
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
                            el.requestFullscreen().catch((err) =>
                              console.error(err),
                            );
                          } else {
                            document.exitFullscreen();
                          }
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                        title="Chế độ toàn màn hình"
                      >
                        <Maximize2 size={13} />
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
                            setToastMessage("Đã tải xuống ảnh biểu đồ!");
                            setTimeout(() => setToastMessage(""), 3000);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#2a2e3f] hover:text-white transition-colors cursor-pointer border-none bg-transparent text-[#848e9c]"
                        title="Chụp ảnh biểu đồ"
                      >
                        <Camera size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Chart canvas with Bottom Bar */}
                  <div className="flex-grow h-full flex flex-col overflow-hidden relative">
                    <div
                      ref={chartContainerRef}
                      className="flex-grow w-full h-full relative bg-[#06070a]"
                    />
                    {toastMessage && (
                      <div className="absolute bottom-4 right-4 bg-emerald-500 text-slate-950 font-extrabold text-[10px] px-3 py-1.5 rounded shadow-2xl z-[210] flex items-center gap-1.5 select-none">
                        <Check size={11} className="stroke-[3px]" />
                        {toastMessage}
                      </div>
                    )}

                    {/* Bottom Status Bar */}
                    <div className="h-7 border-t border-[#131822] bg-[#080b11] px-3 flex justify-between items-center text-[10px] text-[#7b8a9b] font-mono shrink-0 select-none">
                      <div className="flex items-center gap-2.5">
                        {(
                          [
                            "1d",
                            "5d",
                            "1m",
                            "3m",
                            "6m",
                            "1y",
                            "5y",
                            "All",
                          ] as const
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
              </section>

              {/* COLUMN 2: CUMULATIVE MARKET DEPTH (21% width) */}
              <section className="w-[21%] h-full flex flex-col border-r border-[#151a24] bg-[#080b11] overflow-hidden shrink-0">
                <div className="p-3 border-b border-[#151a24] shrink-0">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Độ sâu sổ lệnh
                  </span>
                </div>

                <div className="flex-grow overflow-y-auto">
                  <CumulativeOrderBook bids={bids} asks={asks} tc={tc} />
                </div>
              </section>

              {/* COLUMN 3: REAL-TIME TRANSACTION LOGS (21% width) */}
              <section className="w-[21%] h-full flex flex-col bg-[#080b11] overflow-hidden shrink-0">
                <div className="p-3 border-b border-[#151a24] flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Khớp lệnh
                  </span>
                  <div className="flex gap-2 text-[9px] font-bold text-[#7b8a9b] font-mono">
                    <span>
                      KL:{" "}
                      <span className="text-white">
                        {formatCurrency(totalTradesVolume)}
                      </span>
                    </span>
                    <span className="text-up">M: {buyTradesPercent}%</span>
                    <span className="text-down">
                      B: {100 - buyTradesPercent}%
                    </span>
                  </div>
                </div>

                {/* Trades history dynamic stream */}
                <div className="flex-grow overflow-y-auto">
                  <table className="w-full text-[10.5px] border-collapse font-mono">
                    <thead>
                      <tr className="sticky top-0 bg-[#0d1017] text-text-muted border-b border-[#151a24] h-7 z-10 font-bold font-sans text-[9px]">
                        <th className="text-left pl-3 font-semibold uppercase">
                          Thời gian
                        </th>
                        <th className="text-right font-semibold uppercase">
                          Giá
                        </th>
                        <th className="text-right font-semibold uppercase">
                          +/-
                        </th>
                        <th className="text-right pr-3 font-semibold uppercase">
                          KL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center p-8 text-text-muted font-bold text-xs italic"
                          >
                            Không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        trades.map((t, idx) => {
                          const diff = Number(t.price) - tc;
                          return (
                            <tr
                              key={idx}
                              className="h-6 border-b border-[#151a24]/30 hover:bg-white/2 transition-colors relative"
                            >
                              <td className="pl-3 text-text-muted font-sans font-medium">
                                {t.time}
                              </td>

                              <td
                                className={`${t.price > tc ? "text-up" : t.price < tc ? "text-down" : "text-ref"} font-extrabold text-right`}
                              >
                                {formatCurrency(t.price)}
                              </td>

                              <td
                                className={`${diff >= 0 ? "text-up" : "text-down"} text-right font-semibold text-[9px]`}
                              >
                                {diff >= 0 ? "+" : ""}
                                {formatCurrency(diff)}
                              </td>

                              <td
                                className={`text-right pr-3 font-semibold ${t.type === "BUY" ? "text-up" : "text-down"}`}
                              >
                                {formatCurrency(t.volume)}
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
};
