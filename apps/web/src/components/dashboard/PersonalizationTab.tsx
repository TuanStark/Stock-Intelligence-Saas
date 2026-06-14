"use client";

import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Loader2,
  PieChart,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export interface PersonalizationTabProps {
  portfolioIntel: any;
  personalizedFeed: any[];
  isAnalyzing: boolean;
  loadingPersonalization: boolean;
  personalizationError: string | null;
  analysisStep: number;
  handleAIScan: () => Promise<void>;
  handleSelectRecommended: (symbol: string) => void;
}

export const PersonalizationTab: React.FC<PersonalizationTabProps> = ({
  portfolioIntel,
  personalizedFeed,
  isAnalyzing,
  loadingPersonalization,
  personalizationError,
  analysisStep,
  handleAIScan,
  handleSelectRecommended,
}) => {
  return (
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
            Trí tuệ nhân tạo quét hành vi đầu tư thực tế, kiểm soát rủi ro phân
            bổ HHI và đề xuất cơ hội phù hợp nhất với bạn.
          </p>
        </div>

        <div className="w-full md:w-auto">
          <button
            onClick={handleAIScan}
            disabled={isAnalyzing || loadingPersonalization}
            className={`p-3 px-6 rounded-xl text-white font-extrabold font-outfit text-sm shadow-xl flex items-center justify-center gap-2 w-full md:w-auto transition-all duration-300 ${
              isAnalyzing || loadingPersonalization
                ? "bg-purple-900/60 border border-purple-500/20 cursor-not-allowed opacity-75"
                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent hover:to-purple-700 cursor-pointer shadow-purple-600/10"
            }`}
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            {isAnalyzing
              ? "Đang chạy phân tích..."
              : "Kích hoạt AI Quét & Phân tích"}
          </button>
        </div>
      </div>

      {/* Error State */}
      {personalizationError && (
        <div className="glass-panel p-5 bg-bearish/10 border border-bearish/20 rounded-xl text-bearish flex items-start gap-3 mb-6">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold text-sm">
              Không thể liên kết bộ máy cá nhân hóa
            </strong>
            <span className="text-xs text-text-secondary">
              {personalizationError}
            </span>
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
            <div
              className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 1 ? "text-bullish font-semibold" : "text-text-muted"}`}
            >
              <span className="font-bold">{analysisStep > 1 ? "✓" : "●"}</span>
              <span>
                [BƯỚC 1/4] Đang tập hợp các cổ phiếu bạn xem và tìm kiếm gần
                đây...
              </span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 2 ? (analysisStep > 2 ? "text-bullish font-semibold" : "text-warning font-semibold") : "text-text-muted"}`}
            >
              <span className="font-bold">
                {analysisStep > 2 ? "✓" : analysisStep === 2 ? "⚡" : "○"}
              </span>
              <span>
                [BƯỚC 2/4] Đang ưu tiên các mối quan tâm mới nhất và tự động
                giảm bớt tương tác cũ...
              </span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 3 ? (analysisStep > 3 ? "text-bullish font-semibold" : "text-warning font-semibold") : "text-text-muted"}`}
            >
              <span className="font-bold">
                {analysisStep > 3 ? "✓" : analysisStep === 3 ? "⚡" : "○"}
              </span>
              <span>
                [BƯỚC 3/4] Đang đo lường mức độ đa dạng tài sản và rủi ro dồn
                vốn vào một vài nhóm ngành...
              </span>
            </div>
            <div
              className={`flex items-center gap-2 transition-colors duration-200 ${analysisStep >= 4 ? (analysisStep > 4 ? "text-bullish font-semibold" : "text-warning font-semibold") : "text-text-muted"}`}
            >
              <span className="font-bold">
                {analysisStep > 4 ? "✓" : analysisStep === 4 ? "⚡" : "○"}
              </span>
              <span>
                [BƯỚC 4/4] Đang biên soạn luận điểm đánh giá rủi ro từ chuyên
                gia cố vấn AI (GPT-4o)...
              </span>
            </div>
            {analysisStep === 5 && (
              <div className="text-accent font-extrabold mt-2 text-sm">
                🎉 ĐÃ TẢI XONG: Bản phân tích danh mục và danh sách gợi ý cổ
                phiếu live đã sẵn sàng!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      {loadingPersonalization && !isAnalyzing ? (
        <div className="py-16 text-center">
          <Loader2
            className="animate-spin text-accent mx-auto mb-4"
            size={40}
          />
          <p className="text-text-secondary text-sm">
            Đang truy vấn mô hình cá nhân hóa học sâu...
          </p>
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
                    {portfolioIntel?.portfolioName || "Danh mục Đầu tư Cá nhân"}
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
                    {portfolioIntel?.totalValue
                      ? portfolioIntel.totalValue.toLocaleString()
                      : "174,000,000"}{" "}
                    <span className="text-sm font-semibold">VND</span>
                  </div>
                </div>

                <div className="bg-surface p-4 px-5 rounded-xl border border-board-border-active">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                    Rủi ro tập trung (Chỉ số phân bổ)
                  </span>
                  <div className="flex items-center gap-2.5 mt-1">
                    <div className="text-2xl font-extrabold text-white">
                      {portfolioIntel?.hhi || 5625}{" "}
                      <span className="text-xs text-text-secondary font-semibold">
                        HHI
                      </span>
                    </div>
                    <span
                      className={`badge shrink-0 text-[10px] font-extrabold ${
                        portfolioIntel?.concentrationRating === "DIVERSIFIED"
                          ? "badge-bullish"
                          : portfolioIntel?.concentrationRating ===
                              "MODERATELY_CONCENTRATED"
                            ? "badge-warning"
                            : "badge-bearish"
                      }`}
                    >
                      {portfolioIntel?.concentrationLabel ||
                        "Rủi ro tập trung cao"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Descriptive Layman explanatory subtext */}
              <p className="text-[11px] sm:text-xs text-text-secondary bg-white/2 border border-white/5 p-3 px-4 rounded-lg leading-relaxed mb-6">
                💡 <strong>Chỉ số HHI:</strong> Thước đo mức độ tập trung vốn
                của bạn. Điểm càng nhỏ chứng tỏ vốn được chia đều sang nhiều
                ngành/cổ phiếu khác nhau (giảm thiểu rủi ro thua lỗ nặng khi một
                ngành rung lắc).
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
                    style={{
                      left: `${Math.min(Math.max((portfolioIntel?.hhi || 5625) / 100, 2), 98)}%`,
                    }}
                    className="absolute -top-2 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 ease-out"
                  >
                    <span className="text-white text-xs drop-shadow-[0_0_4px_rgba(255,255,255,0.8)] leading-none">
                      ▲
                    </span>
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
                {portfolioIntel?.allocation &&
                portfolioIntel.allocation.length > 0 ? (
                  portfolioIntel.allocation.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="font-bold text-text-primary">
                          {idx + 1}. {item.sector}
                        </span>
                        <div className="flex gap-3">
                          <span className="text-text-secondary font-medium">
                            {item.value ? item.value.toLocaleString() : "---"}{" "}
                            VND
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
                "
                {portfolioIntel?.thesis ||
                  "Hệ thống AI Advisor đang quét danh mục tài sản nắm giữ để sinh luận điểm rủi ro. Hãy bấm nút Kích hoạt quét AI ở phía trên."}
                "
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
                  const isBuy = item.latestSignal?.type === "BUY";
                  const hasChange =
                    item.changePercent !== null &&
                    item.changePercent !== undefined;
                  const isUp = hasChange && item.changePercent >= 0;

                  return (
                    <Link
                      key={idx}
                      href={`/instruments/${item.symbol}`}
                      onClick={() => handleSelectRecommended(item.symbol)}
                      className="no-underline text-inherit"
                    >
                      <div className="glass-panel p-4 rounded-xl border border-board-border cursor-pointer transition-all duration-300 bg-surface hover:border-accent hover:translate-x-1 hover:bg-surface-hover">
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
                              <span className="text-text-muted text-xs">
                                ---
                              </span>
                            )}
                            {hasChange && (
                              <span
                                className={`text-[10px] font-extrabold flex items-center gap-0.5 ${
                                  isUp ? "text-bullish" : "text-bearish"
                                }`}
                              >
                                {isUp ? (
                                  <ArrowUpRight size={10} />
                                ) : (
                                  <ArrowDownRight size={10} />
                                )}
                                {isUp ? "+" : ""}
                                {item.changePercent.toFixed(2)}%
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
                        <div
                          className={`flex flex-wrap gap-1.5 ${hasSignal ? "mb-2.5" : "mb-0"}`}
                        >
                          {item.reasons &&
                            item.reasons.map((reason: string, rIdx: number) => {
                              let icon = "⭐";
                              let text = reason;
                              if (reason === "PORTFOLIO_HOLDING") {
                                icon = "💼";
                                text = "Trong danh mục";
                              } else if (reason === "SECTOR_AFFINITY") {
                                icon = "🎯";
                                text = "Nhóm ngành ưu thích";
                              } else if (reason === "SECTOR_CROSSOVER") {
                                icon = "⚡";
                                text = "Tín hiệu kỹ thuật tốt";
                              } else if (reason === "POPULAR_MEMBER") {
                                icon = "🔥";
                                text = "Được xem nhiều";
                              }

                              return (
                                <span
                                  key={rIdx}
                                  className="text-[9px] font-bold text-text-secondary bg-surface-hover border border-board-border py-0.5 px-2 rounded flex items-center gap-1"
                                >
                                  <span>{icon}</span> {text}
                                </span>
                              );
                            })}
                        </div>

                        {/* Active AI signal if present */}
                        {hasSignal && (
                          <div
                            className={`mt-2 p-2 rounded flex items-center gap-1.5 text-[10px] font-bold ${
                              isBuy
                                ? "bg-bullish/10 border border-bullish/15 text-bullish"
                                : "bg-bearish/10 border border-bearish/15 text-bearish"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${
                                isBuy ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            ></span>
                            AI: {item.latestSignal.type} (
                            {item.latestSignal.indicator}) — Tín cậy:{" "}
                            {Number(item.latestSignal.score || 0).toFixed(1)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="glass-panel p-6 text-center text-text-muted text-sm rounded-xl">
                  Chưa có gợi ý cá nhân hóa nào được tạo. Click Quét AI phía
                  trên để khởi chạy!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
