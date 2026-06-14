"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Bookmark, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export interface WatchlistTabProps {
  loadingWatchlist: boolean;
  watchlistItems: any[];
  watchlistInput: string;
  setWatchlistInput: (val: string) => void;
  handleAddWatchlist: (e: React.FormEvent) => Promise<void>;
  handleRemoveWatchlist: (symbol: string) => Promise<void>;
  setSelectedSymbol: (symbol: string | null) => void;
  setIsModalOpen: (open: boolean) => void;
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({
  loadingWatchlist,
  watchlistItems,
  watchlistInput,
  setWatchlistInput,
  handleAddWatchlist,
  handleRemoveWatchlist,
  setSelectedSymbol,
  setIsModalOpen,
}) => {
  const { t, locale } = useTranslation();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
          {t("watchlist.title")}
        </h1>
        <p className="text-text-secondary text-sm">
          {t("watchlist.description")}
        </p>
      </div>

      {/* Add Symbol Bar */}
      <form onSubmit={handleAddWatchlist} className="flex gap-3 max-w-lg mb-8">
        <input
          type="text"
          placeholder={t("watchlist.symbolPlaceholder")}
          value={watchlistInput}
          onChange={(e) => setWatchlistInput(e.target.value)}
          className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none flex-grow focus:border-accent transition-colors"
        />
        <button
          type="submit"
          className="btn-primary py-2.5 px-5 text-sm flex items-center gap-1.5 shrink-0"
        >
          <Plus size={16} />
          {t("watchlist.addBtn")}
        </button>
      </form>

      {loadingWatchlist ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      ) : watchlistItems.length === 0 ? (
        <div className="glass-panel py-16 text-center rounded-2xl border border-board-border max-w-xl mx-auto">
          <Bookmark size={40} className="text-accent mx-auto mb-4" />
          <h3 className="font-outfit text-lg font-extrabold text-text-primary mb-2">
            {t("watchlist.emptyTitle")}
          </h3>
          <p className="text-text-secondary max-w-md mx-auto text-sm leading-relaxed px-4">
            {t("watchlist.emptyDesc")}
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

                <Link
                  href={`/instruments/${item.instrument.symbol}`}
                  className="no-underline text-inherit"
                >
                  <div className="flex items-center gap-2 mb-3.5 pr-6">
                    <span className="font-outfit text-lg font-extrabold text-text-primary">
                      {item.instrument.symbol}
                    </span>
                    <span className="text-xs text-text-muted truncate max-w-[120px]">
                      {item.instrument.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-outfit text-xl font-extrabold text-text-primary m-0">
                        {item.instrument.price.toLocaleString(
                          locale === "vi" ? "vi-VN" : "en-US",
                        )}{" "}
                        <span className="text-[10px] text-text-muted">VND</span>
                      </p>
                    </div>
                    <span
                      className={`badge ${isUp ? "badge-bullish" : "badge-bearish"}`}
                    >
                      {isUp ? "+" : ""}
                      {(item.instrument.changePercent * 100).toFixed(2)}%
                    </span>
                  </div>

                  {item.instrument.latestSignal && (
                    <div
                      className={`mt-4 py-2 px-3 rounded-lg text-xs font-semibold ${
                        item.instrument.latestSignal.type === "BUY"
                          ? "bg-bullish/10 text-bullish border border-bullish/20"
                          : "bg-bearish/10 text-bearish border border-bearish/20"
                      }`}
                    >
                      {t("sidebar.signals")}:{" "}
                      {item.instrument.latestSignal.type} (Score:{" "}
                      {Number(item.instrument.latestSignal.score || 0).toFixed(
                        1,
                      )}
                      )
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
