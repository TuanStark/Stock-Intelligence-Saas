// src/features/ai-summary/fallback.provider.ts
import { Injectable } from '@nestjs/common';
import { AiSummaryResponse } from '../types/ai-summary.types';

@Injectable()
export class FallbackProvider {
    getFallbackData(symbol: string): AiSummaryResponse {
        const upperSymbol = symbol.toUpperCase();

        const fallbacks: Record<string, Partial<AiSummaryResponse>> = {
            HPG: {
                summary: 'Hoa Phat Group shows resilient volume expansion driven by strong domestic infrastructure steel demand...',
                sentiment: 'BULLISH',
                confidence: 0.87,
                drivers: ['Domestic steel market leadership', 'Robust infrastructure spending'],
                risks: ['Iron ore raw material cost volatility', 'Global steel dumping'],
            },
            FPT: {
                summary: 'FPT Corporation exhibits extreme long-term bullish momentum driven by double-digit software export growth...',
                sentiment: 'BULLISH',
                confidence: 0.89,
                drivers: ['Double-digit software export growth', 'Aggressive AI/Cloud infrastructure'],
                risks: ['Global tech talent cost', 'FX volatility'],
            },
            VNM: {
                summary: `Vinamilk (VNM) exhibits stable mid-term momentum with strong domestic market share in the dairy sector...`,
                sentiment: 'NEUTRAL',
                confidence: 0.82,
                drivers: ['Dominant market share in Vietnam', 'Export expansion to key markets'],
                risks: ['Rising raw material costs', 'Shifting consumer preferences towards health products'],
            },
            VHM: {
                summary: `Vinhomes (VHM) shows strong mid-term growth potential driven by large-scale integrated township projects...`,
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Extensive land bank in strategic locations', 'Strong brand recognition in real estate'],
                risks: ['Stricter real estate regulations', 'Potential liquidity tightening'],
            },
            VRE: {
                summary: `Vincom Retail (VRE) maintains steady performance with robust occupancy rates across its shopping mall portfolio...`,
                sentiment: 'NEUTRAL',
                confidence: 0.80,
                drivers: ['Strategic locations in prime urban areas', 'Expanding retail services'],
                risks: ['E-commerce competition', 'Fluctuations in consumer spending'],
            },
            TCB: {
                summary: `Techcombank (TCB) demonstrates strong growth in digital banking services and SME lending...`,
                sentiment: 'BULLISH',
                confidence: 0.88,
                drivers: ['Leading digital banking platform', 'Strong capital adequacy ratio'],
                risks: ['Credit quality concerns in real estate', 'Regulatory scrutiny on digital lending'],
            },
            MBB: {
                summary: `MB Bank (MBB) shows resilient growth driven by strong retail customer base and digital transformation initiatives...`,
                sentiment: 'BULLISH',
                confidence: 0.86,
                drivers: ['Large and loyal customer base', 'Rapid expansion of digital banking services'],
                risks: ['Increased competition in digital banking', 'Potential exposure to SME loan defaults'],
            },
            VPB: {
                summary: `VPBank (VPB) exhibits steady growth driven by consumer finance and digital banking services...`,
                sentiment: 'BULLISH',
                confidence: 0.83,
                drivers: ['Strong position in consumer finance', 'Expanding digital banking platform'],
                risks: ['Potential rise in non-performing loans', 'Regulatory changes in consumer lending'],
            },
            MSB: {
                summary: `MSB (MSB) maintains stable performance with focus on digital transformation and retail banking growth...`,
                sentiment: 'NEUTRAL',
                confidence: 0.79,
                drivers: ['Focus on digital banking innovation', 'Expanding retail customer base'],
                risks: ['Increased competition from large banks', 'Regulatory scrutiny on digital services'],
            },
            CTG: {
                summary: `Vietinbank (CTG) shows stable performance with strong government backing and expanding corporate banking services...`,
                sentiment: 'NEUTRAL',
                confidence: 0.81,
                drivers: ['Strong government ties', 'Expanding corporate banking operations'],
                risks: ['Potential exposure to state-owned enterprise debt', 'Slower digital transformation'],
            },
            BID: {
                summary: `BIDV (BID) exhibits stable growth driven by strong corporate lending and government infrastructure projects...`,
                sentiment: 'NEUTRAL',
                confidence: 0.82,
                drivers: ['Leading position in corporate banking', 'Strong government backing'],
                risks: ['Potential exposure to state-owned enterprise debt', 'Slower digital transformation'],
            },
            SHB: {
                summary: `SHB (SHB) shows resilient growth with focus on retail banking and digital transformation initiatives...`,
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Expanding retail customer base', 'Rapid digital transformation'],
                risks: ['Increased competition in retail banking', 'Potential exposure to SME loan defaults'],
            },
            ACB: {
                summary: `ACB (ACB) maintains stable performance with strong focus on digital banking and customer experience...`,
                sentiment: 'BULLISH',
                confidence: 0.87,
                drivers: ['Strong brand reputation', 'Leading digital banking platform'],
                risks: ['Increased competition in digital banking', 'Potential exposure to real estate credit'],
            },
            VCB: {
                summary: `Vietcombank (VCB) exhibits steady growth driven by strong corporate banking and digital transformation...`,
                sentiment: 'BULLISH',
                confidence: 0.89,
                drivers: ['Leading position in corporate banking', 'Strong digital transformation initiatives'],
                risks: ['Potential exposure to state-owned enterprise debt', 'Regulatory scrutiny on large banks'],
            },
            HDB: {
                summary: `HDBank (HDB) shows resilient growth with strong focus on retail banking and consumer finance...`,
                sentiment: 'BULLISH',
                confidence: 0.86,
                drivers: ['Strong position in consumer finance', 'Expanding retail customer base'],
                risks: ['Potential rise in non-performing loans', 'Regulatory changes in consumer lending'],
            },
            HDG: {
                summary: `Ha Do Group (HDG) maintains stable performance with focus on renewable energy and real estate development...`,
                sentiment: 'NEUTRAL',
                confidence: 0.81,
                drivers: ['Strong position in renewable energy', 'Expanding real estate projects'],
                risks: ['Regulatory changes in renewable energy', 'Potential market volatility in real estate'],
            },
            BCM: {
                summary: `Becamex (BCM) shows steady growth driven by industrial park development and infrastructure projects...`,
                sentiment: 'BULLISH',
                confidence: 0.84,
                drivers: ['Extensive land bank in strategic locations', 'Strong position in industrial park development'],
                risks: ['Potential market volatility in real estate', 'Regulatory changes in industrial land development'],
            },
            SZC: {
                summary: `SZC (SZC) exhibits resilient growth driven by industrial park development and infrastructure projects...`,
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Strong position in industrial park development', 'Strategic locations in key economic zones'],
                risks: ['Potential market volatility in real estate', 'Regulatory changes in industrial land development'],
            }
        };

        const defaultData: AiSummaryResponse = {
            summary: `Technical indicators for ${symbol} suggest a period of consolidation with stable fundamentals.`,
            sentiment: 'NEUTRAL',
            confidence: 0.78,
            drivers: ['Stable trading volume', 'Solid sector positioning'],
            risks: ['Macroeconomic uncertainty', 'Market volatility'],
        };

        return { ...defaultData, ...fallbacks[upperSymbol] } as AiSummaryResponse;
    }
}