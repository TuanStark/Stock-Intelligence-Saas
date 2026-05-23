import { Injectable } from '@nestjs/common';
import { ContextData } from '../types/ai-summary.types';

@Injectable()
export class PromptBuilder {
    build(symbol: string, data: ContextData): string {
        const { latestQuote, activeSignals, recentNews } = data;

        const priceText = latestQuote
            ? `${Number(latestQuote.price).toLocaleString()} VND (${Number(latestQuote.changePercent) >= 0 ? '+' : ''}${Number(latestQuote.changePercent).toFixed(2)}%)`
            : 'N/A';

        const signalsText = activeSignals.length > 0
            ? activeSignals.map(s => `${s.type} (Strength: ${s.strength})`).join(', ')
            : 'No major indicator crossovers detected';

        const newsText = recentNews.length > 0
            ? recentNews.map(n => `- ${n.headline}: ${n.summary ? n.summary.slice(0, 100) : ''}`).join('\n')
            : 'No recent significant corporate press releases';

        return `You are a Senior Quantitative Equity Analyst. Analyze the following data for instrument ${symbol.toUpperCase()} and generate an institutional-grade investment thesis summary.

Data:
- Current Price: ${priceText}
- Technical Indicators Triggered: ${signalsText}
- Recent Corporate News Headlines & Summaries:
${newsText}

Your response must be a valid JSON object matching the following schema EXACTLY:
{
  "summary": "String (Detailed analytical decision thesis summary under 120 words. Focus on catalyst and volume.)",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": Float between 0.0 and 1.0,
  "drivers": ["String", "String", "String"],
  "risks": ["String", "String", "String"]
}
Do not write any introductory or concluding text. Write only the raw JSON.`;
    }
}