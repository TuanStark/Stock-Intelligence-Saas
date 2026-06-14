"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Loader2 } from "lucide-react";

export type BoardMarketTabType =
  | "VN30"
  | "HOSE"
  | "HNX"
  | "UPCOM"
  | "WATCHLIST";

export interface TradingBoardProps {
  loadingData: boolean;
  boardMarketTab: BoardMarketTabType;
  setBoardMarketTab: (tab: BoardMarketTabType) => void;
  watchlistItems: any[];
  getFilteredMoverList: () => any[];
  flashingSymbols: Record<string, "up" | "down" | "">;
  setSelectedSymbol: (symbol: string | null) => void;
  setIsModalOpen: (open: boolean) => void;
  handleRemoveWatchlist: (symbol: string) => Promise<void>;
  handleAddWatchlistFromSymbol: (symbol: string) => Promise<void>;
  setAlertSymbol: (symbol: string) => void;
  setAlertThreshold: (threshold: string) => void;
  setActiveTab: (tab: any) => void;
  errorMsg: string | null;
}

export const TradingBoard: React.FC<TradingBoardProps> = ({
  loadingData,
  boardMarketTab,
  setBoardMarketTab,
  watchlistItems,
  getFilteredMoverList,
  flashingSymbols,
  setSelectedSymbol,
  setIsModalOpen,
  handleRemoveWatchlist,
  handleAddWatchlistFromSymbol,
  setAlertSymbol,
  setAlertThreshold,
  setActiveTab,
  errorMsg,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 px-5 bg-bearish/10 border border-bearish/25 rounded-lg text-bearish text-sm mb-6 font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Board Group tabs */}
        <div className="flex gap-1.5 bg-[#0e121a] p-1 rounded-lg border border-board-border">
          {(
            [
              { key: "VN30", label: "VN30" },
              { key: "HOSE", label: "HOSE" },
              { key: "HNX", label: "HNX" },
              { key: "UPCOM", label: "UPCOM" },
              { key: "WATCHLIST", label: "BẢNG DANH MỤC" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setBoardMarketTab(tab.key)}
              className={`py-1.5 px-3 rounded text-[11px] font-bold font-outfit border-0 cursor-pointer transition-all duration-200 ${
                boardMarketTab === tab.key
                  ? "bg-accent/25 text-accent shadow-md"
                  : "bg-transparent text-text-muted hover:text-white hover:bg-white/2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-text-muted font-bold font-outfit">
          Hiển thị:{" "}
          <span className="text-white">
            {boardMarketTab === "WATCHLIST"
              ? `${watchlistItems.length} mã theo dõi`
              : `${getFilteredMoverList().length} mã thị trường`}
          </span>
        </div>
      </div>

      {/* iBoard Full-Width Trading Grid */}
      <div className="w-full flex flex-col gap-5">
        {loadingData ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-accent" />
          </div>
        ) : getFilteredMoverList().length === 0 ? (
          <div className="glass-panel py-16 text-center text-text-muted text-xs">
            {boardMarketTab === "WATCHLIST"
              ? "Danh mục theo dõi của bạn đang trống. Chọn thêm các mã như FPT, HPG để theo dõi!"
              : "Không có dữ liệu cổ phiếu cho nhóm này."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-board shadow-2xl bg-board-bg w-full">
            <table className="iboard-table w-full min-w-[950px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="text-left pl-3">
                    Mã CK
                  </th>
                  <th rowSpan={2}>Trần</th>
                  <th rowSpan={2}>Sàn</th>
                  <th rowSpan={2}>TC</th>
                  <th colSpan={6} className="bg-bullish/5">
                    Bên mua
                  </th>
                  <th colSpan={3} className="bg-white/5">
                    Khớp lệnh
                  </th>
                  <th colSpan={6} className="bg-bearish/5">
                    Bên bán
                  </th>
                  <th rowSpan={2}>Tổng KL</th>
                  <th colSpan={2} className="bg-accent/5 pr-3">
                    ĐTNN
                  </th>
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
                  <th className="bg-accent/3 text-[9px]">Mua</th>
                  <th className="bg-accent/3 pr-3 text-[9px]">Bán</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredMoverList().map((mover) => {
                  const isUp = mover.changePercent >= 0;
                  const tc = Math.round(
                    Number(mover.price) - Number(mover.change),
                  );
                  const tran = Math.round(tc * 1.07);
                  const san = Math.round(tc * 0.93);

                  const flashClass =
                    flashingSymbols[mover.symbol] === "up"
                      ? "animate-flash-up"
                      : flashingSymbols[mover.symbol] === "down"
                        ? "animate-flash-down"
                        : "";

                  const currentPrice = Number(mover.price);
                  const priceColor =
                    currentPrice > tc
                      ? "text-up"
                      : currentPrice < tc
                        ? "text-down"
                        : "text-ref";

                  const bid1Price = Math.round(currentPrice - 50);
                  const bid1Vol = Math.floor(
                    18000 + (currentPrice % 300) * 100,
                  );
                  const bid2Price = Math.round(currentPrice - 100);
                  const bid2Vol = Math.floor(
                    12000 + (currentPrice % 400) * 100,
                  );
                  const bid3Price = Math.round(currentPrice - 150);
                  const bid3Vol = Math.floor(8000 + (currentPrice % 500) * 100);

                  const ask1Price = Math.round(currentPrice + 50);
                  const ask1Vol = Math.floor(
                    16000 + (currentPrice % 300) * 100,
                  );
                  const ask2Price = Math.round(currentPrice + 100);
                  const ask2Vol = Math.floor(
                    11000 + (currentPrice % 400) * 100,
                  );
                  const ask3Price = Math.round(currentPrice + 150);
                  const ask3Vol = Math.floor(7000 + (currentPrice % 500) * 100);

                  const totalVolume = Math.floor(
                    500000 + (currentPrice % 500) * 6200,
                  );

                  // Mock Foreigner transactions
                  const forBuy = Math.floor(500 + (currentPrice % 37) * 250);
                  const forSell = Math.floor(200 + (currentPrice % 17) * 150);

                  return (
                    <tr
                      key={mover.symbol}
                      onClick={() => {
                        setSelectedSymbol(mover.symbol);
                        setIsModalOpen(true);
                      }}
                      className="cursor-pointer group/row"
                    >
                      <td className="text-left font-extrabold pl-3 text-text-primary group-hover/row:text-accent relative min-w-[100px]">
                        <div className="flex items-center justify-between">
                          <span>★ {mover.symbol}</span>
                          {/* Quick floating Actions Box */}
                          <div className="hidden group-hover/row:flex items-center gap-1 absolute left-14 bg-board-bg/95 border border-board-border rounded p-0.5 z-20 shadow-xl">
                            <button
                              title="Phân tích chi tiết"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSymbol(mover.symbol);
                                setIsModalOpen(true);
                              }}
                              className="bg-transparent border-0 text-accent hover:text-white cursor-pointer px-1 py-0.5 text-[10px]"
                            >
                              🔍
                            </button>
                            <button
                              title="Thêm/Xóa danh mục theo dõi"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const inWatchlist = watchlistItems.some(
                                  (item) =>
                                    item.instrument.symbol === mover.symbol,
                                );
                                if (inWatchlist) {
                                  await handleRemoveWatchlist(mover.symbol);
                                } else {
                                  await handleAddWatchlistFromSymbol(
                                    mover.symbol,
                                  );
                                }
                              }}
                              className={`bg-transparent border-0 cursor-pointer px-1 py-0.5 text-[10px] ${
                                watchlistItems.some(
                                  (item) =>
                                    item.instrument.symbol === mover.symbol,
                                )
                                  ? "text-yellow-500"
                                  : "text-text-muted hover:text-yellow-500"
                              }`}
                            >
                              {watchlistItems.some(
                                (item) =>
                                  item.instrument.symbol === mover.symbol,
                              )
                                ? "★"
                                : "☆"}
                            </button>
                            <button
                              title="Thiết lập cảnh báo giá"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlertSymbol(mover.symbol);
                                setAlertThreshold(mover.price.toString());
                                setActiveTab("alerts");
                              }}
                              className="bg-transparent border-0 text-warning hover:text-white cursor-pointer px-1 py-0.5 text-[10px]"
                            >
                              🔔
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="text-ceil font-bold">
                        {tran.toLocaleString()}
                      </td>
                      <td className="text-floor font-bold">
                        {san.toLocaleString()}
                      </td>
                      <td className="text-ref font-bold">
                        {tc.toLocaleString()}
                      </td>

                      <td
                        className={
                          bid3Price > tc
                            ? "text-up"
                            : bid3Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {bid3Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {bid3Vol.toLocaleString()}
                      </td>
                      <td
                        className={
                          bid2Price > tc
                            ? "text-up"
                            : bid2Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {bid2Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {bid2Vol.toLocaleString()}
                      </td>
                      <td
                        className={
                          bid1Price > tc
                            ? "text-up"
                            : bid1Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {bid1Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {bid1Vol.toLocaleString()}
                      </td>

                      <td
                        className={`${priceColor} ${flashClass} font-extrabold bg-white/2`}
                      >
                        {currentPrice.toLocaleString()}
                      </td>
                      <td className="font-semibold text-text-primary text-[10px]">
                        {Math.floor(
                          50 + (currentPrice % 10) * 50,
                        ).toLocaleString()}
                      </td>
                      <td className={`${priceColor} font-bold`}>
                        {isUp ? "+" : ""}
                        {Number(mover.change).toLocaleString()}
                      </td>

                      <td
                        className={
                          ask1Price > tc
                            ? "text-up"
                            : ask1Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {ask1Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {ask1Vol.toLocaleString()}
                      </td>
                      <td
                        className={
                          ask2Price > tc
                            ? "text-up"
                            : ask2Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {ask2Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {ask2Vol.toLocaleString()}
                      </td>
                      <td
                        className={
                          ask3Price > tc
                            ? "text-up"
                            : ask3Price < tc
                              ? "text-down"
                              : "text-ref"
                        }
                      >
                        {ask3Price.toLocaleString()}
                      </td>
                      <td className="text-text-muted/65">
                        {ask3Vol.toLocaleString()}
                      </td>

                      <td className="font-bold text-text-primary">
                        {totalVolume.toLocaleString()}
                      </td>

                      <td className="text-up/90 text-[10.5px]">
                        {forBuy.toLocaleString()}
                      </td>
                      <td className="text-down/90 pr-3 text-[10.5px]">
                        {forSell.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
