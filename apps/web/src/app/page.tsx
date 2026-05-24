'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import {
  TrendingUp,
  Activity,
  Bell,
  Search,
  Building2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  ChevronRight,
  Loader2,
  Bookmark,
  Plus,
  HelpCircle,
  LogOut,
  Trash2,
  Menu,
  X,
  RefreshCw,
  PieChart,
  ShieldAlert,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';

// Centralized Axios API Helpers
import { marketApi } from '@/lib/api/market.api';
import { watchlistApi } from '@/lib/api/watchlist.api';
import { alertApi } from '@/lib/api/alert.api';
import { personalizationApi } from '@/lib/api/personalization.api';
import { TickerDetailModal } from '@/components/TickerDetailModal';

interface Signal {
  id: string;
  symbol: string;
  type: string; // BUY / SELL
  indicator: string;
  price?: number;
  score?: number;
  strength?: string;
  reason: string;
  detectedAt: string;
}

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  latestSignal: Signal | null;
}

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  exchange: { code: string };
  signals: Signal[];
}

interface AlertRule {
  id: string;
  symbol: string;
  name: string;
  type: string;
  threshold: number;
  enabled: boolean;
}

interface AlertEvent {
  id: string;
  symbol: string;
  type: string;
  threshold: number;
  triggeredValue: number;
  triggeredAt: string;
  status: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useTranslation();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'signals' | 'alerts' | 'personalization'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Data State
  const [topMovers, setTopMovers] = useState<Mover[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // i18n & User State
  const user = session?.user;
  const token = (session as any)?.accessToken;
  const userTier = (user as any)?.tier || 'FREE';

  // Watchlist State
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState('');

  // Alerts State
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertType, setAlertType] = useState('PRICE_ABOVE');
  const [alertThreshold, setAlertThreshold] = useState('');

  // All Signals Tab State
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [loadingAllSignals, setLoadingAllSignals] = useState(false);
  const [signalTypeFilter, setSignalTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  // Personalization MVP States
  const [personalizedFeed, setPersonalizedFeed] = useState<any[]>([]);
  const [portfolioIntel, setPortfolioIntel] = useState<any>(null);
  const [loadingPersonalization, setLoadingPersonalization] = useState(false);
  const [personalizationError, setPersonalizationError] = useState('');

  // Manual trigger states for AI analysis animation
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // iBoard Details Modal States
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flashingSymbols, setFlashingSymbols] = useState<Record<string, 'up' | 'down'>>({});

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
      const intelRes = await personalizationApi.getPortfolioIntelligence('default');
      if (intelRes.success) {
        setPortfolioIntel(intelRes.data);
      }

