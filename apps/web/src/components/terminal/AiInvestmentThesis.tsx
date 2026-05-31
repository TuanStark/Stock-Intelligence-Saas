import React from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { AiSummary } from '@/lib/hooks/useStockDetailData';

interface AiInvestmentThesisProps {
  aiSummary: AiSummary | null;
  aiLoading: boolean;
  aiMessage: string;
  handleTriggerAi: () => void;
  symbol: string;
}

export const AiInvestmentThesis: React.FC<AiInvestmentThesisProps> = ({
  aiSummary,
  aiLoading,
  aiMessage,
  handleTriggerAi,
  symbol
}) => {
  return (
    <div className="glass-panel p-5 bg-[#0d1017] border border-warning/20 shadow-xl rounded-2xl relative min-h-[350px] flex flex-col">
      <div className="flex items-center justify-between border-b border-[#1b2233] pb-3 mb-4">
        <h3 className="font-outfit text-sm font-bold flex items-center gap-2 text-warning uppercase tracking-wider m-0">
          <Sparkles size={16} />
          Luận điểm phân tích AI
        </h3>
        
        {aiSummary && !aiLoading && (
          <button
            onClick={handleTriggerAi}
            className="bg-white/5 border border-white/10 text-warning cursor-pointer p-1.5 rounded-md flex items-center justify-center hover:bg-warning/10 hover:border-warning/30 transition-all duration-200 outline-none"
            title="Làm mới phân tích AI"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {aiMessage && (
        <div className="py-2 px-3 bg-red-500/10 border border-red-500/15 rounded-md text-red-400 text-xs text-center mb-3">
          {aiMessage}
        </div>
      )}

      {aiLoading ? (
        <div className="flex flex-col gap-4 flex-grow justify-center py-8">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="animate-spin text-warning" size={32} />
            <div>
              <h5 className="font-outfit font-bold text-warning text-sm mb-1">Mạng Nơ-ron AI Đang Quét...</h5>
              <p className="text-[10px] text-text-muted leading-relaxed max-w-[240px]">
                Đang nén tin tức vĩ mô, chỉ số SMA/EMA & khối lượng giao dịch
              </p>
            </div>
          </div>
        </div>
      ) : aiSummary ? (
        <div className="flex flex-col gap-4 flex-grow text-xs md:text-sm">
          <div className="flex justify-between items-center">
            <span className={`badge ${
              aiSummary.sentiment === 'BULLISH' ? 'badge-bullish' :
              aiSummary.sentiment === 'BEARISH' ? 'badge-bearish' : 'badge-accent'
            } py-1 px-2.5`}>
              XU HƯỚNG: {aiSummary.sentiment}
            </span>
            
            <span className="text-[11px] text-text-muted font-bold">
              Độ tin cậy: {Math.round(Number(aiSummary.confidence) * 100)}%
            </span>
          </div>

          <div className="glass-panel p-4 rounded-lg bg-warning/5 border border-warning/10 leading-relaxed text-text-secondary text-xs">
            <p className="font-bold text-warning mb-1.5 uppercase tracking-wide">Luận Điểm Đầu Tư</p>
            {aiSummary.summary}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg text-[11px]">
              <span className="text-emerald-400 font-bold block mb-1">ĐỘNG LỰC TĂNG TRƯỞNG</span>
              <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                {Array.isArray(aiSummary.drivers) ? aiSummary.drivers.slice(0, 3).map((d, i) => (
                  <li key={i}>{d}</li>
                )) : <li>Động lực dòng tiền mở rộng</li>}
              </ul>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg text-[11px]">
              <span className="text-rose-400 font-bold block mb-1">RỦI RO KỸ THUẬT</span>
              <ul className="pl-3.5 list-disc text-text-secondary flex flex-col gap-1">
                {Array.isArray(aiSummary.risks) ? aiSummary.risks.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                )) : <li>Biến động thị trường chung</li>}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center flex-grow py-8 text-center gap-4">
          <Sparkles size={36} className="text-warning animate-pulse" />
          
          <div>
            <h4 className="font-outfit text-text-primary text-sm font-semibold mb-1">
              Chưa có Phân Tích AI
            </h4>
            <p className="text-xs text-text-muted leading-relaxed max-w-[240px] mx-auto">
              Yêu cầu AI quét luồng tín hiệu SMA/EMA & tin tức của {symbol} để trích xuất luận điểm.
            </p>
          </div>
          
          <button
            onClick={handleTriggerAi}
            className="py-2 px-4 rounded-lg bg-warning text-slate-900 border-none font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <Sparkles size={13} /> Phân Tích Ngay
          </button>
        </div>
      )}
    </div>
  );
};
