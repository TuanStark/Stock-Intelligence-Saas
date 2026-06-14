"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Bell, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

export interface AlertsTabProps {
  session: any;
  alertSymbol: string;
  setAlertSymbol: (symbol: string) => void;
  alertType: string;
  setAlertType: (type: string) => void;
  alertThreshold: string;
  setAlertThreshold: (threshold: string) => void;
  handleCreateAlert: (e: React.FormEvent) => Promise<void>;
  loadingAlerts: boolean;
  alertRules: any[];
  handleDeleteAlert: (id: string) => Promise<void>;
  alertEvents: any[];
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  session,
  alertSymbol,
  setAlertSymbol,
  alertType,
  setAlertType,
  alertThreshold,
  setAlertThreshold,
  handleCreateAlert,
  loadingAlerts,
  alertRules,
  handleDeleteAlert,
  alertEvents,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-outfit text-3xl font-extrabold tracking-tight mb-2 title-gradient">
          {t("alerts.title")}
        </h1>
        <p className="text-text-secondary text-sm">{t("alerts.description")}</p>
      </div>

      {!session ? (
        <div className="glass-panel p-10 text-center rounded-2xl border border-board-border max-w-md mx-auto">
          <Bell size={40} className="text-accent mx-auto mb-4" />
          <p className="text-text-secondary mb-5 text-sm">
            {t("alerts.loginPrompt")}
          </p>
          <Link href="/login?callbackUrl=/pricing">
            <button className="btn-primary py-2 px-5 text-sm">
              {t("common.login")}
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create rule form */}
          <div className="glass-panel font-inter p-6 rounded-2xl border border-board-border bg-board-bg h-fit lg:col-span-1">
            <h3 className="font-outfit text-base font-bold text-text-primary mb-5">
              {t("alerts.createRule")}
            </h3>

            <form onSubmit={handleCreateAlert} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {t("alerts.symbol")}
                </label>
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
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {t("alerts.type")}
                </label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none cursor-pointer focus:border-accent transition-colors"
                >
                  <option value="PRICE_ABOVE">{t("alerts.above")}</option>
                  <option value="PRICE_BELOW">{t("alerts.below")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  {t("alerts.threshold")}
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 85000"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="bg-surface border border-board-border rounded-lg py-2.5 px-4 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                />
              </div>

              <button
                type="submit"
                className="btn-primary py-3 font-bold text-sm mt-2 w-full justify-center"
              >
                {t("alerts.createBtn")}
              </button>
            </form>
          </div>

          {/* Rules and logs view */}
          <div className="flex flex-col gap-8 lg:col-span-2">
            {/* Rules section */}
            <div className="flex flex-col gap-4">
              <h3 className="font-outfit text-lg font-bold text-text-primary">
                {t("alerts.activeRules")}
              </h3>
              {loadingAlerts ? (
                <div className="flex py-6">
                  <Loader2 className="animate-spin text-accent" size={24} />
                </div>
              ) : alertRules.length === 0 ? (
                <div className="glass-panel p-6 text-text-muted text-sm rounded-2xl border border-board-border">
                  {t("alerts.noRules")}
                </div>
              ) : (
                <div className="glass-panel font-inter overflow-hidden rounded-2xl border border-board-border bg-board-bg">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-board-border text-text-muted">
                        <th className="p-3 px-4">{t("alerts.symbol")}</th>
                        <th className="p-3 px-4">{t("alerts.condition")}</th>
                        <th className="p-3 px-4">{t("alerts.threshold")}</th>
                        <th className="p-3 px-4">{t("common.status")}</th>
                        <th className="p-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {alertRules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-b border-board-border hover:bg-board-row-hover"
                        >
                          <td className="p-3 px-4 font-extrabold text-accent">
                            {rule.symbol}
                          </td>
                          <td className="p-3 px-4 font-semibold text-text-primary">
                            {rule.type === "PRICE_ABOVE"
                              ? "PRICE >= (ABOVE)"
                              : "PRICE <= (BELOW)"}
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
              <h3 className="font-outfit text-lg font-bold text-text-primary">
                {t("alerts.triggeredEvents")}
              </h3>
              {alertEvents.length === 0 ? (
                <div className="glass-panel p-6 text-text-muted text-sm rounded-2xl border border-board-border">
                  {t("alerts.noEvents")}
                </div>
              ) : (
                <div className="glass-panel font-inter overflow-hidden rounded-2xl border border-board-border bg-board-bg">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-board-border text-text-muted">
                        <th className="p-3 px-4">{t("alerts.symbol")}</th>
                        <th className="p-3 px-4">{t("alerts.condition")}</th>
                        <th className="p-3 px-4">{t("alerts.threshold")}</th>
                        <th className="p-3 px-4">{t("alerts.triggeredVal")}</th>
                        <th className="p-3 px-4">{t("alerts.triggeredAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertEvents.map((event) => (
                        <tr
                          key={event.id}
                          className="border-b border-board-border hover:bg-board-row-hover"
                        >
                          <td className="p-3 px-4 font-extrabold text-accent">
                            {event.symbol}
                          </td>
                          <td className="p-3 px-4 font-semibold text-text-primary">
                            {event.type === "PRICE_ABOVE"
                              ? "PRICE >= (ABOVE)"
                              : "PRICE <= (BELOW)"}
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
  );
};