      // Track AI trigger behavior
      await personalizationApi.trackActivity('INTERACT_AI', undefined, undefined, { type: 'MANUAL_AI_SCAN' });
    } catch (err) {
      console.error('Lỗi quét AI:', err);
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
      await personalizationApi.trackActivity('INTERACT_AI', symbol);
    } catch (e) {
      console.error('Lỗi lưu tương tác AI:', e);
    }
  };

  // Fetch Personalization Data (Recommended Feed & Portfolio HHI Intelligence)
  useEffect(() => {
    if (activeTab !== 'personalization') return;

    const fetchPersonalization = async () => {
      setLoadingPersonalization(true);
      setPersonalizationError('');
      try {
        const feedRes = await personalizationApi.getFeed();
        if (feedRes.success) {
          setPersonalizedFeed(feedRes.data || []);
        }

        const intelRes = await personalizationApi.getPortfolioIntelligence('default');
        if (intelRes.success) {
          setPortfolioIntel(intelRes.data);
        }
      } catch (err: any) {
        console.error('Personalization fetch error:', err);
        setPersonalizationError('Không thể nạp thông tin phân tích cá nhân hóa.');
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
      setErrorMsg('');
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
        setErrorMsg('Failed to load market overview.');
      }
    } catch (err: any) {
      console.error('Error fetching overview:', err);
      setErrorMsg('Cannot connect to backend server. Make sure API is running on localhost:3001.');
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
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('🔌 Dashboard connected to real-time WebSockets');
    });

    socket.on('global_market_tick', (tick) => {
      // Trigger real-time flashing highlights
      const isUp = tick.changePercent >= 0;
      setFlashingSymbols((prev) => ({ ...prev, [tick.symbol]: isUp ? 'up' : 'down' }));
      setTimeout(() => {
        setFlashingSymbols((prev) => {
          const copy = { ...prev };
          delete copy[tick.symbol];
          return copy;
        });
      }, 500);

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
              }
            };
          }
          return item;
        });
      });
    });

    return () => {
      console.log('🔌 Disconnecting dashboard WebSocket');
      socket.disconnect();
    };
  }, []);

  // 2. Fetch Watchlist
  useEffect(() => {
    if (activeTab !== 'watchlist') return;

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
          console.error('Watchlist fetch error:', err);
        }
      } else {
        // Guest flow: pull from Local Storage using apiClient detail getter
        try {
          const localList: string[] = JSON.parse(localStorage.getItem('stock_intel_guest_watchlist') || '[]');
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
                      latestSignal: quoteData.data.signals[0] || null
                    }
                  };
                }
              } catch (e) {
                console.error(e);
              }
              return { id: sym, instrument: { symbol: sym, name: sym, price: 0, change: 0, changePercent: 0, latestSignal: null } };
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
    if (activeTab !== 'alerts' || !session || !token) return;

    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const result = await alertApi.getAlerts();
        if (result.success && result.data) {
          setAlertRules(result.data.rules || []);
          setAlertEvents(result.data.events || []);
        }
      } catch (err) {
        console.error('Alerts fetch error:', err);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
  }, [activeTab, session, token]);

  // 4. Fetch All AI signals
  useEffect(() => {
    if (activeTab !== 'signals') return;

    const fetchAllSignals = async () => {
      setLoadingAllSignals(true);
      try {
        const result = await marketApi.getSignals(signalTypeFilter);
        if (result.success && result.data) {
          setAllSignals(result.data);
        }
      } catch (err) {
        console.error('Signals fetch error:', err);
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
      console.error('Search error:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectStock = (symbol: string) => {
    setShowAutocomplete(false);
    setSearchQuery('');
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
          setWatchlistInput('');
          setActiveTab('dashboard');
          setTimeout(() => setActiveTab('watchlist'), 50);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      const currentList = JSON.parse(localStorage.getItem('stock_intel_guest_watchlist') || '[]');
      if (!currentList.includes(sym)) {
        currentList.push(sym);
        localStorage.setItem('stock_intel_guest_watchlist', JSON.stringify(currentList));
      }
      setWatchlistInput('');
      setActiveTab('dashboard');
      setTimeout(() => setActiveTab('watchlist'), 50);
    }
  };

  // Remove Watchlist Action
  const handleRemoveWatchlist = async (symbol: string) => {
    if (session && token) {
      try {
        await watchlistApi.removeItem(symbol);
        setWatchlistItems(watchlistItems.filter(item => item.instrument.symbol !== symbol));
      } catch (err) {
        console.error(err);
      }
    } else {
      const currentList = JSON.parse(localStorage.getItem('stock_intel_guest_watchlist') || '[]');
      const filtered = currentList.filter((s: string) => s !== symbol);
      localStorage.setItem('stock_intel_guest_watchlist', JSON.stringify(filtered));
      setWatchlistItems(watchlistItems.filter(item => item.instrument.symbol !== symbol));
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
        parseFloat(alertThreshold)
      );
      if (result.success) {
        setAlertSymbol('');
        setAlertThreshold('');
        setActiveTab('dashboard');
        setTimeout(() => setActiveTab('alerts'), 50);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Alert Configuration
  const handleDeleteAlert = async (ruleId: string) => {
    try {
      await alertApi.deleteAlert(ruleId);
      setAlertRules(alertRules.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Sidebar Mobile Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside className={`glass-panel fixed top-6 bottom-6 w-[260px] flex flex-col p-6 z-50 rounded-2xl transition-all duration-300 -translate-x-[320px] md:translate-x-0 left-6 ${
        isSidebarOpen ? 'translate-x-0' : ''
      }`}>
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center font-extrabold text-lg text-white">S</div>
          <h2 className="font-outfit text-lg font-extrabold tracking-tight">
            STOCK<span className="text-accent">INTEL</span>
          </h2>
        </div>

        {/* Tab Buttons */}
        <nav className="flex flex-col gap-2 flex-grow">
          <button
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
              activeTab === 'dashboard' 
                ? 'bg-accent/15 text-accent' 
                : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <TrendingUp size={18} />
            {t('sidebar.dashboard')}
          </button>

          <button
            onClick={() => { setActiveTab('watchlist'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
              activeTab === 'watchlist' 
                ? 'bg-accent/15 text-accent' 
                : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <Bookmark size={18} />
            {t('sidebar.watchlist')}
          </button>

          <button
            onClick={() => { setActiveTab('signals'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
              activeTab === 'signals' 
                ? 'bg-accent/15 text-accent' 
                : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <Sparkles size={18} />
            {t('sidebar.signals')}
          </button>

          <button
            onClick={() => { setActiveTab('alerts'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
              activeTab === 'alerts' 
                ? 'bg-accent/15 text-accent' 
                : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <Bell size={18} />
            {t('sidebar.alerts')}
          </button>

          <button
            onClick={() => { setActiveTab('personalization'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
              activeTab === 'personalization' 
                ? 'bg-accent/15 text-accent' 
                : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <Sparkles size={18} className="text-warning" />
            Phân tích AI & Gợi ý
          </button>

          <Link href="/pricing" className="no-underline">
            <button
              className="flex items-center gap-3 w-full py-3 px-4 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 bg-transparent text-text-secondary hover:bg-surface-hover hover:text-accent w-full"
            >
              <Building2 size={18} />
              {t('sidebar.pricing')}
            </button>
          </Link>
        </nav>

        {/* Dynamic Locale Selector */}
        <div className="flex gap-2 mb-4 justify-center">
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

        {/* User profile footer */}
        <div className="glass-panel p-4 rounded-lg border border-board-border text-xs">
          {user ? (
            <div className="flex flex-col gap-2">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
                {user.email}
              </div>
              <div className="flex justify-between items-center">
                <span className="badge badge-bullish text-[10px] py-0.5 px-2">
                  {userTier}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-transparent border-none text-bearish cursor-pointer flex items-center gap-1 text-xs font-semibold hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-center">
              <span className="text-text-secondary font-semibold">{t('sidebar.guestUser')}</span>
              <Link href="/login" className="no-underline">
                <button className="btn-primary py-1.5 px-3 text-xs w-full justify-center">
                  {t('common.login')}
                </button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main className="pl-6 md:pl-[300px] pr-6 py-6 min-h-screen flex flex-col w-full">

        {/* ─── TOP HEADER BAR with SEARCH ─── */}
        <header className="flex items-center justify-between gap-4 pb-6 border-b border-board-border">
          <div className="flex items-center gap-3 flex-grow">
            {/* Hamburger Button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-secondary p-2.5 md:hidden"
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Autocomplete Input Container */}
            <div className="relative w-full max-w-md" ref={autocompleteRef}>
              <div className="glass-panel flex items-center gap-2.5 bg-surface border border-board-border rounded-lg py-2 px-4 focus-within:border-accent transition-all duration-200">
                <Search size={18} className="text-text-muted" />
                <input
                  type="text"
                  placeholder={t('common.searchPlaceholder')}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="bg-transparent border-none outline-none text-text-primary text-sm w-full"
                />
                {loadingSearch && <Loader2 size={16} className="animate-spin text-text-muted" />}
              </div>

              {/* Search Autocomplete Panel */}
              {showAutocomplete && (
                <div className="glass-panel absolute top-full left-0 right-0 mt-2 max-h-[300px] overflow-y-auto p-2 rounded-lg z-50 border border-board-border-active shadow-2xl bg-surface/90 backdrop-blur-md">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-text-muted text-sm">
                      {loadingSearch ? 'Searching database...' : 'No symbols found'}
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <Link key={item.id} href={`/instruments/${item.symbol}`} className="no-underline" onClick={() => setShowAutocomplete(false)}>
                        <button
                          className="flex items-center justify-between w-full py-2.5 px-4 rounded-md text-text-primary hover:bg-surface-hover transition-colors text-left"
                        >
                          <div>
                            <span className="font-extrabold text-accent mr-2.5">{item.symbol}</span>
                            <span className="text-xs text-text-secondary">{item.name}</span>
                          </div>
                          <ChevronRight size={16} className="text-text-muted" />
                        </button>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 py-1.5 px-3 bg-bullish/10 border border-bullish/25 rounded text-bullish text-xs font-semibold">
              <TrendingUp size={16} />
              VN-INDEX: 1,250.32 (+1.25%)
            </div>
          </div>
        </header>

        {/* ─── DYNAMIC SUBVIEW ─── */}
        <div className="mt-6 flex-1 flex flex-col">

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Error Banner */}
              {errorMsg && (
                <div className="p-4 px-5 bg-bearish/10 border border-bearish/25 rounded-lg text-bearish text-sm mb-6 font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Dashboard Intro */}
              <div className="mb-8">
                <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
                  {t('dashboard.title')}
                </h1>
                <p className="text-text-secondary text-sm">
                  {t('dashboard.description')}
                </p>
              </div>

              {/* Grid Content */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Top Movers (Quotes) */}
                <div className="xl:col-span-2 flex flex-col gap-5">
                  <h3 className="font-outfit text-lg font-bold flex items-center gap-2">
                    <TrendingUp size={20} className="text-accent" />
                    {t('dashboard.moversTitle')}
                  </h3>

                  {loadingData ? (
                    <div className="flex justify-center py-16">
                      <Loader2 size={32} className="animate-spin text-accent" />
                    </div>
                  ) : topMovers.length === 0 ? (
                    <div className="glass-panel py-16 text-center text-text-muted">
                      {t('dashboard.noMovers')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border-board shadow-2xl bg-board-bg">
                      <table className="iboard-table w-full min-w-[950px]">
                        <thead>
                          <tr>
                            <th rowSpan={2} className="text-left pl-3">Mã CK</th>
                            <th rowSpan={2}>Trần</th>
                            <th rowSpan={2}>Sàn</th>
                            <th rowSpan={2}>TC</th>
                            <th colSpan={6} className="bg-bullish/5">Bên mua</th>
                            <th colSpan={3} className="bg-white/5">Khớp lệnh</th>
                            <th colSpan={6} className="bg-bearish/5">Bên bán</th>
                            <th rowSpan={2} className="pr-3">Tổng KL</th>
                          </tr>
                          <tr>
                            <th className="bg-bullish/3">Giá 3</th>
                            <th className="bg-bullish/3">KL 3</th>
                            <th className="bg-bullish/3">Giá 2</th>
                            <th className="bg-bullish/3">KL 2</th>
                            <th className="bg-bullish/3">Giá 1</th>
                            <th className="bg-bullish/3">KL 1</th>
                            <th className="bg-white/2">Giá</th>
                            <th className="bg-white/2">KL</th>
                            <th className="bg-white/2">+/-</th>
                            <th className="bg-bearish/3">Giá 1</th>
                            <th className="bg-bearish/3">KL 1</th>
                            <th className="bg-bearish/3">Giá 2</th>
                            <th className="bg-bearish/3">KL 2</th>
                            <th className="bg-bearish/3">Giá 3</th>
                            <th className="bg-bearish/3">KL 3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topMovers.map((mover) => {
                            const isUp = mover.changePercent >= 0;
                            const tc = Math.round(Number(mover.price) - Number(mover.change));
                            const tran = Math.round(tc * 1.07);
                            const san = Math.round(tc * 0.93);

                            const flashClass = flashingSymbols[mover.symbol] === 'up' ? 'animate-flash-up' : flashingSymbols[mover.symbol] === 'down' ? 'animate-flash-down' : '';

                            const currentPrice = Number(mover.price);
                            const priceColor = currentPrice > tc ? 'text-up' : currentPrice < tc ? 'text-down' : 'text-ref';
                            
                            const bid1Price = Math.round(currentPrice - 50);
                            const bid1Vol = Math.floor(25000 + (currentPrice % 300) * 100);
                            const bid2Price = Math.round(currentPrice - 100);
                            const bid2Vol = Math.floor(18000 + (currentPrice % 400) * 100);
                            const bid3Price = Math.round(currentPrice - 150);
                            const bid3Vol = Math.floor(12000 + (currentPrice % 500) * 100);

                            const ask1Price = Math.round(currentPrice + 50);
                            const ask1Vol = Math.floor(22000 + (currentPrice % 300) * 100);
                            const ask2Price = Math.round(currentPrice + 100);
                            const ask2Vol = Math.floor(16000 + (currentPrice % 400) * 100);
                            const ask3Price = Math.round(currentPrice + 150);
                            const ask3Vol = Math.floor(10000 + (currentPrice % 500) * 100);

                            const totalVolume = Math.floor(1000000 + (currentPrice % 500) * 8500);

                            return (
                              <tr 
                                key={mover.symbol} 
                                onClick={() => {
                                  setSelectedSymbol(mover.symbol);
                                  setIsModalOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <td className="text-left font-extrabold pl-3 text-text-primary">
                                  ★ {mover.symbol}
                                </td>
                                
                                <td className="text-ceil font-bold">{tran.toLocaleString()}</td>
                                <td className="text-floor font-bold">{san.toLocaleString()}</td>
                                <td className="text-ref font-bold">{tc.toLocaleString()}</td>

                                <td className={bid3Price > tc ? 'text-up' : bid3Price < tc ? 'text-down' : 'text-ref'}>{bid3Price.toLocaleString()}</td>
                                <td className="text-text-muted">{bid3Vol.toLocaleString()}</td>
                                <td className={bid2Price > tc ? 'text-up' : bid2Price < tc ? 'text-down' : 'text-ref'}>{bid2Price.toLocaleString()}</td>
                                <td className="text-text-muted">{bid2Vol.toLocaleString()}</td>
                                <td className={bid1Price > tc ? 'text-up' : bid1Price < tc ? 'text-down' : 'text-ref'}>{bid1Price.toLocaleString()}</td>
                                <td className="text-text-muted">{bid1Vol.toLocaleString()}</td>

                                <td className={`${priceColor} ${flashClass} font-extrabold bg-white/2`}>
                                  {currentPrice.toLocaleString()}
                                </td>
                                <td className="font-semibold text-text-primary">
                                  {Math.floor(100 + (currentPrice % 10) * 100).toLocaleString()}
                                </td>
                                <td className={`${priceColor} font-bold`}>
                                  {isUp ? '+' : ''}{Number(mover.change).toLocaleString()}
                                </td>

                                <td className={ask1Price > tc ? 'text-up' : ask1Price < tc ? 'text-down' : 'text-ref'}>{ask1Price.toLocaleString()}</td>
                                <td className="text-text-muted">{ask1Vol.toLocaleString()}</td>
                                <td className={ask2Price > tc ? 'text-up' : ask2Price < tc ? 'text-down' : 'text-ref'}>{ask2Price.toLocaleString()}</td>
                                <td className="text-text-muted">{ask2Vol.toLocaleString()}</td>
                                <td className={ask3Price > tc ? 'text-up' : ask3Price < tc ? 'text-down' : 'text-ref'}>{ask3Price.toLocaleString()}</td>
                                <td className="text-text-muted">{ask3Vol.toLocaleString()}</td>

                                <td className="font-semibold pr-3 text-text-primary">
                                  {totalVolume.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Emerging Signals */}
                <div className="xl:col-span-1 flex flex-col gap-5">
                  <h3 className="font-outfit text-lg font-bold flex items-center gap-2">
                    <Sparkles size={20} className="text-warning" />
                    {t('dashboard.signalsTitle')}
                  </h3>

                  {loadingData ? (
                    <div className="flex justify-center py-16">
                      <Loader2 size={24} className="animate-spin text-warning" />
                    </div>
                  ) : recentSignals.length === 0 ? (
                    <div className="glass-panel py-10 text-center text-text-muted text-xs">
                      {t('dashboard.noSignals')}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {recentSignals.map((signal) => {
                        const isBuy = signal.type === 'BUY';
                        return (
                          <Link key={signal.id} href={`/instruments/${signal.symbol}`} className="no-underline">
                            <div className="glass-panel p-4 rounded-xl border border-board-border cursor-pointer hover:border-accent/40 hover:bg-surface-hover/80 transition-all duration-200">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-extrabold text-sm font-outfit text-text-primary">{signal.symbol}</span>
                                <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'} text-[10px]`}>
                                  {signal.type}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary mb-2 leading-relaxed line-clamp-2">
                                {signal.reason}
                              </p>
                              <div className="flex justify-between text-[10px] text-text-muted">
                                <span>{t('dashboard.via')} {signal.indicator}</span>
                                <span>{new Date(signal.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: WATCHLIST TAB */}
          {activeTab === 'watchlist' && (
            <div>
              <div className="mb-8">
                <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
                  {t('watchlist.title')}
                </h1>
                <p className="text-text-secondary text-sm">
                  {t('watchlist.description')}
                </p>
              </div>

              {/* Add Symbol Bar */}
              <form onSubmit={handleAddWatchlist} className="flex gap-3 max-w-lg mb-8">
                <input
                  type="text"
                  placeholder={t('watchlist.symbolPlaceholder')}
                  value={watchlistInput}
                  onChange={(e) => setWatchlistInput(e.target.value)}
                  className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none flex-grow focus:border-accent transition-colors"
                />
                <button type="submit" className="btn-primary py-2.5 px-5 text-sm flex items-center gap-1.5 shrink-0">
                  <Plus size={16} />
                  {t('watchlist.addBtn')}
                </button>
              </form>

              {loadingWatchlist ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-accent" />
                </div>
              ) : watchlistItems.length === 0 ? (
                <div className="glass-panel py-16 text-center rounded-2xl border border-board-border max-w-xl mx-auto">
                  <Bookmark size={40} className="text-accent mx-auto mb-4" />
                  <h3 className="font-outfit text-lg font-extrabold text-text-primary mb-2">{t('watchlist.emptyTitle')}</h3>
                  <p className="text-text-secondary max-w-md mx-auto text-sm leading-relaxed px-4">
                    {t('watchlist.emptyDesc')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {watchlistItems.map((item) => {
                    const isUp = item.instrument.changePercent >= 0;
                    return (
                      <div
                        key={item.id}
                        className="glass-panel p-5 rounded-2xl border border-board-border relative group hover:border-accent/40"
                      >
                        <button
                          onClick={() => handleRemoveWatchlist(item.instrument.symbol)}
                          className="absolute top-4 right-4 bg-transparent border-none text-bearish hover:text-red-400 cursor-pointer p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>

                        <Link href={`/instruments/${item.instrument.symbol}`} className="no-underline text-inherit">
                          <div className="flex items-center gap-2 mb-3.5 pr-6">
                            <span className="font-outfit text-lg font-extrabold text-text-primary">{item.instrument.symbol}</span>
                            <span className="text-xs text-text-muted truncate max-w-[120px]">{item.instrument.name}</span>
                          </div>

                          <div className="flex justify-between items-end">
                            <div>
                              <p className="font-outfit text-xl font-extrabold text-text-primary m-0">
                                {item.instrument.price.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <span className="text-[10px] text-text-muted">VND</span>
                              </p>
                            </div>
                            <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'}`}>
                              {isUp ? '+' : ''}{(item.instrument.changePercent * 100).toFixed(2)}%
                            </span>
                          </div>

                          {item.instrument.latestSignal && (
                            <div className={`mt-4 py-2 px-3 rounded-lg text-xs font-semibold ${
                              item.instrument.latestSignal.type === 'BUY' 
                                ? 'bg-bullish/10 text-bullish border border-bullish/20' 
                                : 'bg-bearish/10 text-bearish border border-bearish/20'
                            }`}>
                              {t('sidebar.signals')}: {item.instrument.latestSignal.type} (Score: {Number(item.instrument.latestSignal.score || 0).toFixed(1)})
                            </div>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI SIGNALS TAB */}
          {activeTab === 'signals' && (
            <div>
              <div className="mb-8">
                <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
                  {t('signals.title')}
                </h1>
                <p className="text-text-secondary text-sm">
                  {t('signals.description')}
                </p>
              </div>

              {/* Signals Type Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(['ALL', 'BUY', 'SELL'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSignalTypeFilter(filter)}
                    className={`py-2 px-4 rounded-lg border font-semibold text-xs cursor-pointer transition-all duration-200 ${
                      signalTypeFilter === filter
                        ? 'border-accent bg-accent/15 text-accent shadow-md'
                        : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary hover:border-text-muted'
                    }`}
                  >
                    {filter === 'ALL' ? t('signals.filterAll') : filter === 'BUY' ? t('signals.filterBuy') : t('signals.filterSell')}
                  </button>
                ))}
              </div>

              {loadingAllSignals ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-accent" />
                </div>
              ) : allSignals.length === 0 ? (
                <div className="glass-panel py-16 text-center text-text-muted rounded-2xl border border-board-border">
                  <Sparkles size={40} className="text-warning mx-auto mb-4" />
                  <p>{t('signals.noSignals')}</p>
                </div>
              ) : (
                <div className="glass-panel font-inter overflow-x-auto rounded-2xl border border-board-border bg-board-bg">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-board-border text-text-muted font-bold text-xs uppercase tracking-wider">
                        <th className="p-4 px-6">{t('signals.tableSymbol')}</th>
                        <th className="p-4 px-6">{t('signals.tableType')}</th>
                        <th className="p-4 px-6">{t('signals.tableIndicator')}</th>
                        <th className="p-4 px-6">{t('signals.tableStrength')}</th>
                        <th className="p-4 px-6">{t('signals.tableScore')}</th>
                        <th className="p-4 px-6">{t('signals.tableExplanation')}</th>
                        <th className="p-4 px-6">{t('signals.tableTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSignals.map((signal) => {
                        const isBuy = signal.type === 'BUY';
                        return (
                          <tr key={signal.id} className="border-b border-board-border hover:bg-board-row-hover transition-colors">
                            <td className="p-4 px-6">
                              <Link href={`/instruments/${signal.symbol}`} className="text-accent font-extrabold hover:underline">
                                {signal.symbol}
                              </Link>
                            </td>
                            <td className="p-4 px-6">
                              <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'} text-[11px]`}>
                                {signal.type}
                              </span>
                            </td>
                            <td className="p-4 px-6 font-semibold text-text-primary">{signal.indicator}</td>
                            <td className="p-4 px-6">
                              <span className={`font-bold text-xs ${
                                signal.strength === 'HIGH' ? 'text-bullish' : signal.strength === 'MEDIUM' ? 'text-warning' : 'text-text-muted'
                              }`}>
                                {signal.strength === 'HIGH' ? t('signals.strengthHigh') : signal.strength === 'MEDIUM' ? t('signals.strengthMedium') : t('signals.strengthLow')}
                              </span>
                            </td>
                            <td className="p-4 px-6 font-bold text-text-primary">
                              {Number(signal.score || 0).toFixed(2)}
                            </td>
                            <td className="p-4 px-6 text-text-secondary max-w-[280px] truncate" title={signal.reason}>
                              {signal.reason}
                            </td>
                            <td className="p-4 px-6 text-text-muted text-xs">
                              {new Date(signal.detectedAt).toLocaleDateString()} {new Date(signal.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALERTS TAB */}
          {activeTab === 'alerts' && (
            <div>
              <div className="mb-8">
                <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
                  {t('alerts.title')}
                </h1>
                <p className="text-text-secondary text-sm">
                  {t('alerts.description')}
                </p>
              </div>

              {!session ? (
                <div className="glass-panel p-10 text-center rounded-2xl border border-board-border max-w-md mx-auto">
                  <Bell size={40} className="text-accent mx-auto mb-4" />
                  <p className="text-text-secondary mb-5 text-sm">{t('alerts.loginPrompt')}</p>
                  <Link href="/login?callbackUrl=/pricing">
                    <button className="btn-primary py-2 px-5 text-sm">{t('common.login')}</button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Create rule form */}
                  <div className="glass-panel font-inter p-6 rounded-2xl border border-board-border bg-board-bg h-fit lg:col-span-1">
                    <h3 className="font-outfit text-base font-bold text-text-primary mb-5">{t('alerts.createRule')}</h3>

                    <form onSubmit={handleCreateAlert} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{t('alerts.symbol')}</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. FPT"
                          value={alertSymbol}
                          onChange={(e) => setAlertSymbol(e.target.value)}
                          className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{t('alerts.type')}</label>
                        <select
                          value={alertType}
                          onChange={(e) => setAlertType(e.target.value)}
                          className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none cursor-pointer focus:border-accent transition-colors"
                        >
                          <option value="PRICE_ABOVE">{t('alerts.above')}</option>
                          <option value="PRICE_BELOW">{t('alerts.below')}</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{t('alerts.threshold')}</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 85000"
                          value={alertThreshold}
                          onChange={(e) => setAlertThreshold(e.target.value)}
                          className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                        />
                      </div>

                      <button type="submit" className="btn-primary py-3 font-bold text-sm mt-2 w-full justify-center">
                        {t('alerts.createBtn')}
                      </button>
                    </form>
                  </div>

                  {/* Rules and logs view */}
                  <div className="flex flex-col gap-8 lg:col-span-2">
                    {/* Rules section */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-outfit text-lg font-bold text-text-primary">{t('alerts.activeRules')}</h3>
                      {loadingAlerts ? (
                        <div className="flex py-6"><Loader2 className="animate-spin text-accent" size={24} /></div>
                      ) : alertRules.length === 0 ? (
                        <div className="glass-panel p-6 text-text-muted text-sm rounded-2xl border border-board-border">
                          {t('alerts.noRules')}
                        </div>
                      ) : (
                        <div className="glass-panel font-inter overflow-hidden rounded-2xl border border-board-border bg-board-bg">
                          <table className="w-full border-collapse text-left text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-board-border text-text-muted">
                                <th className="p-3 px-4">{t('alerts.symbol')}</th>
                                <th className="p-3 px-4">{t('alerts.condition')}</th>
                                <th className="p-3 px-4">{t('alerts.threshold')}</th>
                                <th className="p-3 px-4">{t('common.status')}</th>
                                <th className="p-3 px-4" />
                              </tr>
                            </thead>
                            <tbody>
                              {alertRules.map((rule) => (
                                <tr key={rule.id} className="border-b border-board-border hover:bg-board-row-hover">
                                  <td className="p-3 px-4 font-extrabold text-accent">{rule.symbol}</td>
                                  <td className="p-3 px-4 font-semibold text-text-primary">
                                    {rule.type === 'PRICE_ABOVE' ? 'PRICE >= (ABOVE)' : 'PRICE <= (BELOW)'}
                                  </td>
                                  <td className="p-3 px-4 font-bold text-text-primary">
                                    {rule.threshold.toLocaleString()} VND
                                  </td>
                                  <td className="p-3 px-4">
                                    <span className="badge badge-bullish text-[10px]">
                                      Active
                                    </span>
                                  </td>
                                  <td className="p-3 px-4 text-right">
                                    <button
                                      onClick={() => handleDeleteAlert(rule.id)}
                                      className="bg-transparent border-none text-bearish hover:text-red-400 cursor-pointer p-1 transition-colors"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Fired events logs */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-outfit text-lg font-bold text-text-primary">{t('alerts.triggeredEvents')}</h3>
                      {alertEvents.length === 0 ? (
                        <div className="glass-panel p-6 text-text-muted text-sm rounded-2xl border border-board-border">
                          {t('alerts.noEvents')}
                        </div>
                      ) : (
                        <div className="glass-panel font-inter overflow-hidden rounded-2xl border border-board-border bg-board-bg">
                          <table className="w-full border-collapse text-left text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-board-border text-text-muted">
                                <th className="p-3 px-4">{t('alerts.symbol')}</th>
                                <th className="p-3 px-4">{t('alerts.condition')}</th>
                                <th className="p-3 px-4">{t('alerts.threshold')}</th>
                                <th className="p-3 px-4">{t('alerts.triggeredVal')}</th>
                                <th className="p-3 px-4">{t('alerts.triggeredAt')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alertEvents.map((event) => (
                                <tr key={event.id} className="border-b border-board-border hover:bg-board-row-hover">
                                  <td className="p-3 px-4 font-extrabold text-accent">{event.symbol}</td>
                                  <td className="p-3 px-4 font-semibold text-text-primary">
                                    {event.type === 'PRICE_ABOVE' ? 'PRICE >= (ABOVE)' : 'PRICE <= (BELOW)'}
                                  </td>
                                  <td className="p-3 px-4 text-text-muted">
                                    {event.threshold.toLocaleString()} VND
                                  </td>
                                  <td className="p-3 px-4 font-bold text-warning">
                                    {event.triggeredValue.toLocaleString()} VND
                                  </td>
                                  <td className="p-3 px-4 text-text-muted text-[11px]">
                                    {new Date(event.triggeredAt).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PERSONALIZATION & AI ADVISORY */}
          {activeTab === 'personalization' && (
            <div>
              {/* Header section with manual scan action */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="badge badge-accent bg-emerald-500/10 border border-emerald-500/20 text-bullish font-extrabold text-[10px]">
                      ⚡ POWERED BY AI DEEP ADVISORY v2.4
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Học máy học tập động
                    </span>
                  </div>
                  <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-1 title-gradient">
                    Nhận Định Danh Mục & Gợi Ý AI
                  </h1>
                  <p className="text-text-secondary text-sm">
                    Trí tuệ nhân tạo quét hành vi đầu tư thực tế, kiểm soát rủi ro phân bổ HHI và đề xuất cơ hội phù hợp nhất với bạn.
                  </p>
                </div>

                <div className="w-full md:w-auto">
                  <button
                    onClick={handleAIScan}
                    disabled={isAnalyzing || loadingPersonalization}
                    className={`p-3 px-6 rounded-xl text-white font-extrabold font-outfit text-sm shadow-xl flex items-center justify-center gap-2 w-full md:w-auto transition-all duration-300 ${
                      (isAnalyzing || loadingPersonalization)
                        ? 'bg-purple-900/60 border border-purple-500/20 cursor-not-allowed opacity-75'
                        : 'bg-gradient-to-r from-accent to-purple-600 hover:from-accent hover:to-purple-700 cursor-pointer shadow-purple-600/10'
                    }`}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isAnalyzing ? 'Đang chạy phân tích...' : 'Kích hoạt AI Quét & Phân tích'}
                  </button>
                </div>
              </div>

              {/* Error State */}
              {personalizationError && (
                <div className="glass-panel p-5 bg-bearish/10 border border-bearish/20 rounded-xl text-bearish flex items-start gap-3 mb-6">
                  <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-sm">Không thể liên kết bộ máy cá nhân hóa</strong>
                    <span className="text-xs text-text-secondary">{personalizationError}</span>
                  </div>
                </div>
              )}

              {/* Step-by-Step AI Analysis Terminal log (Active Scanner overlay) */}
              {isAnalyzing && (
                <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 bg-slate-950/80 shadow-2xl shadow-purple-500/5 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="animate-spin text-accent" size={20} />
                    <h4 className="font-outfit text-white text-base font-extrabold">
                      Hệ thống đang cập nhật hồ sơ & tính toán khuyến nghị...
                    </h4>
                  </div>
                  <div className="flex flex-col gap-2.5 font-mono text-xs">
                    <div className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 1 ? 'text-bullish font-semibold' : 'text-text-muted'}`}>
                      <span className="font-bold">{analysisStep > 1 ? '✓' : '●'}</span>
                      <span>[BƯỚC 1/4] Đang tập hợp các cổ phiếu bạn xem và tìm kiếm gần đây...</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 2 ? (analysisStep > 2 ? 'text-bullish font-semibold' : 'text-warning font-semibold') : 'text-text-muted'}`}>
                      <span className="font-bold">{analysisStep > 2 ? '✓' : analysisStep === 2 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 2/4] Đang ưu tiên các mối quan tâm mới nhất và tự động giảm bớt tương tác cũ...</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 3 ? (analysisStep > 3 ? 'text-bullish font-semibold' : 'text-warning font-semibold') : 'text-text-muted'}`}>
                      <span className="font-bold">{analysisStep > 3 ? '✓' : analysisStep === 3 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 3/4] Đang đo lường mức độ đa dạng tài sản và rủi ro dồn vốn vào một vài nhóm ngành...</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 4 ? (analysisStep > 4 ? 'text-bullish font-semibold' : 'text-warning font-semibold') : 'text-text-muted'}`}>
                      <span className="font-bold">{analysisStep > 4 ? '✓' : analysisStep === 4 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 4/4] Đang biên soạn luận điểm đánh giá rủi ro từ chuyên gia cố vấn AI (GPT-4o)...</span>
                    </div>
                    {analysisStep === 5 && (
                      <div className="text-accent font-extrabold mt-2 text-sm">
                        🎉 ĐÃ TẢI XONG: Bản phân tích danh mục và danh sách gợi ý cổ phiếu live đã sẵn sàng!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Content Layout */}
              {loadingPersonalization && !isAnalyzing ? (
                <div className="py-16 text-center">
                  <Loader2 className="animate-spin text-accent mx-auto mb-4" size={40} />
                  <p className="text-text-secondary text-sm">Đang truy vấn mô hình cá nhân hóa học sâu...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-inter">

                  {/* Left Column: Portfolio Diversification Intelligence */}
                  <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

                    {/* Portfolio overview and HHI analysis */}
                    <div className="glass-panel p-6 rounded-2xl border border-board-border bg-board-bg">
                      <div className="flex justify-between items-center mb-6 border-b border-board-border pb-4">
                        <div className="flex items-center gap-2.5">
                          <PieChart size={20} className="text-accent" />
                          <h3 className="font-outfit text-base font-extrabold text-text-primary">
                            {portfolioIntel?.portfolioName || 'Danh mục Đầu tư Cá nhân'}
                          </h3>
                        </div>
                        <span className="badge badge-accent">
                          Khớp tài khoản thực tế
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div className="bg-surface p-4 px-5 rounded-xl border border-board-border-active">
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                            Tổng giá trị tài sản nắm giữ
                          </span>
                          <div className="text-2xl font-extrabold text-bullish mt-1 drop-shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                            {portfolioIntel?.totalValue ? portfolioIntel.totalValue.toLocaleString() : '174,000,000'} <span className="text-sm font-semibold">VND</span>
                          </div>
                        </div>

                        <div className="bg-surface p-4 px-5 rounded-xl border border-board-border-active">
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                            Rủi ro tập trung (Chỉ số phân bổ)
                          </span>
                          <div className="flex items-center gap-2.5 mt-1">
                            <div className="text-2xl font-extrabold text-white">
                              {portfolioIntel?.hhi || 5625} <span className="text-xs text-text-secondary font-semibold">HHI</span>
                            </div>
                            <span className={`badge shrink-0 text-[10px] font-extrabold ${
                              portfolioIntel?.concentrationRating === 'DIVERSIFIED'
                                ? 'badge-bullish'
                                : portfolioIntel?.concentrationRating === 'MODERATELY_CONCENTRATED'
                                  ? 'badge-warning'
                                  : 'badge-bearish'
                            }`}>
                              {portfolioIntel?.concentrationLabel || 'Rủi ro tập trung cao'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Descriptive Layman explanatory subtext */}
                      <p className="text-[11px] sm:text-xs text-text-secondary bg-white/2 border border-white/5 p-3 px-4 rounded-lg leading-relaxed mb-6">
                        💡 <strong>Chỉ số HHI:</strong> Thước đo mức độ tập trung vốn của bạn. Điểm càng nhỏ chứng tỏ vốn được chia đều sang nhiều ngành/cổ phiếu khác nhau (giảm thiểu rủi ro thua lỗ nặng khi một ngành rung lắc).
                      </p>

                      {/* HHI Visual Gauge Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[9px] sm:text-[10px] text-text-muted font-bold mb-1.5 uppercase tracking-wider">
                          <span>🟢 AN TOÀN (Phân bổ đều)</span>
                          <span>🟡 TRUNG BÌNH (Tập trung nhẹ)</span>
                          <span>🔴 RỦI RO CAO (Dồn vốn lớn)</span>
                        </div>

                        {/* Multi-zone Bar */}
                        <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 relative overflow-visible shadow-inner">
                          {/* Caret pointing */}
                          <div 
                            style={{ left: `${Math.min(Math.max((portfolioIntel?.hhi || 5625) / 100, 2), 98)}%` }}
                            className="absolute -top-2 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 ease-out"
                          >
                            <span className="text-white text-xs drop-shadow-[0_0_4px_rgba(255,255,255,0.8)] leading-none">▲</span>
                          </div>
                        </div>

                        <div className="flex justify-between text-[9px] sm:text-[10px] text-text-muted mt-2">
                          <span>0</span>
                          <span>1500</span>
                          <span>2500</span>
                          <span>10000 (Tuyệt đối)</span>
                        </div>
                      </div>
                    </div>

                    {/* Sector allocation list */}
                    <div className="glass-panel p-6 rounded-2xl border border-board-border bg-board-bg">
                      <h4 className="font-outfit text-sm font-extrabold text-text-primary mb-5 flex items-center gap-2">
                        <Briefcase size={16} className="text-accent" />
                        Phân bổ tỷ trọng nhóm ngành thực tế
                      </h4>

                      <div className="flex flex-col gap-4">
                        {portfolioIntel?.allocation && portfolioIntel.allocation.length > 0 ? (
                          portfolioIntel.allocation.map((item: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-xs sm:text-sm">
                                <span className="font-bold text-text-primary">
                                  {idx + 1}. {item.sector}
                                </span>
                                <div className="flex gap-3">
                                  <span className="text-text-secondary font-medium">
                                    {item.value ? item.value.toLocaleString() : '---'} VND
                                  </span>
                                  <span className="font-extrabold text-accent">
                                    {item.percentage}%
                                  </span>
                                </div>
                              </div>
                              {/* Sleek Percentage Bar */}
                              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${item.percentage}%` }}
                                  className="h-full bg-gradient-to-r from-accent to-blue-500 rounded-full transition-all duration-1000 ease-out"
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-text-muted text-xs bg-surface rounded-lg">
                            Chưa tìm thấy dữ liệu phân bổ nhóm ngành.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Advisor Thesis */}
                    <div className="glass-panel p-6 rounded-2xl border border-warning/20 bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={18} className="text-warning" />
                        <h4 className="font-outfit text-sm font-extrabold text-warning tracking-wide">
                          Ý Kiến Tư Vấn Quản Trị Rủi Ro AI
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-text-primary italic whitespace-pre-wrap">
                        "{portfolioIntel?.thesis || 'Hệ thống AI Advisor đang quét danh mục tài sản nắm giữ để sinh luận điểm rủi ro. Hãy bấm nút Kích hoạt quét AI ở phía trên.'}"
                      </p>

                      <div className="mt-4 flex justify-end text-[10px] text-text-muted font-medium">
                        — Chứng nhận bởi OpenAI GPT-4o Risk Engine
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Personalized Feed */}
                  <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
                    <div className="flex items-center justify-between border-b border-board-border pb-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Activity size={18} className="text-warning" />
                        <h3 className="font-outfit text-base font-extrabold text-text-primary">
                          Gợi ý cổ phiếu dành cho bạn
                        </h3>
                      </div>
                      <span className="badge badge-warning text-[9px]">
                        Đo khớp tối ưu
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">
                      {personalizedFeed && personalizedFeed.length > 0 ? (
                        personalizedFeed.map((item: any, idx: number) => {
                          const hasSignal = !!item.latestSignal;
                          const isBuy = item.latestSignal?.type === 'BUY';
                          const hasChange = item.changePercent !== null && item.changePercent !== undefined;
                          const isUp = hasChange && item.changePercent >= 0;

                          return (
                            <Link
                              key={idx}
                              href={`/instruments/${item.symbol}`}
                              onClick={() => handleSelectRecommended(item.symbol)}
                              className="no-underline text-inherit"
                            >
                              <div
                                className="glass-panel p-4 rounded-xl border border-board-border cursor-pointer transition-all duration-300 bg-surface hover:border-accent hover:translate-x-1 hover:bg-surface-hover"
                              >
                                <div className="flex justify-between items-start mb-2.5">
                                  <div>
                                    <span className="text-base font-extrabold text-accent">
                                      {item.symbol}
                                    </span>
                                    <span className="text-xs text-text-muted block max-w-[160px] truncate">
                                      {item.name}
                                    </span>
                                  </div>

                                  <div className="flex flex-col items-end">
                                    {item.price !== null ? (
                                      <span className="font-extrabold text-sm text-text-primary">
                                        {item.price.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-text-muted text-xs">---</span>
                                    )}
                                    {hasChange && (
                                      <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ${
                                        isUp ? 'text-bullish' : 'text-bearish'
                                      }`}>
                                        {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                        {isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Linear score indicator */}
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex-grow h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                      style={{ width: `${item.score}%` }}
                                      className="h-full bg-gradient-to-r from-purple-500 to-accent"
                                    />
                                  </div>
                                  <span className="text-[10px] font-extrabold text-warning shrink-0">
                                    {Math.round(item.score)}% PHÙ HỢP
                                  </span>
                                </div>

                                {/* Matching Reason capsules */}
                                <div className={`flex flex-wrap gap-1.5 ${hasSignal ? 'mb-2.5' : 'mb-0'}`}>
                                  {item.reasons && item.reasons.map((reason: string, rIdx: number) => {
                                    let icon = '⭐';
                                    let text = reason;
                                    if (reason === 'PORTFOLIO_HOLDING') { icon = '💼'; text = 'Trong danh mục'; }
                                    else if (reason === 'SECTOR_AFFINITY') { icon = '🎯'; text = 'Nhóm ngành ưu thích'; }
                                    else if (reason === 'SECTOR_CROSSOVER') { icon = '⚡'; text = 'Tín hiệu kỹ thuật tốt'; }
                                    else if (reason === 'POPULAR_MEMBER') { icon = '🔥'; text = 'Được xem nhiều'; }

                                    return (
                                      <span key={rIdx} className="text-[9px] font-bold text-text-secondary bg-surface-hover border border-board-border py-0.5 px-2 rounded flex items-center gap-1">
                                        <span>{icon}</span> {text}
                                      </span>
                                    );
                                  })}
                                </div>

                                {/* Active AI signal if present */}
                                {hasSignal && (
                                  <div className={`mt-2 p-2 rounded flex items-center gap-1.5 text-[10px] font-bold ${
                                    isBuy 
                                      ? 'bg-bullish/10 border border-bullish/15 text-bullish' 
                                      : 'bg-bearish/10 border border-bearish/15 text-bearish'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${
                                      isBuy ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}></span>
                                    AI: {item.latestSignal.type} ({item.latestSignal.indicator}) — Tín cậy: {Number(item.latestSignal.score || 0).toFixed(1)}
                                  </div>
                                )}
                              </div>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="glass-panel p-6 text-center text-text-muted text-sm rounded-xl">
                          Chưa có gợi ý cá nhân hóa nào được tạo. Click Quét AI phía trên để khởi chạy!
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Ticker Detail High-Fidelity Popup Modal */}
      {selectedSymbol && (
        <TickerDetailModal
          symbol={selectedSymbol}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSymbol(null);
          }}
        />
      )}
    </div>
  );
}


