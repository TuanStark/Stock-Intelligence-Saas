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
    <div className="app-container">
      {/* Sidebar Mobile Backdrop Overlay */}
      <div 
        className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside className={`glass-panel ${isSidebarOpen ? 'sidebar-open' : ''}`} style={{
        position: 'fixed',
        left: '24px',
        top: '24px',
        bottom: '24px',
        width: 'var(--sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        zIndex: 50,
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-accent) 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
            color: '#fff'
          }}>S</div>
          <h2 className="font-outfit" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            STOCK<span style={{ color: 'var(--color-accent)' }}>INTEL</span>
          </h2>
        </div>

        {/* Tab Buttons */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'dashboard' ? 'var(--color-accent-bg)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}
          >
            <TrendingUp size={18} />
            {t('sidebar.dashboard')}
          </button>
          
          <button 
            onClick={() => { setActiveTab('watchlist'); setIsSidebarOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'watchlist' ? 'var(--color-accent-bg)' : 'transparent',
              color: activeTab === 'watchlist' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Bookmark size={18} />
            {t('sidebar.watchlist')}
          </button>

          <button 
            onClick={() => { setActiveTab('signals'); setIsSidebarOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'signals' ? 'var(--color-accent-bg)' : 'transparent',
              color: activeTab === 'signals' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Sparkles size={18} />
            {t('sidebar.signals')}
          </button>

          <button 
            onClick={() => { setActiveTab('alerts'); setIsSidebarOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'alerts' ? 'var(--color-accent-bg)' : 'transparent',
              color: activeTab === 'alerts' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Bell size={18} />
            {t('sidebar.alerts')}
          </button>

          <button 
            onClick={() => { setActiveTab('personalization'); setIsSidebarOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'personalization' ? 'var(--color-accent-bg)' : 'transparent',
              color: activeTab === 'personalization' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Sparkles size={18} style={{ color: 'var(--color-warning)' }} />
            Phân tích AI & Gợi ý
          </button>

          <Link href="/pricing" style={{ textDecoration: 'none' }}>
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <Building2 size={18} />
              {t('sidebar.pricing')}
            </button>
          </Link>
        </nav>

        {/* Dynamic Locale Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
          <button 
            onClick={() => setLocale('vi')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: locale === 'vi' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
              background: locale === 'vi' ? 'var(--color-accent-bg)' : 'transparent',
              color: locale === 'vi' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            VI
          </button>
          <button 
            onClick={() => setLocale('en')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: locale === 'en' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
              background: locale === 'en' ? 'var(--color-accent-bg)' : 'transparent',
              color: locale === 'en' ? 'var(--color-accent)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            EN
          </button>
        </div>

        {/* User profile footer */}
        <div className="glass-panel" style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          fontSize: '13px'
        }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {user.email}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-bullish" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  {userTier}
                </span>
                <button 
                  onClick={() => signOut()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-bearish)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  <LogOut size={14} />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('sidebar.guestUser')}</span>
              <Link href="/login" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', width: '100%' }}>
                  {t('common.login')}
                </button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <main className="main-content">
        
        {/* ─── TOP HEADER BAR with SEARCH ─── */}
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
            {/* Hamburger Button for mobile */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-secondary toggle-sidebar-btn"
              style={{ padding: '10px' }}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Autocomplete Input Container */}
            <div className="header-search-container" ref={autocompleteRef}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              transition: 'var(--transition-smooth)',
            }} className="glass-panel">
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder={t('common.searchPlaceholder')} 
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  width: '100%',
                }}
              />
              {loadingSearch && <Loader2 size={16} className="pulse" style={{ color: 'var(--text-muted)' }} />}
            </div>

            {/* Search Autocomplete Panel */}
            {showAutocomplete && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                zIndex: 100,
                border: '1px solid var(--border-color-active)',
                boxShadow: 'var(--shadow-premium)',
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    {loadingSearch ? 'Searching database...' : 'No symbols found'}
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <Link key={item.id} href={`/instruments/${item.symbol}`} style={{ textDecoration: 'none' }} onClick={() => setShowAutocomplete(false)}>
                      <button 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'var(--transition-smooth)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: 800, color: 'var(--color-accent)', marginRight: '10px' }}>{item.symbol}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

          <div className="header-ticker-hide" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'hsla(142, 72%, 45%, 0.12)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsla(142, 72%, 45%, 0.2)',
              color: 'var(--color-bullish)',
              fontSize: '13px',
              fontWeight: 600
            }}>
              <TrendingUp size={16} />
              VN-INDEX: 1,250.32 (+1.25%)
            </div>
          </div>
        </header>

        {/* ─── DYNAMIC SUBVIEW ─── */}
        <div style={{ marginTop: '24px' }}>
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Error Banner */}
              {errorMsg && (
                <div style={{
                  padding: '16px 20px',
                  background: 'var(--color-bearish-bg)',
                  border: '1px solid hsla(346, 80%, 55%, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-bearish)',
                  fontSize: '14px',
                  marginBottom: '24px',
                  fontWeight: 500
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Dashboard Intro */}
              <div style={{ marginBottom: '32px' }}>
                <h1 className="font-outfit title-gradient" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {t('dashboard.title')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                  {t('dashboard.description')}
                </p>
              </div>

              {/* Grid Content */}
              <div className="responsive-grid-2-1">
                
                {/* LEFT COLUMN: Top Movers (Quotes) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingUp size={20} style={{ color: 'var(--color-accent)' }} />
                    {t('dashboard.moversTitle')}
                  </h3>

                  {loadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                      <Loader2 size={32} className="pulse" style={{ color: 'var(--color-accent)' }} />
                    </div>
                  ) : topMovers.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t('dashboard.noMovers')}
                    </div>
                  ) : (
                    <div className="responsive-grid-1-1">
                      {topMovers.map((mover) => {
                        const isUp = mover.changePercent >= 0;
                        return (
                          <Link key={mover.symbol} href={`/instruments/${mover.symbol}`} style={{ textDecoration: 'none' }}>
                            <div 
                              className="glass-panel"
                              style={{
                                padding: '20px',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                transition: 'var(--transition-smooth)',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                  <h4 className="font-outfit" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{mover.symbol}</h4>
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{mover.name}</p>
                                </div>
                                <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'}`}>
                                  {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                  {(mover.changePercent * 100).toFixed(2)}%
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('dashboard.lastPrice')}</p>
                                  <p className="font-outfit" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {mover.price.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>VND</span>
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('dashboard.changeLabel')}</p>
                                  <p style={{ fontWeight: 600, color: isUp ? 'var(--color-bullish)' : 'var(--color-bearish)', fontSize: '14px' }}>
                                    {isUp ? '+' : ''}{mover.change.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Emerging Signals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={20} style={{ color: 'var(--color-warning)' }} />
                    {t('dashboard.signalsTitle')}
                  </h3>

                  {loadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                      <Loader2 size={24} className="pulse" style={{ color: 'var(--color-warning)' }} />
                    </div>
                  ) : recentSignals.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {t('dashboard.noSignals')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {recentSignals.map((signal) => {
                        const isBuy = signal.type === 'BUY';
                        return (
                          <Link key={signal.id} href={`/instruments/${signal.symbol}`} style={{ textDecoration: 'none' }}>
                            <div 
                              className="glass-panel" 
                              style={{ 
                                padding: '16px', 
                                borderRadius: 'var(--radius-md)', 
                                border: '1px solid var(--border-color)', 
                                cursor: 'pointer' 
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 800, fontSize: '15px' }} className="font-outfit">{signal.symbol}</span>
                                <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                                  {signal.type}
                                </span>
                              </div>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {signal.reason}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
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
              <div style={{ marginBottom: '32px' }}>
                <h1 className="font-outfit title-gradient" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {t('watchlist.title')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                  {t('watchlist.description')}
                </p>
              </div>

              {/* Add Symbol Bar */}
              <form onSubmit={handleAddWatchlist} style={{ display: 'flex', gap: '12px', maxWidth: '480px', marginBottom: '32px' }}>
                <input 
                  type="text" 
                  placeholder={t('watchlist.symbolPlaceholder')}
                  value={watchlistInput}
                  onChange={(e) => setWatchlistInput(e.target.value)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 16px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    flexGrow: 1
                  }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} />
                  {t('watchlist.addBtn')}
                </button>
              </form>

              {loadingWatchlist ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                  <Loader2 size={32} className="pulse" style={{ color: 'var(--color-accent)' }} />
                </div>
              ) : watchlistItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                  <Bookmark size={40} style={{ color: 'var(--color-accent)', margin: '0 auto 16px auto' }} />
                  <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>{t('watchlist.emptyTitle')}</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 16px auto', fontSize: '14px', lineHeight: 1.5 }}>
                    {t('watchlist.emptyDesc')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {watchlistItems.map((item) => {
                    const isUp = item.instrument.changePercent >= 0;
                    return (
                      <div 
                        key={item.id} 
                        className="glass-panel" 
                        style={{ padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', position: 'relative' }}
                      >
                        <button 
                          onClick={() => handleRemoveWatchlist(item.instrument.symbol)}
                          style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-bearish)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>

                        <Link href={`/instruments/${item.instrument.symbol}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <span className="font-outfit" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{item.instrument.symbol}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{item.instrument.name}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <p className="font-outfit" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                {item.instrument.price.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VND</span>
                              </p>
                            </div>
                            <span className={`badge ${isUp ? 'badge-bullish' : 'badge-bearish'}`} style={{ padding: '2px 8px' }}>
                              {isUp ? '+' : ''}{(item.instrument.changePercent * 100).toFixed(2)}%
                            </span>
                          </div>

                          {item.instrument.latestSignal && (
                            <div style={{
                              marginTop: '16px',
                              padding: '8px 12px',
                              background: item.instrument.latestSignal.type === 'BUY' ? 'var(--color-bullish-bg)' : 'var(--color-bearish-bg)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11px',
                              color: item.instrument.latestSignal.type === 'BUY' ? 'var(--color-bullish)' : 'var(--color-bearish)',
                              fontWeight: 600
                            }}>
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
              <div style={{ marginBottom: '32px' }}>
                <h1 className="font-outfit title-gradient" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {t('signals.title')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                  {t('signals.description')}
                </p>
              </div>

              {/* Signals Type Filter */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {(['ALL', 'BUY', 'SELL'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSignalTypeFilter(filter)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: signalTypeFilter === filter ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                      background: signalTypeFilter === filter ? 'var(--color-accent-bg)' : 'transparent',
                      color: signalTypeFilter === filter ? 'var(--color-accent)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {filter === 'ALL' ? t('signals.filterAll') : filter === 'BUY' ? t('signals.filterBuy') : t('signals.filterSell')}
                  </button>
                ))}
              </div>

              {loadingAllSignals ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                  <Loader2 size={32} className="pulse" style={{ color: 'var(--color-accent)' }} />
                </div>
              ) : allSignals.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 'var(--radius-lg)' }}>
                  <Sparkles size={40} style={{ color: 'var(--color-warning)', margin: '0 auto 16px auto' }} />
                  <p>{t('signals.noSignals')}</p>
                </div>
              ) : (
                <div className="glass-panel font-inter" style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableSymbol')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableType')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableIndicator')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableStrength')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableScore')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableExplanation')}</th>
                        <th style={{ padding: '16px 20px' }}>{t('signals.tableTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSignals.map((signal) => {
                        const isBuy = signal.type === 'BUY';
                        return (
                          <tr key={signal.id} style={{ borderBottom: '1px solid var(--border-color-active)', transition: 'var(--transition-smooth)' }} className="table-row-hover">
                            <td style={{ padding: '16px 20px' }}>
                              <Link href={`/instruments/${signal.symbol}`} style={{ color: 'var(--color-accent)', fontWeight: 800, textDecoration: 'none' }}>
                                {signal.symbol}
                              </Link>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'}`} style={{ padding: '2px 8px', fontSize: '11px' }}>
                                {signal.type}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: 600 }}>{signal.indicator}</td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ 
                                color: signal.strength === 'HIGH' ? 'var(--color-bullish)' : signal.strength === 'MEDIUM' ? 'var(--color-warning)' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '12px'
                              }}>
                                {signal.strength === 'HIGH' ? t('signals.strengthHigh') : signal.strength === 'MEDIUM' ? t('signals.strengthMedium') : t('signals.strengthLow')}
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                              {Number(signal.score || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {signal.reason}
                            </td>
                            <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
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
              <div style={{ marginBottom: '32px' }}>
                <h1 className="font-outfit title-gradient" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {t('alerts.title')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                  {t('alerts.description')}
                </p>
              </div>

              {!session ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                  <Bell size={40} style={{ color: 'var(--color-accent)', margin: '0 auto 16px auto' }} />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{t('alerts.loginPrompt')}</p>
                  <Link href="/login?callbackUrl=/pricing">
                    <button className="btn-primary" style={{ padding: '8px 16px' }}>{t('common.login')}</button>
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
                  {/* Create rule form */}
                  <div className="glass-panel font-inter" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
                    <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px' }}>{t('alerts.createRule')}</h3>
                    
                    <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('alerts.symbol')}</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. FPT"
                          value={alertSymbol}
                          onChange={(e) => setAlertSymbol(e.target.value)}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 14px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('alerts.type')}</label>
                        <select 
                          value={alertType}
                          onChange={(e) => setAlertType(e.target.value)}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 14px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="PRICE_ABOVE">{t('alerts.above')}</option>
                          <option value="PRICE_BELOW">{t('alerts.below')}</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('alerts.threshold')}</label>
                        <input 
                          type="number" 
                          required
                          placeholder="e.g. 85000"
                          value={alertThreshold}
                          onChange={(e) => setAlertThreshold(e.target.value)}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 14px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <button type="submit" className="btn-primary" style={{ padding: '12px', fontWeight: 700, fontSize: '14px', marginTop: '8px' }}>
                        {t('alerts.createBtn')}
                      </button>
                    </form>
                  </div>

                  {/* Rules and logs view */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* Rules section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 800 }}>{t('alerts.activeRules')}</h3>
                      {loadingAlerts ? (
                        <Loader2 className="pulse" style={{ color: 'var(--color-accent)' }} />
                      ) : alertRules.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
                          {t('alerts.noRules')}
                        </div>
                      ) : (
                        <div className="glass-panel font-inter" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.symbol')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.condition')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.threshold')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('common.status')}</th>
                                <th style={{ padding: '12px 16px' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {alertRules.map((rule) => (
                                <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color-active)' }}>
                                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-accent)' }}>{rule.symbol}</td>
                                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                    {rule.type === 'PRICE_ABOVE' ? 'PRICE >= (ABOVE)' : 'PRICE <= (BELOW)'}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                                    {rule.threshold.toLocaleString()} VND
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span className="badge badge-bullish" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                      Active
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    <button 
                                      onClick={() => handleDeleteAlert(rule.id)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--color-bearish)',
                                        cursor: 'pointer',
                                        padding: '4px'
                                      }}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 className="font-outfit" style={{ fontSize: '20px', fontWeight: 800 }}>{t('alerts.triggeredEvents')}</h3>
                      {alertEvents.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
                          {t('alerts.noEvents')}
                        </div>
                      ) : (
                        <div className="glass-panel font-inter" style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.symbol')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.condition')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.threshold')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.triggeredVal')}</th>
                                <th style={{ padding: '12px 16px' }}>{t('alerts.triggeredAt')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alertEvents.map((event) => (
                                <tr key={event.id} style={{ borderBottom: '1px solid var(--border-color-active)' }}>
                                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--color-accent)' }}>{event.symbol}</td>
                                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                    {event.type === 'PRICE_ABOVE' ? 'PRICE >= (ABOVE)' : 'PRICE <= (BELOW)'}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                    {event.threshold.toLocaleString()} VND
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-warning)' }}>
                                    {event.triggeredValue.toLocaleString()} VND
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px' }}>
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
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'stretch', 
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '32px'
              }} className="md:flex-row md:items-center">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="badge" style={{ 
                      fontSize: '11px', 
                      fontWeight: 800, 
                      padding: '3px 8px', 
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-bullish)',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      ⚡ POWERED BY AI DEEP ADVISORY v2.4
                    </span>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontSize: '11px', 
                      color: 'var(--text-muted)' 
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                      Học máy học tập động
                    </span>
                  </div>
                  <h1 className="font-outfit title-gradient" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
                    Nhận Định Danh Mục & Gợi Ý AI
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                    Trí tuệ nhân tạo quét hành vi đầu tư thực tế, kiểm soát rủi ro phân bổ HHI và đề xuất cơ hội phù hợp nhất với bạn.
                  </p>
                </div>

                <div>
                  <button 
                    onClick={handleAIScan}
                    disabled={isAnalyzing || loadingPersonalization}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, var(--color-accent) 0%, #a855f7 100%)',
                      color: '#fff',
                      border: 'none',
                      cursor: (isAnalyzing || loadingPersonalization) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontWeight: 800,
                      fontFamily: 'Outfit, sans-serif',
                      boxShadow: '0 4px 20px rgba(139, 92, 246, 0.25)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      opacity: (isAnalyzing || loadingPersonalization) ? 0.75 : 1,
                      width: '100%',
                      justifyContent: 'center'
                    }}
                    className="md:w-auto"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isAnalyzing ? 'Đang chạy phân tích...' : 'Kích hoạt AI Quét & Phân tích'}
                  </button>
                </div>
              </div>

              {/* Error State */}
              {personalizationError && (
                <div className="glass-panel" style={{
                  padding: '20px',
                  background: 'var(--color-bearish-bg)',
                  border: '1px solid hsla(346, 80%, 55%, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-bearish)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <ShieldAlert size={20} />
                  <div>
                    <strong style={{ display: 'block' }}>Không thể liên kết bộ máy cá nhân hóa</strong>
                    <span style={{ fontSize: '13px' }}>{personalizationError}</span>
                  </div>
                </div>
              )}

              {/* Step-by-Step AI Analysis Terminal log (Active Scanner overlay) */}
              {isAnalyzing && (
                <div className="glass-panel" style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
                  marginBottom: '32px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Loader2 className="spin" style={{ color: 'var(--color-accent)' }} size={20} />
                    <h4 className="font-outfit text-white" style={{ fontSize: '18px', fontWeight: 800 }}>
                      Hệ thống đang cập nhật hồ sơ & tính toán khuyến nghị...
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '13px' }}>
                    <div style={{ color: analysisStep >= 1 ? 'var(--color-bullish)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800 }}>{analysisStep > 1 ? '✓' : '●'}</span>
                      <span>[BƯỚC 1/4] Đang tập hợp các cổ phiếu bạn xem và tìm kiếm gần đây...</span>
                    </div>
                    <div style={{ color: analysisStep >= 2 ? (analysisStep > 2 ? 'var(--color-bullish)' : 'var(--color-warning)') : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800 }}>{analysisStep > 2 ? '✓' : analysisStep === 2 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 2/4] Đang ưu tiên các mối quan tâm mới nhất và tự động giảm bớt tương tác cũ...</span>
                    </div>
                    <div style={{ color: analysisStep >= 3 ? (analysisStep > 3 ? 'var(--color-bullish)' : 'var(--color-warning)') : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800 }}>{analysisStep > 3 ? '✓' : analysisStep === 3 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 3/4] Đang đo lường mức độ đa dạng tài sản và rủi ro dồn vốn vào một vài nhóm ngành...</span>
                    </div>
                    <div style={{ color: analysisStep >= 4 ? (analysisStep > 4 ? 'var(--color-bullish)' : 'var(--color-warning)') : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800 }}>{analysisStep > 4 ? '✓' : analysisStep === 4 ? '⚡' : '○'}</span>
                      <span>[BƯỚC 4/4] Đang biên soạn luận điểm đánh giá rủi ro từ chuyên gia cố vấn AI (GPT-4o)...</span>
                    </div>
                    {analysisStep === 5 && (
                      <div style={{ color: 'var(--color-accent)', fontWeight: 800, marginTop: '8px', fontSize: '14px' }}>
                        🎉 ĐÃ TẢI XONG: Bản phân tích danh mục và danh sách gợi ý cổ phiếu live đã sẵn sàng!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Content Layout */}
              {loadingPersonalization && !isAnalyzing ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <Loader2 className="spin" size={40} style={{ color: 'var(--color-accent)', margin: '0 auto 16px auto' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Đang truy vấn mô hình cá nhân hóa học sâu...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-inter">
                  
                  {/* Left Column: Portfolio Diversification Intelligence (7 columns on desktop) */}
                  <div className="lg:col-span-7 xl:col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* Portfolio overview and HHI analysis */}
                    <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <PieChart size={20} style={{ color: 'var(--color-accent)' }} />
                          <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 800 }}>
                            {portfolioIntel?.portfolioName || 'Danh mục Đầu tư Cá nhân'}
                          </h3>
                        </div>
                        <span className="badge" style={{ fontSize: '11px', padding: '3px 10px', background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}>
                          Khớp tài khoản thực tế
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ marginBottom: '20px' }}>
                        <div style={{
                          background: 'var(--bg-surface)',
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color-active)'
                        }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Tổng giá trị tài sản nắm giữ
                          </span>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-bullish)', marginTop: '4px', textShadow: '0 0 10px rgba(16,185,129,0.1)' }}>
                            {portfolioIntel?.totalValue ? portfolioIntel.totalValue.toLocaleString() : '174,000,000'} <span style={{ fontSize: '15px' }}>VND</span>
                          </div>
                        </div>

                        <div style={{
                          background: 'var(--bg-surface)',
                          padding: '16px 20px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color-active)'
                        }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Rủi ro tập trung (Chỉ số phân bổ)
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>
                              {portfolioIntel?.hhi || 5625} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>HHI</span>
                            </div>
                            <span className="badge" style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              fontWeight: 700,
                              background: portfolioIntel?.concentrationRating === 'DIVERSIFIED' 
                                ? 'rgba(16, 185, 129, 0.15)' 
                                : portfolioIntel?.concentrationRating === 'MODERATELY_CONCENTRATED'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                              color: portfolioIntel?.concentrationRating === 'DIVERSIFIED'
                                ? 'var(--color-bullish)'
                                : portfolioIntel?.concentrationRating === 'MODERATELY_CONCENTRATED'
                                ? 'var(--color-warning)'
                                : 'var(--color-bearish)',
                              border: `1px solid ${portfolioIntel?.concentrationRating === 'DIVERSIFIED' 
                                ? 'rgba(16, 185, 129, 0.3)' 
                                : portfolioIntel?.concentrationRating === 'MODERATELY_CONCENTRATED'
                                ? 'rgba(245, 158, 11, 0.3)'
                                : 'rgba(239, 68, 68, 0.3)'}`
                            }}>
                              {portfolioIntel?.concentrationLabel || 'Rủi ro tập trung cao'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Descriptive Layman explanatory subtext */}
                      <p style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)', 
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '10px 14px', 
                        borderRadius: 'var(--radius-sm)',
                        lineHeight: '1.5',
                        marginBottom: '24px'
                      }}>
                        💡 <strong>Chỉ số HHI:</strong> Thước đo mức độ tập trung vốn của bạn. Điểm càng nhỏ chứng tỏ vốn được chia đều sang nhiều ngành/cổ phiếu khác nhau (giảm thiểu rủi ro thua lỗ nặng khi một ngành rung lắc).
                      </p>

                      {/* HHI Visual Gauge Bar with caretaker */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                          <span>🟢 AN TOÀN (Phân bổ đều)</span>
                          <span>🟡 TRUNG BÌNH (Tập trung nhẹ)</span>
                          <span>🔴 RỦI RO CAO (Dồn vốn lớn)</span>
                        </div>
                        
                        {/* The Multi-zone Bar */}
                        <div style={{
                          height: '12px',
                          borderRadius: '6px',
                          background: 'linear-gradient(to right, #10b981 0%, #10b981 15%, #f59e0b 15%, #f59e0b 25%, #ef4444 25%, #ef4444 100%)',
                          position: 'relative',
                          overflow: 'visible',
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)'
                        }}>
                          {/* Caret Caretaker pointing to HHI */}
                          <div style={{
                            position: 'absolute',
                            left: `${Math.min(Math.max((portfolioIntel?.hhi || 5625) / 100, 2), 98)}%`,
                            top: '-8px',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            transition: 'left 1s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}>
                            <span style={{
                              color: '#fff',
                              fontSize: '14px',
                              textShadow: '0 0 8px rgba(255,255,255,0.8)',
                              lineHeight: 1
                            }}>▲</span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                          <span>0</span>
                          <span>1500</span>
                          <span>2500</span>
                          <span>10000 (Tuyệt đối)</span>
                        </div>
                      </div>
                    </div>

                    {/* Sector allocation list */}
                    <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                      <h4 className="font-outfit" style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Briefcase size={16} style={{ color: 'var(--color-accent)' }} />
                        Phân bổ tỷ trọng nhóm ngành thực tế
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {portfolioIntel?.allocation && portfolioIntel.allocation.length > 0 ? (
                          portfolioIntel.allocation.map((item: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {idx + 1}. {item.sector}
                                </span>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {item.value ? item.value.toLocaleString() : '---'} VND
                                  </span>
                                  <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>
                                    {item.percentage}%
                                  </span>
                                </div>
                              </div>
                              {/* Sleek Percentage Bar */}
                              <div style={{ height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  width: `${item.percentage}%`,
                                  background: 'linear-gradient(90deg, var(--color-accent) 0%, #3b82f6 100%)',
                                  borderRadius: '3px',
                                  transition: 'width 1s ease-in-out'
                                }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{
                            padding: '16px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            Chưa tìm thấy dữ liệu phân bổ nhóm ngành.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Advisor Thesis */}
                    <div className="glass-panel" style={{
                      padding: '24px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      background: 'linear-gradient(180deg, rgba(22, 28, 45, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                      boxShadow: '0 4px 24px rgba(245, 158, 11, 0.03)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Sparkles size={18} style={{ color: 'var(--color-warning)' }} />
                        <h4 className="font-outfit" style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.02em' }}>
                          Ý Kiến Tư Vấn Quản Trị Rủi Ro AI
                        </h4>
                      </div>
                      <p style={{ 
                        fontSize: '14px', 
                        lineHeight: '1.65', 
                        color: 'var(--text-primary)', 
                        fontStyle: 'italic',
                        whiteSpace: 'pre-wrap'
                      }}>
                        "{portfolioIntel?.thesis || 'Hệ thống AI Advisor đang quét danh mục tài sản nắm giữ để sinh luận điểm rủi ro. Hãy bấm nút Kích hoạt quét AI ở phía trên.'}"
                      </p>
                      
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        — Chứng nhận bởi OpenAI GPT-4o Risk Engine
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Personalized Feed (5 columns on desktop) */}
                  <div className="lg:col-span-5 xl:col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={18} style={{ color: 'var(--color-warning)' }} />
                        <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 800 }}>
                          Gợi ý cổ phiếu dành cho bạn
                        </h3>
                      </div>
                      <span className="badge" style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>
                        Đo khớp tối ưu
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              <div 
                                className="glass-panel"
                                style={{
                                  padding: '16px',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  background: 'var(--bg-surface)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border-color)';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                  <div>
                                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-accent)' }}>
                                      {item.symbol}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.name}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    {item.price !== null ? (
                                      <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                                        {item.price.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>---</span>
                                    )}
                                    {hasChange && (
                                      <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 800, 
                                        color: isUp ? 'var(--color-bullish)' : 'var(--color-bearish)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                      }}>
                                        {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                        {isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Linear score indicator */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                  <div style={{ flexGrow: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ 
                                      height: '100%', 
                                      width: `${item.score}%`, 
                                      background: 'linear-gradient(90deg, #a855f7 0%, var(--color-accent) 100%)' 
                                    }} />
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-warning)' }}>
                                    {Math.round(item.score)}% PHÙ HỢP
                                  </span>
                                </div>

                                {/* Matching Reason capsules */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: hasSignal ? '10px' : '0px' }}>
                                  {item.reasons && item.reasons.map((reason: string, rIdx: number) => {
                                    let icon = '⭐';
                                    let text = reason;
                                    if (reason === 'PORTFOLIO_HOLDING') { icon = '💼'; text = 'Trong danh mục'; }
                                    else if (reason === 'SECTOR_AFFINITY') { icon = '🎯'; text = 'Nhóm ngành ưu thích'; }
                                    else if (reason === 'SECTOR_CROSSOVER') { icon = '⚡'; text = 'Tín hiệu kỹ thuật tốt'; }
                                    else if (reason === 'POPULAR_MEMBER') { icon = '🔥'; text = 'Được xem nhiều'; }

                                    return (
                                      <span key={rIdx} style={{ 
                                        fontSize: '10px', 
                                        fontWeight: 700, 
                                        color: 'var(--text-secondary)',
                                        background: 'var(--bg-surface-hover)',
                                        border: '1px solid var(--border-color)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}>
                                        <span>{icon}</span> {text}
                                      </span>
                                    );
                                  })}
                                </div>

                                {/* Active AI signal if present */}
                                {hasSignal && (
                                  <div style={{ 
                                    marginTop: '8px', 
                                    background: isBuy ? 'var(--color-bullish-bg)' : 'var(--color-bearish-bg)',
                                    border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                                    padding: '8px 10px', 
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: isBuy ? 'var(--color-bullish)' : 'var(--color-bearish)'
                                  }}>
                                    <span style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      background: isBuy ? '#10b981' : '#ef4444',
                                      display: 'inline-block',
                                      animation: 'pulse 1.5s infinite'
                                    }}></span>
                                    AI: {item.latestSignal.type} ({item.latestSignal.indicator}) — Tín cậy: {Number(item.latestSignal.score || 0).toFixed(1)}
                                  </div>
                                )}
                              </div>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
    </div>
  );
}
