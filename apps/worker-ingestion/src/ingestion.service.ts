import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@stock-intel/db';
import yahooFinance from 'yahoo-finance2';
import { RSI } from 'technicalindicators';

const prisma = new PrismaClient();

const WATCH_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'PLTR', 'MSFT', 'AMD', 'META', 'AMZN'];

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  async onModuleInit() {
    this.logger.log('IngestionService initialized. Starting initial sync...');
    await this.syncInstruments();
    await this.ingestMarketData();
  }

  private async syncInstruments() {
    let exchange = await prisma.exchange.findFirst({ where: { code: 'US' } });
    if (!exchange) {
      exchange = await prisma.exchange.create({
        data: { code: 'US', name: 'US Equities', market: 'US' },
      });
    }

    for (const symbol of WATCH_SYMBOLS) {
      const existing = await prisma.instrument.findFirst({ where: { symbol } });
      if (!existing) {
        try {
          const quote: any = await yahooFinance.quote(symbol);
          await prisma.instrument.create({
            data: {
              symbol: symbol,
              name: quote.longName || quote.shortName || symbol,
              currency: quote.currency || 'USD',
              exchangeId: exchange.id,
              status: 'ACTIVE',
              tradable: true,
            },
          });
          this.logger.log(`Created instrument: ${symbol}`);
        } catch (error) {
          const e = error as Error;
          this.logger.error(`Failed to fetch basic info for ${symbol}`, e);
        }
      }
    }
  }

  // Fetch every 30 seconds for local dev to quickly populate data
  @Cron('*/30 * * * * *')
  async ingestMarketData() {
    this.logger.log('Fetching live data from Yahoo Finance...');
    const instruments = await prisma.instrument.findMany();
    
    for (const inst of instruments) {
      try {
        const quote: any = await yahooFinance.quote(inst.symbol);
        
        await prisma.quote.create({
          data: {
            instrumentId: inst.id,
            symbol: inst.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            open: quote.regularMarketOpen || 0,
            high: quote.regularMarketDayHigh || 0,
            low: quote.regularMarketDayLow || 0,
            previousClose: quote.regularMarketPreviousClose || 0,
            volume: quote.regularMarketVolume || 0,
            value: (quote.regularMarketVolume || 0) * (quote.regularMarketPrice || 0),
            timestamp: quote.regularMarketTime || new Date(),
            asOf: new Date(),
            source: 'YAHOO_FINANCE_FREE',
          },
        });

        // Compute Intelligence
        const period1 = new Date();
        period1.setDate(period1.getDate() - 60);
        const historical: any[] = await yahooFinance.historical(inst.symbol, {
          period1: period1.toISOString().split('T')[0],
          interval: '1d',
        });

        if (historical.length > 30) {
          const closes = historical.map((h: any) => h.close);
          const rsiResult = RSI.calculate({ values: closes, period: 14 });
          const latestRsi = rsiResult[rsiResult.length - 1];

          if (latestRsi) {
            let signalType = null;
            let strength: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
            let score = 50;

            if (latestRsi > 65) {
              signalType = 'RSI_OVERBOUGHT';
              strength = latestRsi > 75 ? 'HIGH' : 'MEDIUM';
              score = Math.max(0, 100 - latestRsi);
            } else if (latestRsi < 35) {
              signalType = 'RSI_OVERSOLD';
              strength = latestRsi < 25 ? 'HIGH' : 'MEDIUM';
              score = Math.min(100, 100 - latestRsi);
            }

            if (signalType) {
              await prisma.stockSignal.create({
                data: {
                  instrumentId: inst.id,
                  type: signalType as any,
                  strength,
                  score,
                  value: latestRsi,
                  explanation: `RSI is currently at ${latestRsi.toFixed(2)}, indicating the asset is ${signalType === 'RSI_OVERSOLD' ? 'oversold' : 'overbought'}.`,
                  detectedAt: new Date(),
                }
              });
            }
          }
        }
      } catch (error) {
        const e = error as Error;
        this.logger.warn(`Failed to process ${inst.symbol}: ${e.message}`);
      }
    }
  }
}
