import React from 'react';
import {
  MousePointer,
  LineChart as LucideLineChart,
  Hash,
  Square,
  MessageSquare,
  Ruler,
  Search,
  Magnet,
  Lock,
  Unlock,
  Trash2
} from 'lucide-react';

interface DrawingToolbarProps {
  activeTool: string;
  setActiveTool: (t: string) => void;
  setDrawStatus: (s: string) => void;
  setDrawingStep: (s: number) => void;
  isMagnet: boolean;
  setIsMagnet: (m: boolean) => void;
  isLocked: boolean;
  setIsLocked: (l: boolean) => void;
  onClear: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  setActiveTool,
  setDrawStatus,
  setDrawingStep,
  isMagnet,
  setIsMagnet,
  isLocked,
  setIsLocked,
  onClear
}) => {
  return (
    <div className="w-[45px] shrink-0 border-r border-[#151a24] bg-[#090b11] flex flex-col items-center py-4 gap-3.5 text-[#7b8a9b] select-none">
      <button
        onClick={() => {
          setActiveTool('');
          setDrawStatus('');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${!activeTool ? 'text-white bg-white/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Con trỏ chuột"
      >
        <MousePointer size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('trendline');
          setDrawingStep(0);
          setDrawStatus('Click điểm bắt đầu trên đồ thị để chọn điểm 1');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'trendline' ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Đường xu hướng (Trendline)"
      >
        <LucideLineChart size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('fibonacci');
          setDrawingStep(0);
          setDrawStatus('Chỉ báo Fibonacci Retracement: Click điểm Swing High/Low để vẽ tỷ lệ');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'fibonacci' ? 'text-[#00cfff] bg-[#00cfff]/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Thoái lui Fibonacci"
      >
        <Hash size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('shapes');
          setDrawingStep(0);
          setDrawStatus('Vẽ hình chữ nhật: Click điểm chéo thứ hai để đánh dấu vùng giá');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'shapes' ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Hộp vùng giá (Rectangle Price Zone)"
      >
        <Square size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('text');
          setDrawStatus('Thêm chú thích văn bản: Click điểm trên biểu đồ để viết ghi chú');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'text' ? 'text-purple-400 bg-purple-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Ghi chú chú thích (Annotations)"
      >
        <MessageSquare size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('ruler');
          setDrawingStep(0);
          setDrawStatus('Thước đo tỷ lệ phần trăm khoảng giá & thời gian');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'ruler' ? 'text-teal-400 bg-teal-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Thước đo khoảng giá"
      >
        <Ruler size={15} />
      </button>

      <button
        onClick={() => {
          setActiveTool('zoom');
          setDrawingStep(0);
          setDrawStatus('Thu phóng chi tiết khung nến');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${activeTool === 'zoom' ? 'text-indigo-400 bg-indigo-400/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Thu phóng vùng biểu đồ"
      >
        <Search size={15} />
      </button>

      <button
        onClick={() => {
          setIsMagnet(!isMagnet);
          setDrawStatus(!isMagnet ? 'Đã bật chế độ tự động hút nam châm vào râu nến' : 'Đã tắt chế độ hút nam châm');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isMagnet ? 'text-[#00c58e] bg-[#00c58e]/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Hút nam châm (Magnet Mode)"
      >
        <Magnet size={15} />
      </button>

      <button
        onClick={() => {
          setIsLocked(!isLocked);
          setDrawStatus(!isLocked ? 'Đã khóa tất cả nét vẽ trên biểu đồ' : 'Đã mở khóa các nét vẽ');
        }}
        className={`bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors flex items-center justify-center ${isLocked ? 'text-[#ffb300] bg-[#ffb300]/10' : 'text-[#7b8a9b] hover:text-white'}`}
        title="Khóa hình vẽ"
      >
        {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
      </button>

      <button
        onClick={() => {
          onClear();
          setDrawStatus('Đã xóa tất cả nét vẽ');
        }}
        className="bg-transparent border-0 cursor-pointer p-1.5 rounded text-rose-500 hover:text-rose-400 transition-colors mt-auto flex items-center justify-center"
        title="Xóa tất cả nét vẽ"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};
