import { ProviderFallbackService } from './src/adapters/provider.service';

async function test() {
  const service = new ProviderFallbackService();
  
  console.log('--- TEST 1: Get Quote (VnStock/TCBS) ---');
  try {
    const quote = await service.getQuote('VND');
    console.log(quote);
  } catch (error) {
    console.error('Quote Error:', error);
  }

  console.log('\n--- TEST 2: Get Company Profile (VnStock/TCBS) ---');
  try {
    const profile = await service.getCompanyProfile('VND');
    console.log(profile);
  } catch (error) {
    console.error('Profile Error:', error);
  }

  console.log('\n--- TEST 3: Get Historical Candles (VnStock/TCBS) ---');
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - 7); // 7 days ago
    const period2 = new Date();
    const candles = await service.getHistorical('VND', period1, period2, '1D');
    console.log(`Found ${candles.length} candles. Latest candle:`, candles[candles.length - 1]);
  } catch (error) {
    console.error('Historical Error:', error);
  }
}

test();
