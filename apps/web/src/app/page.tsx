"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Search, ChevronRight, Loader2, Menu, X } from "lucide-react";
import Link from "next/link";
import { io } from "socket.io-client";
import { getApiUrl } from "@/lib/env";

// Centralized Axios API Helpers
import { marketApi } from "@/lib/api/market.api";
import { watchlistApi } from "@/lib/api/watchlist.api";
import { alertApi } from "@/lib/api/alert.api";
import { personalizationApi } from "@/lib/api/personalization.api";
import { TickerDetailModal } from "@/components/TickerDetailModal";
import { Sidebar } from "@/components/Sidebar";
import { TradingBoard } from "@/components/dashboard/TradingBoard";
import { WatchlistTab } from "@/components/dashboard/WatchlistTab";
import { SignalsTab } from "@/components/dashboard/SignalsTab";
import { AlertsTab } from "@/components/dashboard/AlertsTab";
import { PersonalizationTab } from "@/components/dashboard/PersonalizationTab";
import {
  AlertEvent,
  AlertRule,
  Mover,
  SearchResult,
  Signal,
} from "@/lib/types/global.type";

export default function Dashboard() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useTranslation();

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "watchlist" | "signals" | "alerts" | "personalization"
  >("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Data State
  const [topMovers, setTopMovers] = useState<Mover[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // i18n & User State
  const user = session?.user;
  const token = (session as any)?.accessToken;
  const userTier = (user as any)?.tier || "FREE";

  // Watchlist State
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState("");

  // Alerts State
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState("");
  const [alertType, setAlertType] = useState("PRICE_ABOVE");
  const [alertThreshold, setAlertThreshold] = useState("");

  // All Signals Tab State
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [loadingAllSignals, setLoadingAllSignals] = useState(false);
  const [signalTypeFilter, setSignalTypeFilter] = useState<
    "ALL" | "BUY" | "SELL"
  >("ALL");

  // Personalization MVP States
  const [personalizedFeed, setPersonalizedFeed] = useState<any[]>([]);
  const [portfolioIntel, setPortfolioIntel] = useState<any>(null);
  const [loadingPersonalization, setLoadingPersonalization] = useState(false);
  const [personalizationError, setPersonalizationError] = useState("");

  // Manual trigger states for AI analysis animation
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // iBoard Details Modal States
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flashingSymbols, setFlashingSymbols] = useState<
    Record<string, "up" | "down">
  >({});

  // SSI iBoard Enhanced States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [boardMarketTab, setBoardMarketTab] = useState<
    "VN30" | "HOSE" | "HNX" | "UPCOM" | "WATCHLIST"
  >("VN30");
  const [boardQuotes, setBoardQuotes] = useState<Record<string, Mover>>({});
  const [indices, setIndices] = useState({
    vnIndex: {
      val: 1250.32,
      change: 15.22,
      pct: 0.0123,
      vol: "642.5M",
      valTraded: "15,230 tỷ",
    },
    vn30: {
      val: 1265.45,
      change: 18.4,
      pct: 0.0147,
      vol: "185.3M",
      valTraded: "6,850 tỷ",
    },
    hnxIndex: {
      val: 235.15,
      change: -0.45,
      pct: -0.0019,
      vol: "85.2M",
      valTraded: "1,420 tỷ",
    },
    upcomIndex: {
      val: 92.4,
      change: 0.12,
      pct: 0.0013,
      vol: "45.8M",
      valTraded: "650 tỷ",
    },
  });

  const handleAIScan = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisStep(1);

    // Simulate multi-step senior AI scan workflow
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAnalysisStep(2);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAnalysisStep(3);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setAnalysisStep(4);
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const feedRes = await personalizationApi.getFeed();
      if (feedRes.success) {
        setPersonalizedFeed(feedRes.data || []);
      }
      const intelRes =
        await personalizationApi.getPortfolioIntelligence("default");
      if (intelRes.success) {
        setPortfolioIntel(intelRes.data);
      }

      // Track AI trigger behavior
      await personalizationApi.trackActivity(
        "INTERACT_AI",
        undefined,
        undefined,
        { type: "MANUAL_AI_SCAN" },
      );
    } catch (err) {
      console.error("Lỗi quét AI:", err);
    } finally {
      setAnalysisStep(5);
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisStep(0);
      }, 1000);
    }
  };

  const handleSelectRecommended = async (symbol: string) => {
    try {
      await personalizationApi.trackActivity("INTERACT_AI", symbol);
    } catch (e) {
      console.error("Lỗi lưu tương tác AI:", e);
    }
  };

  // Sync Sidebar Collapsed Mode automatically on Dashboard
  useEffect(() => {
    if (activeTab === "dashboard") {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  }, [activeTab]);

  // Indices fluctuation simulation
  useEffect(() => {
    if (activeTab !== "dashboard") return;
    const idxInterval = setInterval(() => {
      setIndices((prev) => {
        const fluctuate = (item: any) => {
          const delta = (Math.random() - 0.5) * 1.5;
          const newVal = Math.max(10, Number((item.val + delta).toFixed(2)));
          const newChange = Number((item.change + delta).toFixed(2));
          const newPct = newChange / (newVal - newChange);
          return {
            ...item,
            val: newVal,
            change: newChange,
            pct: newPct,
          };
        };
        return {
          vnIndex: fluctuate(prev.vnIndex),
          vn30: fluctuate(prev.vn30),
          hnxIndex: fluctuate(prev.hnxIndex),
          upcomIndex: fluctuate(prev.upcomIndex),
        };
      });
    }, 4000);
    return () => clearInterval(idxInterval);
  }, [activeTab]);

  // Fetch Personalization Data (Recommended Feed & Portfolio HHI Intelligence)
  useEffect(() => {
    if (activeTab !== "personalization") return;

    const fetchPersonalization = async () => {
      setLoadingPersonalization(true);
      setPersonalizationError("");
      try {
        const feedRes = await personalizationApi.getFeed();
        if (feedRes.success) {
          setPersonalizedFeed(feedRes.data || []);
        }

        const intelRes =
          await personalizationApi.getPortfolioIntelligence("default");
        if (intelRes.success) {
          setPortfolioIntel(intelRes.data);
        }
      } catch (err: any) {
        console.error("Personalization fetch error:", err);
        setPersonalizationError(
          "Không thể nạp thông tin phân tích cá nhân hóa.",
        );
      } finally {
        setLoadingPersonalization(false);
      }
    };

    fetchPersonalization();
  }, [activeTab]);

  const autocompleteRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Market Overview
  const loadOverview = async () => {
    try {
      setErrorMsg("");
      const resData = await marketApi.getOverview();

      if (resData.success && resData.data) {
        // Deduplicate topMovers by symbol
        const movers: Mover[] = resData.data.topMovers || [];
        const uniqueMovers: Mover[] = [];
        const seenSymbols = new Set<string>();
        for (const m of movers) {
          if (!seenSymbols.has(m.symbol)) {
            seenSymbols.add(m.symbol);
            uniqueMovers.push(m);
          }
        }
        setTopMovers(uniqueMovers.slice(0, 4));

        // Seed Board Quotes from topMovers and common Vietnamese symbols
        const initialQuotes: Record<string, Mover> = {};

        // Seed HOSE/VN30 baseline
        movers.forEach((m) => {
          initialQuotes[m.symbol] = m;
        });

        // Seed HNX baseline
        const hnxTickers = [
          { s: "SHS", n: "Sài Gòn - Hà Nội Securities", p: 18500 },
          { s: "PVS", n: "Dầu khí PVS", p: 38000 },
          { s: "IDC", n: "IDICO", p: 55000 },
          { s: "CEO", n: "CEO Group", p: 16000 },
        ];
        hnxTickers.forEach((t) => {
          if (!initialQuotes[t.s]) {
            initialQuotes[t.s] = {
              symbol: t.s,
              name: t.n,
              price: t.p,
              change: 100,
              changePercent: 0.0054,
              latestSignal: null,
            };
          }
        });

        // Seed UPCOM baseline
        const upcomTickers = [
          { s: "ACV", n: "Cảng hàng không", p: 110000 },
          { s: "BSR", n: "Lọc hóa dầu Bình Sơn", p: 22000 },
          { s: "VEA", n: "Máy động lực", p: 45000 },
          { s: "VGI", n: "Viettel Global", p: 78000 },
        ];
        upcomTickers.forEach((t) => {
          if (!initialQuotes[t.s]) {
            initialQuotes[t.s] = {
              symbol: t.s,
              name: t.n,
              price: t.p,
              change: -200,
              changePercent: -0.0025,
              latestSignal: null,
            };
          }
        });

        setBoardQuotes(initialQuotes);

        // Deduplicate recentSignals by ID
        const signals: Signal[] = resData.data.recentSignals || [];
        const uniqueSignals: Signal[] = [];
        const seenSignals = new Set<string>();
        for (const s of signals) {
          if (!seenSignals.has(s.id)) {
            seenSignals.add(s.id);
            uniqueSignals.push(s);
          }
        }
        setRecentSignals(uniqueSignals);
      } else {
        setErrorMsg("Failed to load market overview.");
      }
    } catch (err: any) {
      console.error("Error fetching overview:", err);
      setErrorMsg(
        "Cannot connect to backend server. Make sure API is running on localhost:3001.",
      );
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 30000); // Qualitative signals/news polled every 30s instead of 10s to optimize bandwidth
    return () => clearInterval(interval);
  }, []);

  // 1.5 Real-time dynamic WebSocket price stream updates
  useEffect(() => {
    const rawApiUrl = getApiUrl();
    const socketUrl = rawApiUrl.replace(/\/api\/v1\/?$/, "");
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("🔌 Dashboard connected to real-time WebSockets");
    });

    socket.on("global_market_tick", (tick) => {
      // Trigger real-time flashing highlights
      const isUp = tick.changePercent >= 0;
      setFlashingSymbols((prev) => ({
        ...prev,
        [tick.symbol]: isUp ? "up" : "down",
      }));
      setTimeout(() => {
        setFlashingSymbols((prev) => {
          const copy = { ...prev };
          delete copy[tick.symbol];
          return copy;
        });
      }, 500);

      // Update Board Quotes
      setBoardQuotes((prev) => {
        const existing = prev[tick.symbol] || {
          symbol: tick.symbol,
          name: tick.symbol,
          price: tick.price,
          change: tick.change,
          changePercent: tick.changePercent,
          latestSignal: null,
        };
        return {
          ...prev,
          [tick.symbol]: {
            ...existing,
            price: tick.price,
            change: tick.change,
            changePercent: tick.changePercent,
          },
        };
      });

      // Update Top Movers card values instantly on the dashboard
      setTopMovers((prevMovers) => {
        return prevMovers.map((mover) => {
          if (mover.symbol === tick.symbol) {
            return {
              ...mover,
              price: tick.price,
              change: tick.change,
              changePercent: tick.changePercent,
            };
          }
          return mover;
        });
      });

      // Update Watchlist items if they correspond to the ticking stock
      setWatchlistItems((prevItems) => {
        return prevItems.map((item) => {
          if (item.instrument && item.instrument.symbol === tick.symbol) {
            return {
              ...item,
              instrument: {
                ...item.instrument,
                price: tick.price,
                change: tick.change,
                changePercent: tick.changePercent,
              },
            };
          }
          return item;
        });
      });
    });

    return () => {
      console.log("🔌 Disconnecting dashboard WebSocket");
      socket.disconnect();
    };
  }, []);

  // 2. Fetch Watchlist
  useEffect(() => {
    if (activeTab !== "watchlist") return;

    const fetchWatchlist = async () => {
      setLoadingWatchlist(true);
      if (session && token) {
        try {
          const result = await watchlistApi.getItems();
          if (result.success && result.data) {
            // Deduplicate watchlist items by symbol
            const items = result.data.items || [];
            const uniqueItems: any[] = [];
            const seen = new Set<string>();
            for (const item of items) {
              const sym = item.instrument.symbol;
              if (!seen.has(sym)) {
                seen.add(sym);
                uniqueItems.push(item);
              }
            }
            setWatchlistItems(uniqueItems);
          }
        } catch (err) {
          console.error("Watchlist fetch error:", err);
        }
      } else {
        // Guest flow: pull from Local Storage using apiClient detail getter
        try {
          const localList: string[] = JSON.parse(
            localStorage.getItem("stock_intel_guest_watchlist") || "[]",
          );
          const uniqueSymbols = Array.from(new Set(localList)); // deduplicate guest watchlist symbols

          if (uniqueSymbols.length > 0) {
            const quotesPromises = uniqueSymbols.map(async (sym: string) => {
              try {
                const quoteData = await marketApi.getDetail(sym);
                if (quoteData.success && quoteData.data) {
                  const q = quoteData.data.latestQuote;
                  return {
                    id: sym,
                    instrument: {
                      symbol: sym,
                      name: quoteData.data.instrument.name,
                      price: q ? Number(q.price) : 0,
                      change: q ? Number(q.change) : 0,
                      changePercent: q ? Number(q.changePercent) : 0,
                      latestSignal: quoteData.data.signals[0] || null,
                    },
                  };
                }
              } catch (e) {
                console.error(e);
              }
              return {
                id: sym,
                instrument: {
                  symbol: sym,
                  name: sym,
                  price: 0,
                  change: 0,
                  changePercent: 0,
                  latestSignal: null,
                },
              };
            });
            const results = await Promise.all(quotesPromises);
            setWatchlistItems(results);
          } else {
            setWatchlistItems([]);
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoadingWatchlist(false);
    };

    fetchWatchlist();
  }, [activeTab, session, token]);

  // 3. Fetch Alerts
  useEffect(() => {
    if (activeTab !== "alerts" || !session || !token) return;

    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const result = await alertApi.getAlerts();
        if (result.success && result.data) {
          setAlertRules(result.data.rules || []);
          setAlertEvents(result.data.events || []);
        }
      } catch (err) {
        console.error("Alerts fetch error:", err);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
  }, [activeTab, session, token]);

  // 4. Fetch All AI signals
  useEffect(() => {
    if (activeTab !== "signals") return;

    const fetchAllSignals = async () => {
      setLoadingAllSignals(true);
      try {
        const result = await marketApi.getSignals(signalTypeFilter);
        if (result.success && result.data) {
          setAllSignals(result.data);
        }
      } catch (err) {
        console.error("Signals fetch error:", err);
      } finally {
        setLoadingAllSignals(false);
      }
    };

    fetchAllSignals();
  }, [activeTab, signalTypeFilter]);

  // Search input handler
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim().length === 0) {
      setSearchResults([]);
      setShowAutocomplete(false);
      return;
    }

    setLoadingSearch(true);
    setShowAutocomplete(true);

    try {
      const resData = await marketApi.search(value);
      if (resData.success && resData.data) {
        setSearchResults(resData.data);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectStock = (symbol: string) => {
    setShowAutocomplete(false);
    setSearchQuery("");
  };

  // Add Watchlist Action
  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchlistInput.trim()) return;
    const sym = watchlistInput.toUpperCase().trim();

    if (session && token) {
      try {
        const result = await watchlistApi.addItem(sym);
        if (result.success) {
          setWatchlistInput("");
          setActiveTab("dashboard");
          setTimeout(() => setActiveTab("watchlist"), 50);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      const currentList = JSON.parse(
        localStorage.getItem("stock_intel_guest_watchlist") || "[]",
      );
      if (!currentList.includes(sym)) {
        currentList.push(sym);
        localStorage.setItem(
          "stock_intel_guest_watchlist",
          JSON.stringify(currentList),
        );
      }
      setWatchlistInput("");
      setActiveTab("dashboard");
      setTimeout(() => setActiveTab("watchlist"), 50);
    }
  };

  // Remove Watchlist Action
  const handleRemoveWatchlist = async (symbol: string) => {
    if (session && token) {
      try {
        await watchlistApi.removeItem(symbol);
        setWatchlistItems(
          watchlistItems.filter((item) => item.instrument.symbol !== symbol),
        );
      } catch (err) {
        console.error(err);
      }
    } else {
      const currentList = JSON.parse(
        localStorage.getItem("stock_intel_guest_watchlist") || "[]",
      );
      const filtered = currentList.filter((s: string) => s !== symbol);
      localStorage.setItem(
        "stock_intel_guest_watchlist",
        JSON.stringify(filtered),
      );
      setWatchlistItems(
        watchlistItems.filter((item) => item.instrument.symbol !== symbol),
      );
    }
  };

  // Add Alert Trigger
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertSymbol || !alertThreshold) return;

    try {
      const result = await alertApi.createAlert(
        alertSymbol.toUpperCase().trim(),
        alertType,
        parseFloat(alertThreshold),
      );
      if (result.success) {
        setAlertSymbol("");
        setAlertThreshold("");
        setActiveTab("dashboard");
        setTimeout(() => setActiveTab("alerts"), 50);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Alert Configuration
  const handleDeleteAlert = async (ruleId: string) => {
    try {
      await alertApi.deleteAlert(ruleId);
      setAlertRules(alertRules.filter((r) => r.id !== ruleId));
    } catch (err) {
      console.error(err);
    }
  };

  // Add Watchlist Quick Action directly from Symbol
  const handleAddWatchlistFromSymbol = async (sym: string) => {
    if (session && token) {
      try {
        const result = await watchlistApi.addItem(sym);
        if (result.success) {
          // Re-fetch watchlist
          const listRes = await watchlistApi.getItems();
          if (listRes.success && listRes.data) {
            setWatchlistItems(listRes.data.items || []);
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      const currentList = JSON.parse(
        localStorage.getItem("stock_intel_guest_watchlist") || "[]",
      );
      if (!currentList.includes(sym)) {
        currentList.push(sym);
        localStorage.setItem(
          "stock_intel_guest_watchlist",
          JSON.stringify(currentList),
        );
      }
      // Re-hydrate local watchlist
      const quoteData = await marketApi.getDetail(sym);
      if (quoteData.success && quoteData.data) {
        const q = quoteData.data.latestQuote;
        const newItem = {
          id: sym,
          instrument: {
            symbol: sym,
            name: quoteData.data.instrument.name,
            price: q ? Number(q.price) : 0,
            change: q ? Number(q.change) : 0,
            changePercent: q ? Number(q.changePercent) : 0,
            latestSignal: quoteData.data.signals[0] || null,
          },
        };
        setWatchlistItems((prev) => [
          ...prev.filter((item) => item.instrument.symbol !== sym),
          newItem,
        ]);
      }
    }
  };

  // Filter stock lists based on active category
  const getFilteredMoverList = (): Mover[] => {
    let activeSymbols: string[] = [];
    if (boardMarketTab === "VN30") {
      activeSymbols = ["FPT", "HPG", "TCB", "VCB", "VHM", "VIC"];
    } else if (boardMarketTab === "HOSE") {
      activeSymbols = [
        "VCB",
        "BID",
        "CTG",
        "TCB",
        "MBB",
        "VPB",
        "ACB",
        "VHM",
        "VIC",
        "VRE",
        "FPT",
        "HPG",
      ];
    } else if (boardMarketTab === "HNX") {
      activeSymbols = ["SHS", "PVS", "IDC", "CEO"];
    } else if (boardMarketTab === "UPCOM") {
      activeSymbols = ["ACV", "BSR", "VEA", "VGI"];
    } else if (boardMarketTab === "WATCHLIST") {
      return watchlistItems.map((item) => ({
        symbol: item.instrument.symbol,
        name: item.instrument.name,
        price: item.instrument.price,
        change: item.instrument.change,
        changePercent: item.instrument.changePercent,
        latestSignal: item.instrument.latestSignal,
      }));
    }

    return activeSymbols.map((sym) => {
      if (boardQuotes[sym]) {
        return boardQuotes[sym];
      }
      // Fallback baseline
      return {
        symbol: sym,
        name: sym,
        price: 25000,
        change: 0,
        changePercent: 0,
        latestSignal: null,
      };
    });
  };

  // Render SVG Sparkline
  const renderSparkline = (change: number) => {
    const isUp = change >= 0;
    const points = isUp
      ? "0,18 10,14 20,20 30,12 40,8 50,11 60,4 70,2"
      : "0,2 10,8 20,4 30,14 40,11 50,18 60,15 70,22";
    return (
      <svg className="w-10 h-5" viewBox="0 0 70 24">
        <polyline
          fill="none"
          stroke={isUp ? "#00e676" : "#ff1744"}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        user={user}
        userTier={userTier}
      />

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main
        className={`sidebar-transition pr-6 py-6 min-h-screen flex flex-col w-full ${
          isSidebarCollapsed ? "pl-6 md:pl-[100px]" : "pl-6 md:pl-[300px]"
        }`}
      >
        {/* ─── TOP HEADER BAR with SEARCH ─── */}
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-board-border">
          <div className="flex items-center gap-3 flex-grow">
            {/* Hamburger Button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-secondary p-2 md:hidden"
            >
              {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Sidebar toggle button for desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="btn-secondary p-2 hidden md:flex items-center justify-center"
              title="Thu nhỏ/Mở rộng Sidebar"
            >
              <Menu size={16} />
            </button>

            {/* Autocomplete Input Container */}
            <div className="relative w-full max-w-md" ref={autocompleteRef}>
              <div className="glass-panel flex items-center gap-2 bg-surface border border-board-border rounded-lg py-1.5 px-3.5 focus-within:border-accent transition-all duration-200">
                <Search size={16} className="text-text-muted" />
                <input
                  type="text"
                  placeholder={t("common.searchPlaceholder")}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="bg-transparent border-none outline-none text-text-primary text-sm w-full"
                />
                {loadingSearch && (
                  <Loader2 size={14} className="animate-spin text-text-muted" />
                )}
              </div>

              {/* Search Autocomplete Panel */}
              {showAutocomplete && (
                <div className="glass-panel absolute top-full left-0 right-0 mt-2 max-h-[300px] overflow-y-auto p-2 rounded-lg z-50 border border-board-border-active shadow-2xl bg-surface/90 backdrop-blur-md">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-text-muted text-sm">
                      {loadingSearch
                        ? "Searching database..."
                        : "No symbols found"}
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <Link
                        key={item.id}
                        href={`/instruments/${item.symbol}`}
                        className="no-underline"
                        onClick={() => setShowAutocomplete(false)}
                      >
                        <button className="flex items-center justify-between w-full py-2 px-4 rounded-md text-text-primary hover:bg-surface-hover transition-colors text-left">
                          <div>
                            <span className="font-extrabold text-accent mr-2">
                              {item.symbol}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {item.name}
                            </span>
                          </div>
                          <ChevronRight size={14} className="text-text-muted" />
                        </button>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 py-1 px-3 bg-white/2 border border-white/5 rounded text-xs text-text-muted">
            <span className="font-semibold text-text-secondary">
              Trạng thái cổng luồng:
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span className="text-emerald-500 font-bold">CONNECTED</span>
          </div>
        </header>

        {/* ─── SSI iBOARD INDICES TICKER STRIP ─── */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4 border-b border-board-border bg-[#080b11]/30 rounded-lg mb-4">
            {/* Index 1: VN-INDEX */}
            <div className="flex items-center justify-between px-4 border-r border-board-border/60">
              <div>
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  VN-INDEX
                </span>
                <span
                  className={`text-base font-extrabold tracking-tight ${indices.vnIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.vnIndex.val.toLocaleString()}
                </span>
                <span
                  className={`block text-[9px] font-bold ${indices.vnIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.vnIndex.change >= 0 ? "+" : ""}
                  {indices.vnIndex.change.toLocaleString()} (
                  {indices.vnIndex.change >= 0 ? "+" : ""}
                  {(indices.vnIndex.pct * 100).toFixed(2)}%)
                </span>
                <span className="block text-[8px] text-text-muted">
                  KL: {indices.vnIndex.vol} | GT: {indices.vnIndex.valTraded}
                </span>
              </div>
              <div className="shrink-0 pl-2">
                {renderSparkline(indices.vnIndex.change)}
              </div>
            </div>

            {/* Index 2: VN30 */}
            <div className="flex items-center justify-between px-4 border-r border-board-border/60">
              <div>
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  VN30
                </span>
                <span
                  className={`text-base font-extrabold tracking-tight ${indices.vn30.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.vn30.val.toLocaleString()}
                </span>
                <span
                  className={`block text-[9px] font-bold ${indices.vn30.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.vn30.change >= 0 ? "+" : ""}
                  {indices.vn30.change.toLocaleString()} (
                  {indices.vn30.change >= 0 ? "+" : ""}
                  {(indices.vn30.pct * 100).toFixed(2)}%)
                </span>
                <span className="block text-[8px] text-text-muted">
                  KL: {indices.vn30.vol} | GT: {indices.vn30.valTraded}
                </span>
              </div>
              <div className="shrink-0 pl-2">
                {renderSparkline(indices.vn30.change)}
              </div>
            </div>

            {/* Index 3: HNX-INDEX */}
            <div className="flex items-center justify-between px-4 border-r border-board-border/60">
              <div>
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  HNX-INDEX
                </span>
                <span
                  className={`text-base font-extrabold tracking-tight ${indices.hnxIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.hnxIndex.val.toLocaleString()}
                </span>
                <span
                  className={`block text-[9px] font-bold ${indices.hnxIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.hnxIndex.change >= 0 ? "+" : ""}
                  {indices.hnxIndex.change.toLocaleString()} (
                  {indices.hnxIndex.change >= 0 ? "+" : ""}
                  {(indices.hnxIndex.pct * 100).toFixed(2)}%)
                </span>
                <span className="block text-[8px] text-text-muted">
                  KL: {indices.hnxIndex.vol} | GT: {indices.hnxIndex.valTraded}
                </span>
              </div>
              <div className="shrink-0 pl-2">
                {renderSparkline(indices.hnxIndex.change)}
              </div>
            </div>

            {/* Index 4: UPCOM-INDEX */}
            <div className="flex items-center justify-between px-4">
              <div>
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  UPCOM-INDEX
                </span>
                <span
                  className={`text-base font-extrabold tracking-tight ${indices.upcomIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.upcomIndex.val.toLocaleString()}
                </span>
                <span
                  className={`block text-[9px] font-bold ${indices.upcomIndex.change >= 0 ? "text-up" : "text-down"}`}
                >
                  {indices.upcomIndex.change >= 0 ? "+" : ""}
                  {indices.upcomIndex.change.toLocaleString()} (
                  {indices.upcomIndex.change >= 0 ? "+" : ""}
                  {(indices.upcomIndex.pct * 100).toFixed(2)}%)
                </span>
                <span className="block text-[8px] text-text-muted">
                  KL: {indices.upcomIndex.vol} | GT:{" "}
                  {indices.upcomIndex.valTraded}
                </span>
              </div>
              <div className="shrink-0 pl-2">
                {renderSparkline(indices.upcomIndex.change)}
              </div>
            </div>
          </div>
        )}

        {/* ─── DYNAMIC SUBVIEW ─── */}
        <div className="mt-6 flex-1 flex flex-col">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <TradingBoard
              loadingData={loadingData}
              boardMarketTab={boardMarketTab}
              setBoardMarketTab={setBoardMarketTab}
              watchlistItems={watchlistItems}
              getFilteredMoverList={getFilteredMoverList}
              flashingSymbols={flashingSymbols}
              setSelectedSymbol={setSelectedSymbol}
              setIsModalOpen={setIsModalOpen}
              handleRemoveWatchlist={handleRemoveWatchlist}
              handleAddWatchlistFromSymbol={handleAddWatchlistFromSymbol}
              setAlertSymbol={setAlertSymbol}
              setAlertThreshold={setAlertThreshold}
              setActiveTab={setActiveTab}
              errorMsg={errorMsg}
            />
          )}

          {/* TAB 2: WATCHLIST TAB */}
          {activeTab === "watchlist" && (
            <WatchlistTab
              loadingWatchlist={loadingWatchlist}
              watchlistItems={watchlistItems}
              watchlistInput={watchlistInput}
              setWatchlistInput={setWatchlistInput}
              handleAddWatchlist={handleAddWatchlist}
              handleRemoveWatchlist={handleRemoveWatchlist}
              setSelectedSymbol={setSelectedSymbol}
              setIsModalOpen={setIsModalOpen}
            />
          )}

          {/* TAB 3: AI SIGNALS TAB */}
          {activeTab === "signals" && (
            <SignalsTab
              loadingAllSignals={loadingAllSignals}
              allSignals={allSignals}
              signalTypeFilter={signalTypeFilter}
              setSignalTypeFilter={setSignalTypeFilter}
            />
          )}

          {/* TAB 4: ALERTS TAB */}
          {activeTab === "alerts" && (
            <AlertsTab
              session={session}
              alertSymbol={alertSymbol}
              setAlertSymbol={setAlertSymbol}
              alertType={alertType}
              setAlertType={setAlertType}
              alertThreshold={alertThreshold}
              setAlertThreshold={setAlertThreshold}
              handleCreateAlert={handleCreateAlert}
              loadingAlerts={loadingAlerts}
              alertRules={alertRules}
              handleDeleteAlert={handleDeleteAlert}
              alertEvents={alertEvents}
            />
          )}

          {/* TAB 5: PERSONALIZATION & AI ADVISORY */}
          {activeTab === "personalization" && (
            <PersonalizationTab
              portfolioIntel={portfolioIntel}
              personalizedFeed={personalizedFeed}
              isAnalyzing={isAnalyzing}
              loadingPersonalization={loadingPersonalization}
              personalizationError={personalizationError}
              analysisStep={analysisStep}
              handleAIScan={handleAIScan}
              handleSelectRecommended={handleSelectRecommended}
            />
          )}
        </div>
      </main>

      {/* SSI iBoard High-Fidelity Details Workspace Modal */}
      <TickerDetailModal
        symbol={selectedSymbol || ""}
        isOpen={isModalOpen && !!selectedSymbol}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSymbol(null);
        }}
      />
    </div>
  );
}
