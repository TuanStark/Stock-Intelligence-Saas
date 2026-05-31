'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { signOut } from 'next-auth/react';
import {
  TrendingUp,
  Bookmark,
  Sparkles,
  Bell,
  Building2,
  LogOut,
  LogIn,
  X,
  Menu
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export type SidebarTab = 'dashboard' | 'watchlist' | 'signals' | 'alerts' | 'personalization';

export interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  user: any;
  userTier: string;
}

interface MenuItem {
  id: SidebarTab | 'pricing';
  labelKey?: string;
  fallbackLabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isLink?: boolean;
  href?: string;
  iconColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  user,
  userTier
}) => {
  const { t, locale, setLocale } = useTranslation();

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      labelKey: 'sidebar.dashboard',
      icon: TrendingUp
    },
    {
      id: 'watchlist',
      labelKey: 'sidebar.watchlist',
      icon: Bookmark
    },
    {
      id: 'signals',
      labelKey: 'sidebar.signals',
      icon: Sparkles
    },
    {
      id: 'alerts',
      labelKey: 'sidebar.alerts',
      icon: Bell
    },
    {
      id: 'personalization',
      fallbackLabel: 'Phân tích AI & Gợi ý',
      icon: Sparkles,
      iconColor: 'text-warning'
    },
    {
      id: 'pricing',
      labelKey: 'sidebar.pricing',
      icon: Building2,
      isLink: true,
      href: '/pricing'
    }
  ];

  return (
    <>
      {/* Sidebar Mobile Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside
        className={`sidebar-transition group fixed top-0 bottom-0 left-0 flex flex-col z-50 rounded-none border-r border-board-border bg-[#090b11] -translate-x-[320px] md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : ''
        } ${
          isSidebarCollapsed
            ? 'w-[70px] hover:w-[260px] p-3 hover:p-6'
            : 'w-[260px] p-6'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-2.5 mb-10 overflow-hidden shrink-0">
          <img src="/logo-new.png" alt="StockIntel Logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <h2
            className={`font-outfit text-lg font-extrabold tracking-tight transition-opacity duration-200 ${
              isSidebarCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block' : 'opacity-100 block'
            }`}
          >
            STOCK<span className="text-accent">INTEL</span>
          </h2>
        </div>

        {/* Tab Buttons */}
        <nav className="flex flex-col gap-2 flex-grow overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const label = item.labelKey ? t(item.labelKey) : (item.fallbackLabel || '');
            const isActive = activeTab === item.id;

            if (item.isLink && item.href) {
              return (
                <Link key={item.id} href={item.href} className="no-underline">
                  <button
                    className={`flex items-center gap-3 w-full py-3 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 bg-transparent text-text-secondary hover:bg-surface-hover hover:text-accent w-full ${
                      isSidebarCollapsed ? 'px-3.5 group-hover:px-4' : 'px-4'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span
                      className={
                        isSidebarCollapsed
                          ? 'opacity-0 group-hover:opacity-100 hidden group-hover:inline truncate'
                          : 'opacity-100 inline'
                      }
                    >
                      {label}
                    </span>
                  </button>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as SidebarTab);
                  setIsSidebarOpen(false);
                }}
                className={`flex items-center gap-3 w-full py-3 border-0 rounded-lg font-outfit font-semibold text-sm cursor-pointer text-left transition-all duration-200 ${
                  isSidebarCollapsed ? 'px-3.5 group-hover:px-4' : 'px-4'
                } ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <Icon size={18} className={`shrink-0 ${item.iconColor || ''}`} />
                <span
                  className={
                    isSidebarCollapsed
                      ? 'opacity-0 group-hover:opacity-100 hidden group-hover:inline truncate'
                      : 'opacity-100 inline'
                  }
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Dynamic Locale Selector */}
        <div
          className={`flex gap-2 mb-4 justify-center items-center shrink-0 ${
            isSidebarCollapsed ? 'flex-col group-hover:flex-row' : 'flex-row'
          }`}
        >
          <button
            onClick={() => setLocale('vi')}
            className="py-1 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer transition-colors border border-board-border bg-transparent text-text-secondary hover:text-text-primary"
            style={
              locale === 'vi'
                ? {
                    borderColor: 'var(--color-accent)',
                    backgroundColor: 'var(--color-surface-hover)',
                    color: 'var(--color-accent)'
                  }
                : {}
            }
          >
            VI
          </button>
          <button
            onClick={() => setLocale('en')}
            className="py-1 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer transition-colors border border-board-border bg-transparent text-text-secondary hover:text-text-primary"
            style={
              locale === 'en'
                ? {
                    borderColor: 'var(--color-accent)',
                    backgroundColor: 'var(--color-surface-hover)',
                    color: 'var(--color-accent)'
                  }
                : {}
            }
          >
            EN
          </button>
        </div>

        {/* User profile footer */}
        <div className={`glass-panel rounded-lg border border-board-border text-xs shrink-0 overflow-hidden transition-all duration-200 ${
          isSidebarCollapsed ? 'p-2 group-hover:p-4' : 'p-4'
        }`}>
          {user ? (
            <div className="flex flex-col gap-2">
              {/* Collapsed Mode - Avatar + Hover Expand */}
              <div
                className={`flex items-center gap-3 group-hover:gap-3 transition-all duration-200 ${
                  isSidebarCollapsed ? 'justify-center' : 'justify-start'
                }`}
              >
                {/* Avatar */}
                <div className="w-7 h-7 bg-accent/20 text-accent font-bold flex items-center justify-center shrink-0 text-lg transition-transform group-hover:scale-110">
                  <Image src={user.image || ''} alt="Avatar" width={28} height={28} className="rounded-full" />
                </div>

                {/* User Info - Hidden when collapsed, shows on hover */}
                <div
                  className={`flex-1 overflow-hidden transition-all duration-200 ${
                    isSidebarCollapsed
                      ? 'max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100'
                      : 'max-w-full opacity-100'
                  }`}
                >
                  <div className="font-semibold text-sm truncate">{user.email}</div>
                </div>
              </div>

              {/* Tier + Logout */}
              <div
                className={`flex items-center justify-between transition-all duration-200 ${
                  isSidebarCollapsed
                    ? 'max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 overflow-hidden'
                    : 'max-h-10 opacity-100'
                }`}
              >
                <span className="badge badge-bullish text-[10px] py-0.5 px-2">{userTier}</span>

                <button
                  onClick={() => signOut()}
                  className="bg-transparent border-none text-bearish hover:text-red-400 cursor-pointer flex items-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <LogOut size={14} />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Guest Mode */
            <div className="flex flex-col gap-2 text-center items-center justify-center">
              <span
                className={`text-text-secondary font-semibold transition-opacity text-xs truncate w-full ${
                  isSidebarCollapsed ? 'opacity-0 group-hover:opacity-100 hidden group-hover:block' : 'opacity-100 block'
                }`}
              >
                {t('sidebar.guestUser')}
              </span>

              <Link href="/login" className="no-underline w-full">
                <button
                  className="btn-primary py-1.5 text-xs w-full flex items-center justify-center gap-2 transition-all"
                  title={t('common.login')}
                >
                  <LogIn size={14} className="shrink-0" />
                  <span
                    className={
                      isSidebarCollapsed
                        ? 'opacity-0 group-hover:opacity-100 hidden group-hover:inline truncate'
                        : 'opacity-100 inline'
                    }
                  >
                    {t('common.login')}
                  </span>
                </button>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
