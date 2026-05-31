import React from 'react';
import { DollarSign } from 'lucide-react';
import { Quote } from '@/lib/hooks/useStockDetailData';
import { formatCurrency } from '@/lib/helpers/price.helper';

interface MarketFundamentalsProps {
  latestQuote: Quote | null;
  tc: number;
}

export const MarketFundamentals: React.FC<MarketFundamentalsProps> = ({ latestQuote, tc }) => {
  if (!latestQuote) return null;

  return (
    <div className="glass-panel p-5 bg-[#0d1017] border border-white/5 rounded-xl">
      <h3 className="font-outfit text-sm font-bold flex items-center gap-2 border-b border-[#1b2233] pb-3 mb-4 text-[#00c58e] uppercase tracking-wider m-0">
        <DollarSign size={16} />
        Thống kê tài chính & Biên độ giao dịch
      </h3>
      
      <div className="flex flex-col gap-3 font-mono text-xs md:text-sm">
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-text-muted">Giá Mở Cửa</span>
          <span className="font-semibold text-white">{formatCurrency(latestQuote.open)} VND</span>
        </div>
        
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-text-muted">Giá Cao Nhất</span>
          <span className="font-semibold text-up">{formatCurrency(latestQuote.high)} VND</span>
        </div>
        
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-text-muted">Giá Thấp Nhất</span>
          <span className="font-semibold text-down">{formatCurrency(latestQuote.low)} VND</span>
        </div>
        
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-text-muted">Giá Đóng Cửa Trước</span>
          <span className="font-semibold text-ref">{formatCurrency(latestQuote.previousClose)} VND</span>
        </div>
        
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-text-muted">Tổng Khối Lượng</span>
          <span className="font-semibold text-white">{formatCurrency(latestQuote.volume)}</span>
        </div>
        
        <div className="flex justify-between pb-1">
          <span className="text-text-muted">Giá trị giao dịch</span>
          <span className="font-semibold text-[#00cfff]">{formatCurrency(latestQuote.value)} VND</span>
        </div>
      </div>
    </div>
  );
};
