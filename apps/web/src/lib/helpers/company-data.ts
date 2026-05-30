export interface Shareholder {
  name: string;
  shares: number;
  percentage: number;
}

export interface OwnershipSegment {
  name: string;
  percentage: number;
  color: string;
}

export interface DividendRecord {
  exDate: string;
  type: 'Tiền mặt' | 'Cổ phiếu';
  rate: string;
}

export interface CapitalHistoryRecord {
  year: number;
  value: number; // in VND
  event: string;
}

export interface NewsArticle {
  title: string;
  date: string;
  source: string;
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
}

export interface CorporateEvent {
  title: string;
  date: string;
  daysLeft: number;
}

export interface ForeignTradeRecord {
  date: string;
  buyVol: number;
  sellVol: number;
  netValue: number; // in VND
}

export interface FinancialQuarter {
  quarter: string;
  revenue: number;
  grossProfit: number;
  netProfit: number;
}

export interface FinancialYear {
  year: string;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  roe: number;
  roa: number;
}

export interface CompanyFinancials {
  overview: {
    description: string;
    industry: string;
    management: { name: string; position: string }[];
  };
  valuation: {
    charterCapital: number;
    outstandingShares: number;
    marketCap: number;
    beta: number;
    eps: number;
    pe: number;
    pb: number;
    dividendYield: number;
  };
  shareholders: {
    major: Shareholder[];
    structure: OwnershipSegment[];
  };
  dividends: DividendRecord[];
  capitalHistory: CapitalHistoryRecord[];
  news: NewsArticle[];
  events: CorporateEvent[];
  stats: {
    foreignTrading: ForeignTradeRecord[];
    yearlyRange: { low: number; high: number; avgVolume: number };
  };
  financials: {
    quarters: FinancialQuarter[];
    years: FinancialYear[];
  };
}
