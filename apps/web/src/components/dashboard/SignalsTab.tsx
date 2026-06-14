"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

export interface SignalsTabProps {
  loadingAllSignals: boolean;
  allSignals: any[];
  signalTypeFilter: "ALL" | "BUY" | "SELL";
  setSignalTypeFilter: (filter: "ALL" | "BUY" | "SELL") => void;
}

export const SignalsTab: React.FC<SignalsTabProps> = ({
  loadingAllSignals,
  allSignals,
  signalTypeFilter,
  setSignalTypeFilter,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
          {t("signals.title")}
        </h1>
        <p className="text-text-secondary text-sm">
          {t("signals.description")}
        </p>
      </div>

      {/* Signals Type Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["ALL", "BUY", "SELL"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setSignalTypeFilter(filter)}
            className={`py-2 px-4 rounded-lg border font-semibold text-xs cursor-pointer transition-all duration-200 ${
              signalTypeFilter === filter
                ? "border-accent bg-accent/15 text-accent shadow-md"
                : "border-board-border bg-transparent text-text-secondary hover:text-text-primary hover:border-text-muted"
            }`}
          >
            {filter === "ALL"
              ? t("signals.filterAll")
              : filter === "BUY"
                ? t("signals.filterBuy")
                : t("signals.filterSell")}
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
          <p>{t("signals.noSignals")}</p>
        </div>
      ) : (
        <div className="glass-panel font-inter overflow-x-auto rounded-2xl border border-board-border bg-board-bg">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-board-border text-text-muted font-bold text-xs uppercase tracking-wider">
                <th className="p-4 px-6">{t("signals.tableSymbol")}</th>
                <th className="p-4 px-6">{t("signals.tableType")}</th>
                <th className="p-4 px-6">{t("signals.tableIndicator")}</th>
                <th className="p-4 px-6">{t("signals.tableStrength")}</th>
                <th className="p-4 px-6">{t("signals.tableScore")}</th>
                <th className="p-4 px-6">{t("signals.tableExplanation")}</th>
                <th className="p-4 px-6">{t("signals.tableTime")}</th>
              </tr>
            </thead>
            <tbody>
              {allSignals.map((signal) => {
                const isBuy = signal.type === "BUY";
                return (
                  <tr
                    key={signal.id}
                    className="border-b border-board-border hover:bg-board-row-hover transition-colors"
                  >
                    <td className="p-4 px-6">
                      <Link
                        href={`/instruments/${signal.symbol}`}
                        className="text-accent font-extrabold hover:underline"
                      >
                        {signal.symbol}
                      </Link>
                    </td>
                    <td className="p-4 px-6">
                      <span
                        className={`badge ${isBuy ? "badge-bullish" : "badge-bearish"} text-[11px]`}
                      >
                        {signal.type}
                      </span>
                    </td>
                    <td className="p-4 px-6 font-semibold text-text-primary">
                      {signal.indicator}
                    </td>
                    <td className="p-4 px-6">
                      <span
                        className={`font-bold text-xs ${
                          signal.strength === "HIGH"
                            ? "text-bullish"
                            : signal.strength === "MEDIUM"
                              ? "text-warning"
                              : "text-text-muted"
                        }`}
                      >
                        {signal.strength === "HIGH"
                          ? t("signals.strengthHigh")
                          : signal.strength === "MEDIUM"
                            ? t("signals.strengthMedium")
                            : t("signals.strengthLow")}
                      </span>
                    </td>
                    <td className="p-4 px-6 font-bold text-text-primary">
                      {Number(signal.score || 0).toFixed(2)}
                    </td>
                    <td
                      className="p-4 px-6 text-text-secondary max-w-[280px] truncate"
                      title={signal.reason}
                    >
                      {signal.reason}
                    </td>
                    <td className="p-4 px-6 text-text-muted text-xs">
                      {new Date(signal.detectedAt).toLocaleDateString()}{" "}
                      {new Date(signal.detectedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
