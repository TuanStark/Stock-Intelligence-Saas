import { Injectable } from '@nestjs/common';
import { ContextData } from '../types/ai-summary.types';

@Injectable()
export class PromptBuilder {
    build(symbol: string, data: ContextData): string {
        const {
            latestQuote,
            activeSignals,
            recentNews,
            companyProfile,
            companyShareholders,
            companyDividends,
            companyFinancialQuarters,
        } = data;

        const priceText = latestQuote
            ? `${Number(latestQuote.price).toLocaleString()} VND (${Number(latestQuote.changePercent) >= 0 ? '+' : ''}${Number(latestQuote.changePercent).toFixed(2)}%)`
            : 'N/A';

        const signalsText = activeSignals && activeSignals.length > 0
            ? activeSignals.map(s => `${s.type} (Strength: ${s.strength})`).join(', ')
            : 'No major indicator crossovers detected';

        const newsText = recentNews && recentNews.length > 0
            ? recentNews.map(n => `- ${n.headline}: ${n.summary ? n.summary.slice(0, 100) : ''}`).join('\n')
            : 'No recent significant corporate press releases';

        // 1. Corporate Profile
        let profileText = 'N/A';
        if (companyProfile) {
            const mgmt = Array.isArray(companyProfile.management)
                ? companyProfile.management.map((m: any) => `${m.name} (${m.position})`).join(', ')
                : 'N/A';
            profileText = `
- Industry: ${companyProfile.industry}
- Description: ${companyProfile.description}
- Charter Capital: ${Number(companyProfile.charterCapital).toLocaleString()} VND
- Outstanding Shares: ${Number(companyProfile.outstandingShares).toLocaleString()}
- PE Ratio: ${companyProfile.pe}
- PB Ratio: ${companyProfile.pb}
- Beta: ${companyProfile.beta}
- Dividend Yield: ${companyProfile.dividendYield}%
- Management Team: ${mgmt}
`;
        }

        // 2. Shareholders
        const shareholdersText = companyShareholders && companyShareholders.length > 0
            ? companyShareholders.map(s => `- ${s.name}: ${Number(s.percentage).toFixed(2)}% ownership (${Number(s.shares).toLocaleString()} shares)`).join('\n')
            : 'No major shareholder records available';

        // 3. Dividends
        const dividendsText = companyDividends && companyDividends.length > 0
            ? companyDividends.map(d => `- Ex-Date: ${new Date(d.exDate).toLocaleDateString('vi-VN')} | Type: ${d.type} | Rate: ${d.rate}`).join('\n')
            : 'No recent dividend announcements';

        // 4. Financial Quarters
        const financialsText = companyFinancialQuarters && companyFinancialQuarters.length > 0
            ? companyFinancialQuarters.map(f => `- Quarter ${f.quarter} | Revenue: ${Number(f.revenue).toLocaleString()} VND | Net Profit: ${Number(f.netProfit).toLocaleString()} VND | ROE: ${f.roe ? f.roe + '%' : 'N/A'}`).join('\n')
            : 'No quarterly financial statements available';

        return `You are a Senior Quantitative Equity Analyst. Analyze the following data for instrument ${symbol.toUpperCase()} and generate an institutional-grade investment thesis summary.

Data:
- Current Price: ${priceText}
- Technical Indicators Triggered: ${signalsText}

Corporate Profile:
${profileText}

Major Shareholders Structure:
${shareholdersText}

Dividend History:
${dividendsText}

Quarterly Financial Performance Trend:
${financialsText}

Recent Corporate News Headlines & Summaries:
${newsText}

Your response must be a valid JSON object matching the following schema EXACTLY:
{
  "summary": "String (Detailed analytical decision thesis summary under 150 words in Vietnamese. Focus on valuation, financial health, recent catalysts, and volume.)",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": Float between 0.0 and 1.0,
  "drivers": ["String", "String", "String"],
  "risks": ["String", "String", "String"]
}
Do not write any introductory or concluding text. Write only the raw JSON.`;
    }
}