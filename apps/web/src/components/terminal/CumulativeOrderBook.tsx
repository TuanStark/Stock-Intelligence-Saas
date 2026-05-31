import React from 'react';
import { OrderBookRow } from '@/lib/hooks/useStockWebSocket';
import { formatCurrency } from '@/lib/helpers/price.helper';

interface CumulativeOrderBookProps {
  bids: OrderBookRow[];
  asks: OrderBookRow[];
  tc: number;
}

export const CumulativeOrderBook: React.FC<CumulativeOrderBookProps> = ({ bids, asks, tc }) => {
  const buyVolumeTotal = bids.reduce((acc, b) => acc + b.volume, 0);
  const sellVolumeTotal = asks.reduce((acc, a) => acc + a.volume, 0);
  const totalVolume = buyVolumeTotal + sellVolumeTotal || 1;
  const buyPercent = Math.round((buyVolumeTotal / totalVolume) * 100);

  return (
    <div className="flex flex-col bg-[#080b11] border border-white/5 rounded-xl overflow-hidden">
      {/* Visual Volume Ratio bar */}
      <div className="flex w-full text-[9px] font-bold text-white h-4.5 bg-[#151a24]/30 shrink-0">
        <div
          className="bg-emerald-500/70 transition-[width] duration-300 leading-3 pl-1.5 flex items-center"
          style={{ width: `${buyPercent}%` }}
        >
          Dư mua: {formatCurrency(buyVolumeTotal)}
        </div>
        <div
          className="bg-red-500/70 transition-[width] duration-300 leading-3 pr-1.5 text-right flex items-center justify-end"
          style={{ width: `${100 - buyPercent}%` }}
        >
          Dư bán: {formatCurrency(sellVolumeTotal)}
        </div>
      </div>

      {/* Bids/Asks depth table grid */}
      <div className="p-3">
        <table className="w-full text-[10.5px] border-collapse font-mono">
          <thead>
            <tr className="text-text-muted border-b border-[#151a24]/80 h-5 font-bold">
              <th className="text-left pb-0.5 font-bold uppercase text-[9px] w-2/5">KL</th>
              <th className="text-right pb-0.5 font-bold uppercase text-[9px] w-1/5 pr-1">Giá mua</th>
              <th className="text-left pb-0.5 font-bold uppercase text-[9px] w-1/5 pl-1">Giá bán</th>
              <th className="text-right pb-0.5 font-bold uppercase text-[9px] w-2/5">KL</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid, idx) => {
              const ask = asks[idx] || { price: 0, volume: 0, percentage: 0 };
              const bidPriceColor = bid.price > tc ? 'text-up' : bid.price < tc ? 'text-down' : 'text-ref';
              const askPriceColor = ask.price > tc ? 'text-up' : ask.price < tc ? 'text-down' : 'text-ref';

              return (
                <tr key={idx} className="h-6 hover:bg-white/2 transition-colors relative">
                  <td className="relative text-left text-white font-medium pl-1">
                    <div
                      className="absolute left-0 top-0.5 bottom-0.5 bg-emerald-500/10 rounded transition-[width] duration-300"
                      style={{ width: `${bid.percentage}%` }}
                    />
                    <span className="relative z-10">{formatCurrency(bid.volume)}</span>
                  </td>
                  
                  <td className={`${bidPriceColor} font-extrabold text-right pr-1 relative z-10`}>
                    {formatCurrency(bid.price)}
                  </td>

                  <td className={`${askPriceColor} font-extrabold text-left pl-1 relative z-10`}>
                    {formatCurrency(ask.price)}
                  </td>
                  
                  <td className="relative text-right text-white font-medium pr-1">
                    <div
                      className="absolute right-0 top-0.5 bottom-0.5 bg-red-500/10 rounded transition-[width] duration-300"
                      style={{ width: `${ask.percentage}%` }}
                    />
                    <span className="relative z-10">{formatCurrency(ask.volume)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual Depth Chart columns */}
      <div className="flex flex-col gap-2 p-3 bg-[#0c0f16]/30 border-t border-[#151a24]">
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
          Biểu đồ độ sâu thị trường
        </span>
        
        <div className="h-[120px] w-full flex items-end justify-between gap-1 px-2 pt-2 relative">
          {/* Bids volume bars */}
          <div className="flex-1 h-full flex items-end justify-end gap-1 border-r border-[#1a2233]/40 pr-1">
            {bids.slice().reverse().map((bid, i) => {
              const maxVolume = Math.max(...[...bids, ...asks].map(x => x.volume), 1);
              const h = (bid.volume / maxVolume) * 90;
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                  <div
                    style={{ height: `${h}%` }}
                    className="w-full bg-emerald-500/25 border border-emerald-500/40 rounded-t hover:bg-emerald-500/45 transition-all duration-150"
                  />
                  <span className="text-[8px] text-emerald-500 font-bold scale-90">{formatCurrency(bid.price)}</span>
                  
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#141923] border border-[#2d3748]/60 text-[8px] text-white p-1 rounded z-30 shadow-xl whitespace-nowrap">
                    Mua: {formatCurrency(bid.price)} | KL: {formatCurrency(bid.volume)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Asks volume bars */}
          <div className="flex-1 h-full flex items-end justify-start gap-1 pl-1">
            {asks.map((ask, i) => {
              const maxVolume = Math.max(...[...bids, ...asks].map(x => x.volume), 1);
              const h = (ask.volume / maxVolume) * 90;
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                  <div
                    style={{ height: `${h}%` }}
                    className="w-full bg-red-500/25 border border-red-500/40 rounded-t hover:bg-red-500/45 transition-all duration-150"
                  />
                  <span className="text-[8px] text-red-500 font-bold scale-90">{formatCurrency(ask.price)}</span>
                  
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#141923] border border-[#2d3748]/60 text-[8px] text-white p-1 rounded z-30 shadow-xl whitespace-nowrap">
                    Bán: {formatCurrency(ask.price)} | KL: {formatCurrency(ask.volume)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
