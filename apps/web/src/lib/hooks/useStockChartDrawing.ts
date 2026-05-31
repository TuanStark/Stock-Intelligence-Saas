import { useState, useRef, useEffect } from 'react';
import { LineSeries, IChartApi, ISeriesApi } from 'lightweight-charts';

export function useStockChartDrawing() {
  const [activeTool, setActiveToolState] = useState('');
  const [drawStatus, setDrawStatus] = useState('');
  const [drawingPoint1, setDrawingPoint1] = useState<any>(null);
  const [drawingStep, setDrawingStepState] = useState(0);
  const [isMagnet, setIsMagnet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const activeToolRef = useRef('');
  const drawingStepRef = useRef(0);
  const drawingPoint1Ref = useRef<any>(null);
  const trendlineSeriesArrayRef = useRef<any[]>([]);
  const isMagnetRef = useRef(false);
  const isLockedRef = useRef(false);
  const markersRef = useRef<any[]>([]);

  const setActiveTool = (t: string) => {
    activeToolRef.current = t;
    setActiveToolState(t);
  };

  const setDrawingStep = (s: number) => {
    drawingStepRef.current = s;
    setDrawingStepState(s);
  };

  const setDrawingPoint1Value = (p: any) => {
    drawingPoint1Ref.current = p;
    setDrawingPoint1(p);
  };

  useEffect(() => {
    isMagnetRef.current = isMagnet;
  }, [isMagnet]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const handleChartClick = (
    param: any,
    chart: IChartApi | null,
    candlestickSeries: ISeriesApi<'Candlestick'> | null,
    rawCandles: any[]
  ) => {
    if (!param.time || !param.point || !chart || !candlestickSeries) return;
    if (!activeToolRef.current) return;

    if (isLockedRef.current) {
      setDrawStatus('Hình vẽ đã bị khóa! Hãy mở khóa (Unlock) trên thanh công cụ để tiếp tục vẽ.');
      setTimeout(() => setDrawStatus(''), 3000);
      return;
    }

    let activePrice = candlestickSeries.coordinateToPrice(param.point.y);
    if (activePrice === null || activePrice === undefined) return;

    // 🧲 Magnet snap logic
    if (isMagnetRef.current && rawCandles.length > 0) {
      const candle = rawCandles.find(c => {
        if (typeof c.time === 'string' && typeof param.time === 'string') {
          return c.time === param.time;
        }
        if (typeof c.time === 'object' && typeof param.time === 'object' && c.time && param.time) {
          return c.time.year === param.time.year && c.time.month === param.time.month && c.time.day === param.time.day;
        }
        return JSON.stringify(c.time) === JSON.stringify(param.time);
      });
      if (candle) {
        const highDiff = Math.abs(activePrice - candle.high);
        const lowDiff = Math.abs(activePrice - candle.low);
        activePrice = highDiff < lowDiff ? candle.high : candle.low;
      }
    }

    const currentTool = activeToolRef.current;

    // 📈 Tool 1: Trendline
    if (currentTool === 'trendline') {
      if (drawingStepRef.current === 0) {
        setDrawingPoint1Value({ time: param.time, price: activePrice });
        setDrawingStep(1);
        setDrawStatus('Click điểm thứ hai trên đồ thị để vẽ đường xu hướng');
      } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
        const p1 = drawingPoint1Ref.current;
        const p2 = { time: param.time, price: activePrice };

        const trendlineSeries = chart.addSeries(LineSeries, {
          color: '#e040fb',
          lineWidth: 2,
          title: 'Trendline'
        });
        trendlineSeries.setData([
          { time: p1.time, value: p1.price },
          { time: p2.time, value: p2.price }
        ]);
        trendlineSeriesArrayRef.current.push(trendlineSeries);

        setActiveTool('');
        setDrawingStep(0);
        setDrawingPoint1Value(null);
        setDrawStatus('Đã vẽ đường xu hướng (Trendline) hoàn tất!');
        setTimeout(() => setDrawStatus(''), 4000);
      }
    }
    // 🔱 Tool 2: Fibonacci Retracement
    else if (currentTool === 'fibonacci') {
      if (drawingStepRef.current === 0) {
        setDrawingPoint1Value({ time: param.time, price: activePrice });
        setDrawingStep(1);
        setDrawStatus('Click điểm thứ hai (Swing High/Low) để hoàn tất tỷ lệ Fibonacci');
      } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
        const p1 = drawingPoint1Ref.current;
        const p2 = { time: param.time, price: activePrice };

        const price1 = Number(p1.price || 0);
        const price2 = Number(p2.price || 0);
        const diff = price2 - price1;
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 1.0];
        const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#5ac8fa', '#007aff'];

        const connectLine = chart.addSeries(LineSeries, {
          color: '#7b8a9b',
          lineWidth: 1,
          lineStyle: 1, // Dotted
          title: 'Fib Connect'
        });
        connectLine.setData([
          { time: p1.time, value: price1 },
          { time: p2.time, value: price2 }
        ]);
        trendlineSeriesArrayRef.current.push(connectLine);

        fibLevels.forEach((level, idx) => {
          const levelPrice = price1 + diff * level;
          const levelSeries = chart.addSeries(LineSeries, {
            color: colors[idx],
            lineWidth: 1,
            title: `Fib ${(level * 100).toFixed(1)}%`
          });
          levelSeries.setData([
            { time: p1.time, value: levelPrice },
            { time: p2.time, value: levelPrice }
          ]);
          trendlineSeriesArrayRef.current.push(levelSeries);
        });

        setActiveTool('');
        setDrawingStep(0);
        setDrawingPoint1Value(null);
        setDrawStatus('Vẽ tỷ lệ Fibonacci Retracement hoàn tất!');
        setTimeout(() => setDrawStatus(''), 4000);
      }
    }
    // 🟩 Tool 3: Shapes (Rectangle Zone)
    else if (currentTool === 'shapes') {
      if (drawingStepRef.current === 0) {
        setDrawingPoint1Value({ time: param.time, price: activePrice });
        setDrawingStep(1);
        setDrawStatus('Click điểm chéo đối diện thứ hai để hoàn tất vùng giá');
      } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
        const p1 = drawingPoint1Ref.current;
        const p2 = { time: param.time, price: activePrice };

        const price1 = Number(p1.price || 0);
        const price2 = Number(p2.price || 0);
        const topPrice = Math.max(price1, price2);
        const bottomPrice = Math.min(price1, price2);
        const zoneColor = '#00c58e';

        const topLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, title: 'Zone Top' });
        topLine.setData([{ time: p1.time, value: topPrice }, { time: p2.time, value: topPrice }]);
        trendlineSeriesArrayRef.current.push(topLine);

        const bottomLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, title: 'Zone Bottom' });
        bottomLine.setData([{ time: p1.time, value: bottomPrice }, { time: p2.time, value: bottomPrice }]);
        trendlineSeriesArrayRef.current.push(bottomLine);

        const leftLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, lineStyle: 2, title: 'Zone Left' });
        leftLine.setData([{ time: p1.time, value: bottomPrice }, { time: p1.time, value: topPrice }]);
        trendlineSeriesArrayRef.current.push(leftLine);

        const rightLine = chart.addSeries(LineSeries, { color: zoneColor, lineWidth: 1, lineStyle: 2, title: 'Zone Right' });
        rightLine.setData([{ time: p2.time, value: bottomPrice }, { time: p2.time, value: topPrice }]);
        trendlineSeriesArrayRef.current.push(rightLine);

        setActiveTool('');
        setDrawingStep(0);
        setDrawingPoint1Value(null);
        setDrawStatus('Đã vẽ vùng giá chữ nhật (Price Zone) hoàn tất!');
        setTimeout(() => setDrawStatus(''), 4000);
      }
    }
    // 💬 Tool 4: Text Annotation
    else if (currentTool === 'text') {
      const userText = prompt('Nhập nội dung ghi chú/chú thích tại vị trí nến này:');
      if (userText && userText.trim()) {
        const newMarker = {
          time: param.time,
          position: 'aboveBar',
          color: '#e040fb',
          shape: 'arrowDown',
          text: userText.trim(),
          size: 1.5
        };
        markersRef.current.push(newMarker);
        (candlestickSeries as any).setMarkers([...markersRef.current]);
        setDrawStatus('Đã tạo chú thích văn bản thành công!');
      }
      setActiveTool('');
      setTimeout(() => setDrawStatus(''), 4000);
    }
    // 📏 Tool 5: Ruler
    else if (currentTool === 'ruler') {
      if (drawingStepRef.current === 0) {
        setDrawingPoint1Value({ time: param.time, price: activePrice });
        setDrawingStep(1);
        setDrawStatus('Click điểm thứ hai để tính toán chênh lệch đo lường');
      } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
        const p1 = drawingPoint1Ref.current;
        const p2 = { time: param.time, price: activePrice };

        const price1 = Number(p1.price || 0);
        const price2 = Number(p2.price || 0);
        const priceDiff = price2 - price1;
        const priceDiffPct = (priceDiff / price1) * 100;

        let barsCount = 1;
        if (rawCandles.length > 0) {
          const idx1 = rawCandles.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p1.time));
          const idx2 = rawCandles.findIndex(c => JSON.stringify(c.time) === JSON.stringify(p2.time));
          if (idx1 !== -1 && idx2 !== -1) {
            barsCount = Math.abs(idx2 - idx1) + 1;
          }
        }

        const rulerLine = chart.addSeries(LineSeries, {
          color: '#00cfff',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          title: 'Ruler Measurement'
        });
        rulerLine.setData([
          { time: p1.time, value: price1 },
          { time: p2.time, value: price2 }
        ]);
        trendlineSeriesArrayRef.current.push(rulerLine);

        alert(`📏 ĐO LƯỜNG PHÂN TÍCH KHOẢNG GIÁ & THỜI GIAN:\n\n` +
              `- Điểm bắt đầu: ${price1.toLocaleString()}đ\n` +
              `- Điểm kết thúc: ${price2.toLocaleString()}đ\n` +
              `- Chênh lệch giá: ${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()}đ (${priceDiffPct >= 0 ? '+' : ''}${priceDiffPct.toFixed(2)}%)\n` +
              `- Số nến giao dịch: ${barsCount} nến`);

        setActiveTool('');
        setDrawingStep(0);
        setDrawingPoint1Value(null);
        setDrawStatus('Đo lường khoảng giá hoàn tất!');
        setTimeout(() => setDrawStatus(''), 4000);
      }
    }
    // 🔍 Tool 6: Zoom Range
    else if (currentTool === 'zoom') {
      if (drawingStepRef.current === 0) {
        setDrawingPoint1Value({ time: param.time, price: activePrice });
        setDrawingStep(1);
        setDrawStatus('Click điểm thứ hai để hoàn tất vùng thời gian thu phóng');
      } else if (drawingStepRef.current === 1 && drawingPoint1Ref.current) {
        const p1 = drawingPoint1Ref.current;
        const p2 = { time: param.time, price: activePrice };

        try {
          chart.timeScale().setVisibleRange({
            from: p1.time,
            to: p2.time
          });
          setDrawStatus('Đã thu phóng cận cảnh vùng thời gian thành công!');
        } catch (e) {
          setDrawStatus('Thu phóng bằng con lăn chuột.');
        }

        setActiveTool('');
        setDrawingStep(0);
        setDrawingPoint1Value(null);
        setTimeout(() => setDrawStatus(''), 4000);
      }
    }
  };

  const clearAllDrawings = (chart: IChartApi | null, candlestickSeries: ISeriesApi<'Candlestick'> | null) => {
    if (!chart) return;
    trendlineSeriesArrayRef.current.forEach(series => {
      try { chart.removeSeries(series); } catch (e) { }
    });
    trendlineSeriesArrayRef.current = [];
    markersRef.current = [];
    if (candlestickSeries) {
      try { (candlestickSeries as any).setMarkers([]); } catch (e) {}
    }
    setDrawStatus('Đã xóa tất cả nét vẽ & chú thích.');
    setTimeout(() => setDrawStatus(''), 3000);
  };

  const resetAllDrawingsArray = () => {
    trendlineSeriesArrayRef.current = [];
    markersRef.current = [];
  };

  return {
    activeTool,
    setActiveTool,
    drawStatus,
    setDrawStatus,
    drawingPoint1,
    drawingStep,
    setDrawingStep,
    isMagnet,
    setIsMagnet,
    isLocked,
    setIsLocked,
    handleChartClick,
    clearAllDrawings,
    resetAllDrawingsArray,
    trendlineSeriesArray: trendlineSeriesArrayRef.current,
  };
}
