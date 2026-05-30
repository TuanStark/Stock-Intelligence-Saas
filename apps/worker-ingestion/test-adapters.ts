import { VnStockAdapter } from './src/adapters/vnstock.adapter';
import { ProviderFallbackService } from './src/adapters/provider.service';

async function runTests() {
  console.log('=== STARTING INTEGRATION TESTS FOR ADAPTERS ===');
  
  const vnstock = new VnStockAdapter();
  const service = new ProviderFallbackService();
  const testTickers = ['FPT', 'VND', 'VNM'];

  // Test 1: VnStockAdapter getQuote
  console.log('\n--- TEST 1: VnStockAdapter getQuote ---');
  for (const ticker of testTickers) {
    try {
      console.log(`Fetching quote for ${ticker}...`);
      const quote = await vnstock.getQuote(ticker);
      console.log(`=> SUCCESS! ${ticker} quote:`, {
        symbol: quote.symbol,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        change: quote.change,
        changePercent: (quote.changePercent * 100).toFixed(2) + '%',
        volume: quote.volume,
        value: quote.value,
        source: quote.source,
      });
    } catch (err: any) {
      console.error(`=> FAILED quote for ${ticker}:`, err.message);
    }
  }

  // Test 2: VnStockAdapter getCompanyProfile
  console.log('\n--- TEST 2: VnStockAdapter getCompanyProfile ---');
  for (const ticker of testTickers) {
    try {
      console.log(`Fetching profile for ${ticker}...`);
      const profile = await vnstock.getCompanyProfile(ticker);
      console.log(`=> SUCCESS! ${ticker} profile:`, {
        symbol: profile.symbol,
        name: profile.name,
        exchange: profile.exchange,
        industry: profile.industry,
        marketCap: profile.marketCap,
        pe: profile.pe?.toFixed(2),
        pb: profile.pb?.toFixed(2),
        eps: profile.eps?.toFixed(2),
        outstandingShares: profile.outstandingShares,
      });
    } catch (err: any) {
      console.error(`=> FAILED profile for ${ticker}:`, err.message);
    }
  }

  // Test 3: VnStockAdapter getHistorical
  console.log('\n--- TEST 3: VnStockAdapter getHistorical (1D) ---');
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - 10); // 10 days ago
    const period2 = new Date();
    
    console.log(`Fetching historical candles for FPT...`);
    const candles = await vnstock.getHistorical('FPT', period1, period2, '1D');
    console.log(`=> SUCCESS! Found ${candles.length} candles.`);
    if (candles.length > 0) {
      console.log('Latest candle:', candles[candles.length - 1]);
    }
  } catch (err: any) {
    console.error('=> FAILED historical for FPT:', err.message);
  }

  // Test 4: ProviderFallbackService Integration
  console.log('\n--- TEST 4: ProviderFallbackService Integration ---');
  try {
    console.log('Fetching quote for HPG via Fallback Service...');
    const quote = await service.getQuote('HPG');
    console.log(`=> SUCCESS! HPG quote from fallback chain:`, {
      symbol: quote.symbol,
      price: quote.price,
      changePercent: (quote.changePercent * 100).toFixed(2) + '%',
      source: quote.source,
    });
  } catch (err: any) {
    console.error('=> FAILED fallback quote for HPG:', err.message);
  }
}

runTests();





