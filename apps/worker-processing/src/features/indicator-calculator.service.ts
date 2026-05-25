import { Injectable, Logger } from '@nestjs/common';
import { RSI, MACD, SMA, EMA, BollingerBands } from 'technicalindicators';

@Injectable()
export class IndicatorCalculatorService {
  private readonly logger = new Logger(IndicatorCalculatorService.name);

  calculateRSI(closes: number[], period = 14): number[] {
    if (closes.length < period) {
      this.logger.warn(`Not enough data to calculate RSI (needs at least ${period} closes, got ${closes.length})`);
      return [];
    }
    return RSI.calculate({ values: closes, period });
  }

  calculateMACD(closes: number[], fast = 12, slow = 26, signal = 9): any[] {
    const minCloses = slow + signal;
    if (closes.length < minCloses) {
      this.logger.warn(`Not enough data to calculate MACD (needs at least ${minCloses} closes, got ${closes.length})`);
      return [];
    }
    return MACD.calculate({
      values: closes,
      fastPeriod: fast,
      slowPeriod: slow,
      signalPeriod: signal,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
  }

  calculateSMA(values: number[], period: number): number[] {
    if (values.length < period) return [];
    return SMA.calculate({ values, period });
  }

  calculateEMA(values: number[], period: number): number[] {
    if (values.length < period) return [];
    return EMA.calculate({ values, period });
  }

  calculateBollingerBands(closes: number[], period = 20, stdDev = 2): any[] {
    if (closes.length < period) return [];
    return BollingerBands.calculate({ values: closes, period, stdDev });
  }
}
