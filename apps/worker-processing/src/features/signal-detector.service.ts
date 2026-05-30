import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { IndicatorCalculatorService } from './indicator-calculator.service';
import { SignalType, SignalStrength } from '@stock-intel/db';

@Injectable()
export class SignalDetectorService {
  private readonly logger = new Logger(SignalDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly calculator: IndicatorCalculatorService,
  ) {}

  async detectSignals(
    instrumentId: string,
    symbol: string,
    candles: any[],
  ): Promise<void> {
    if (candles.length < 25) {
      this.logger.debug(`Not enough candles to run signal detection for ${symbol} (got ${candles.length}, needs >=25)`);
      return;
    }

    const closes = candles.map((c) => Number(c.close));
    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));
    const volumes = candles.map((c) => Number(c.volume));

    const latestClose = closes[closes.length - 1];

    // ─── 1. RSI SIGNAL ───────────────────────────────────────────
    const rsiValues = this.calculator.calculateRSI(closes, 14);
    if (rsiValues.length > 0) {
      const latestRSI = rsiValues[rsiValues.length - 1];
      if (latestRSI > 70) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.RSI_OVERBOUGHT,
          strength: latestRSI > 80 ? SignalStrength.HIGH : SignalStrength.MEDIUM,
          score: latestRSI,
          value: latestClose,
          explanation: `RSI ở mức ${latestRSI.toFixed(1)} chỉ ra rằng cổ phiếu đang đi sâu vào vùng quá mua (Overbought).`,
        });
      } else if (latestRSI < 30) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.RSI_OVERSOLD,
          strength: latestRSI < 20 ? SignalStrength.HIGH : SignalStrength.MEDIUM,
          score: latestRSI,
          value: latestClose,
          explanation: `RSI ở mức ${latestRSI.toFixed(1)} chỉ ra rằng cổ phiếu đang đi sâu vào vùng quá bán (Oversold).`,
        });
      }
    }

    // ─── 2. MACD SIGNAL ──────────────────────────────────────────
    const macdValues = this.calculator.calculateMACD(closes, 12, 26, 9);
    if (macdValues.length >= 2) {
      const prev = macdValues[macdValues.length - 2];
      const curr = macdValues[macdValues.length - 1];

      // Golden Cross (MACD cắt lên Signal)
      if (prev.macd <= prev.signal && curr.macd > curr.signal) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.MACD_BULLISH,
          strength: SignalStrength.MEDIUM,
          score: curr.macd - curr.signal,
          value: latestClose,
          explanation: `Đường MACD giao cắt hướng lên (Golden Cross) với đường Tín hiệu (Signal Line), chỉ báo xu hướng tăng ngắn hạn.`,
        });
      }
      // Death Cross (MACD cắt xuống Signal)
      else if (prev.macd >= prev.signal && curr.macd < curr.signal) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.MACD_BEARISH,
          strength: SignalStrength.MEDIUM,
          score: curr.signal - curr.macd,
          value: latestClose,
          explanation: `Đường MACD giao cắt hướng xuống (Death Cross) với đường Tín hiệu (Signal Line), chỉ báo xu hướng giảm ngắn hạn.`,
        });
      }
    }

    // ─── 3. VOLUME SPIKE SIGNAL ─────────────────────────────────
    const volumeSMAs = this.calculator.calculateSMA(volumes, 20);
    if (volumeSMAs.length >= 2) {
      const latestVolume = volumes[volumes.length - 1];
      const avgVolume20 = volumeSMAs[volumeSMAs.length - 2]; // average of previous 20 sessions

      if (latestVolume > 2.5 * avgVolume20 && avgVolume20 > 0) {
        const ratio = latestVolume / avgVolume20;
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.VOLUME_SPIKE,
          strength: ratio > 4 ? SignalStrength.HIGH : SignalStrength.MEDIUM,
          score: ratio,
          value: latestClose,
          explanation: `Khối lượng giao dịch tăng vọt đột biến đạt ${latestVolume.toLocaleString()} cổ phiếu, gấp ${ratio.toFixed(1)} lần trung bình 20 phiên gần nhất.`,
        });
      }
    }

    // ─── 4. PRICE BREAKOUT / BREAKDOWN ──────────────────────────
    if (closes.length >= 21) {
      const prev20Highs = highs.slice(highs.length - 21, highs.length - 1);
      const prev20Lows = lows.slice(lows.length - 21, lows.length - 1);

      const maxHigh = Math.max(...prev20Highs);
      const minLow = Math.min(...prev20Lows);

      // Breakout (vượt đỉnh 20 phiên)
      if (latestClose > maxHigh) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.BREAKOUT,
          strength: SignalStrength.HIGH,
          score: latestClose / maxHigh,
          value: latestClose,
          explanation: `Giá đóng cửa ở mức ${latestClose.toLocaleString()} đã vượt đỉnh kháng cự của 20 phiên gần nhất (${maxHigh.toLocaleString()}).`,
        });
      }
      // Breakdown (thủng đáy 20 phiên)
      else if (latestClose < minLow) {
        await this.upsertSignal({
          instrumentId,
          symbol,
          type: SignalType.BREAKDOWN,
          strength: SignalStrength.HIGH,
          score: minLow / latestClose,
          value: latestClose,
          explanation: `Giá đóng cửa ở mức ${latestClose.toLocaleString()} đã đâm thủng đáy hỗ trợ của 20 phiên gần nhất (${minLow.toLocaleString()}).`,
        });
      }
    }
  }

  private async upsertSignal(params: {
    instrumentId: string;
    symbol: string;
    type: SignalType;
    strength: SignalStrength;
    score: number;
    value: number;
    explanation: string;
  }): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 5); // Signal stays active for 5 calendar days

    try {
      // De-duplication: Check if this specific signal type was already triggered today for this symbol
      const existing = await this.prisma.stockSignal.findFirst({
        where: {
          instrumentId: params.instrumentId,
          type: params.type,
          detectedAt: {
            gte: startOfDay,
          },
        },
      });

      let savedSignal;
      if (existing) {
        savedSignal = await this.prisma.stockSignal.update({
          where: { id: existing.id },
          data: {
            strength: params.strength,
            score: params.score,
            value: params.value,
            explanation: params.explanation,
            detectedAt: new Date(),
            expiresAt,
          },
        });
        this.logger.log(`🔄 Updated existing real-time technical signal: ${params.symbol} [${params.type}]`);
      } else {
        savedSignal = await this.prisma.stockSignal.create({
          data: {
            instrumentId: params.instrumentId,
            type: params.type,
            strength: params.strength,
            score: params.score,
            value: params.value,
            explanation: params.explanation,
            detectedAt: new Date(),
            expiresAt,
          },
        });
        this.logger.log(`🔥 Detected NEW real-time technical signal: ${params.symbol} [${params.type}]`);
      }

      // Publish signal details onto Redis PubSub so that users get live alerts
      await this.redis.publishSignal(params.symbol, {
        id: savedSignal.id,
        type: params.type,
        strength: params.strength,
        score: Number(savedSignal.score),
        value: Number(savedSignal.value),
        explanation: savedSignal.explanation,
        detectedAt: savedSignal.detectedAt.toISOString(),
      });
    } catch (err) {
      this.logger.error(`Failed to upsert signal for ${params.symbol}:`, err);
    }
  }
}
