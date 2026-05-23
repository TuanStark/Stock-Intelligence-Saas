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
  X
} from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';

// Centralized Axios API Helpers
import { marketApi } from '@/lib/api/market.api';
import { watchlistApi } from '@/lib/api/watchlist.api';
import { alertApi } from '@/lib/api/alert.api';

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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'signals' | 'alerts'>('dashboard');
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

        </div>
      </main>
    </div>
  );
}
