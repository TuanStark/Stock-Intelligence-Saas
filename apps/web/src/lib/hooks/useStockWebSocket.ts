import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "../env";

export interface OrderBookRow {
  price: number;
  volume: number;
  percentage: number;
}

export interface TradeLog {
  time: string;
  price: number;
  volume: number;
  type: "BUY" | "SELL";
  change: number;
}

export function useStockWebSocket(
  symbol: string | undefined,
  basePrice: number,
  onTick?: (tick: {
    price: number;
    change: number;
    changePercent: number;
    timestamp: string;
  }) => void,
) {
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  const [trades, setTrades] = useState<TradeLog[]>([]);

  // Keep latest onTick callback in ref without re-triggering socket reconnection
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const rawApiUrl = getApiUrl();
  const SOCKET_URL = rawApiUrl.replace(/\/api\/v1\/?$/, "");

  // 1. Initial pre-population of Mock Depth & Trades History
  useEffect(() => {
    if (!symbol) return;
    const initialPrice = basePrice || 22850;

    generateMockDepth(initialPrice);
    generateMockTradesHistory(initialPrice, initialPrice);

    function generateMockDepth(price: number) {
      const step = 50;
      const mockBids: OrderBookRow[] = [
        {
          price: price - step,
          volume: Math.floor(80000 + Math.random() * 200000),
          percentage: 0,
        },
        {
          price: price - step * 2,
          volume: Math.floor(60000 + Math.random() * 150000),
          percentage: 0,
        },
        {
          price: price - step * 3,
          volume: Math.floor(40000 + Math.random() * 100000),
          percentage: 0,
        },
      ];
      const mockAsks: OrderBookRow[] = [
        {
          price: price + step,
          volume: Math.floor(75000 + Math.random() * 180000),
          percentage: 0,
        },
        {
          price: price + step * 2,
          volume: Math.floor(55000 + Math.random() * 140000),
          percentage: 0,
        },
        {
          price: price + step * 3,
          volume: Math.floor(35000 + Math.random() * 90000),
          percentage: 0,
        },
      ];

      const maxVol = Math.max(
        ...[...mockBids, ...mockAsks].map((x) => x.volume),
        1,
      );
      mockBids.forEach((x) => (x.percentage = (x.volume / maxVol) * 100));
      mockAsks.forEach((x) => (x.percentage = (x.volume / maxVol) * 100));

      setBids(mockBids);
      setAsks(mockAsks);
    }

    function generateMockTradesHistory(price: number, base: number) {
      const mockTrades: TradeLog[] = [];
      const now = new Date();

      for (let i = 0; i < 15; i++) {
        const tradeTime = new Date(
          now.getTime() - i * Math.floor(3 + Math.random() * 12) * 1000,
        );
        const timeStr = tradeTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const priceOffset = (Math.floor(Math.random() * 5) - 2) * 50;
        const tradePrice = Math.max(
          Math.round(base * 0.93),
          Math.min(Math.round(base * 1.07), price + priceOffset),
        );

        const tradeType: "BUY" | "SELL" = Math.random() > 0.48 ? "BUY" : "SELL";
        const tradeVol = Math.floor(1 + Math.random() * 75) * 100;

        mockTrades.push({
          time: timeStr,
          price: tradePrice,
          volume: tradeVol,
          type: tradeType,
          change: tradePrice - base,
        });
      }
      setTrades(mockTrades);
    }
  }, [symbol, basePrice]);

  // 2. Real-time Live WebSockets Ticks Subscription Stream
  useEffect(() => {
    if (!symbol) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log(`🔌 WebSockets connected. Subscribing to stock: ${symbol}`);
      socket.emit("subscribe_instrument", { symbol });
    });

    socket.on("instrument_tick", (tick) => {
      // Invoke tick callback to update parent state (Quotes & Candlesticks)
      if (onTickRef.current) {
        onTickRef.current({
          price: tick.price,
          change: tick.change,
          changePercent: tick.changePercent,
          timestamp: tick.timestamp,
        });
      }

      // Prepend dynamic trades stream
      const timeStr = new Date(tick.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const tradeType: "BUY" | "SELL" = Math.random() > 0.45 ? "BUY" : "SELL";
      const tradeVol = Math.floor(100 + Math.random() * 8000);

      setTrades((prev) => [
        {
          time: timeStr,
          price: tick.price,
          volume: tradeVol,
          type: tradeType,
          change: tick.change,
        },
        ...prev.slice(0, 18),
      ]);
    });

    return () => {
      console.log(
        `🔌 Unsubscribing and disconnecting WebSockets for symbol: ${symbol}`,
      );
      socket.emit("unsubscribe_instrument", { symbol });
      socket.disconnect();
    };
  }, [symbol, SOCKET_URL]);

  return { bids, asks, trades };
}
