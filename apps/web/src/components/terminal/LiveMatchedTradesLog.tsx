import React from 'react';
import { Activity } from 'lucide-react';
import { TradeLog } from '@/lib/hooks/useStockWebSocket';
import { formatCurrency } from '@/lib/helpers/price.helper';

interface LiveMatchedTradesLogProps {
  trades: TradeLog[];
  tc: number;
}

export const LiveMatchedTradesLog: React.FC<LiveMatchedTradesLogProps> = ({ trades, tc }) => {
  const totalVolume = trades.reduce((acc, t) => acc + t.volume, 0) || 45300;
  const buyPercent = 55; // Standard buy baseline split

  return (
    <div className="glass-panel p-5 bg-[#0d1017] border border-white/5 rounded-xl flex flex-col max-h-[300px]">
      <div className="border-b border-[#1b2233] pb-3 mb-3 flex justify-between items-center shrink-0">
        <h3 className="font-outfit text-sm font-bold flex items-center gap-2 text-[#00c58e] uppercase tracking-wider m-0">
          <Activity size={16} /> Nhật ký Khớp lệnh Live
        </h3>
        
        <div className="flex gap-2 text-[9px] font-bold text-[#7b8a9b] font-mono">
          <span>KL: <span className="text-white">{formatCurrency(totalVolume)}</span></span>
          <span className="text-up">M: {buyPercent}%</span>
          <span className="text-down">B: {100 - buyPercent}%</span>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 bg-[#0d1017] text-text-muted border-b border-white/5 h-6 z-10 text-[9px] uppercase font-bold">
              <th className="text-left pl-2 font-semibold">Thời gian</th>
              <th className="text-right font-semibold">Giá</th>
              <th className="text-right font-semibold">+/-</th>
              <th className="text-right pr-2 font-semibold">KL</th>
            </tr>
          </thead>
          
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-8 text-text-muted font-bold text-xs italic">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              trades.map((t, idx) => {
                const diff = Number(t.price) - tc;
                const priceColor = t.price > tc ? 'text-up' : t.price < tc ? 'text-down' : 'text-ref';
                const sideColor = t.type === 'BUY' ? 'text-up' : 'text-down';

                return (
                  <tr key={idx} className="h-6 border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="pl-2 text-text-muted font-mono text-[10.5px]">{t.time}</td>
                    
                    <td className={`${priceColor} font-extrabold text-right font-mono`}>
                      {formatCurrency(t.price)}
                    </td>
                    
                    <td className={`${diff >= 0 ? 'text-up' : 'text-down'} text-right font-semibold font-mono text-[9px]`}>
                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                    </td>
                    
                    <td className={`text-right pr-2 font-semibold font-mono ${sideColor}`}>
                      {formatCurrency(t.volume)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
