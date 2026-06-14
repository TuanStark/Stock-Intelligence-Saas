import { Injectable, Logger } from "@nestjs/common";
import YahooFinance from "yahoo-finance2";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FinancialDataIngestor {
  private readonly logger = new Logger(FinancialDataIngestor.name);
  private readonly yf = new YahooFinance();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tải toàn bộ dữ liệu tài chính của 1 cổ phiếu theo dạng từng phần (All segments).
   */
  async ingestAllSegments(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(
      `[Ingestion] Starting full segmented financial ingestion for ${cleanSym}...`,
    );

    // Ingest Profile
    try {
      await this.ingestProfile(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(
        `Failed to ingest profile for ${cleanSym}: ${(e as Error).message}`,
      );
    }

    // Ingest Shareholders
    try {
      await this.ingestShareholders(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(
        `Failed to ingest shareholders for ${cleanSym}: ${(e as Error).message}`,
      );
    }

    // Ingest Dividends
    try {
      await this.ingestDividends(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(
        `Failed to ingest dividends for ${cleanSym}: ${(e as Error).message}`,
      );
    }

    // Ingest Financial Statements
    try {
      await this.ingestFinancials(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(
        `Failed to ingest financials for ${cleanSym}: ${(e as Error).message}`,
      );
    }

    this.logger.log(
      `[Ingestion] Completed full financial ingestion for ${cleanSym}`,
    );
  }

  /**
   * 1. Ingest PROFILE Segment
   */
  async ingestProfile(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(
      `[PROFILE] Fetching profile for ${cleanSym} from Yahoo Finance...`,
    );

    const yahooSymbol = `${cleanSym}.VN`;

    try {
      const summary = (await this.yf.quoteSummary(yahooSymbol, {
        modules: [
          "summaryProfile",
          "defaultKeyStatistics",
          "price",
          "summaryDetail",
        ],
      })) as any;

      if (!summary) {
        throw new Error(`Empty Yahoo Finance response for ${yahooSymbol}`);
      }

      const p = summary.price || {};
      const sp = summary.summaryProfile || {};
      const ks = summary.defaultKeyStatistics || {};
      const sd = summary.summaryDetail || {};

      const name =
        p.longName || p.shortName || `${cleanSym} Joint Stock Company`;
      const industry = sp.industry || "Financial Services";
      const outstandingShares =
        ks.sharesOutstanding || p.sharesOutstanding || 0;
      const charterCapital = outstandingShares * 10000; // Par value in VN is 10k VND per share
      const employees = sp.fullTimeEmployees || 0;
      const management: Array<{ name: string; position: string }> = [];

      if (sp.companyOfficers && Array.isArray(sp.companyOfficers)) {
        sp.companyOfficers.slice(0, 5).forEach((off: any) => {
          if (off.name && off.title) {
            management.push({
              name: off.name.trim(),
              position: off.title.trim(),
            });
          }
        });
      }

      const pe =
        sd.trailingPE ||
        sd.forwardPE ||
        (p.regularMarketPrice && ks.trailingEps
          ? p.regularMarketPrice / ks.trailingEps
          : 0) ||
        0;
      const pb = ks.priceToBook || sd.priceToBook || 0;
      const eps = ks.trailingEps || 0;
      const beta = ks.beta || sd.beta || 1.0;
      const dividendYield = (sd.dividendYield || 0) * 100; // standard format as percentage e.g. 3.5%

      const description = `Công ty Cổ phần ${name} là doanh nghiệp hoạt động trong lĩnh vực ${industry} tại Việt Nam. Công ty được niêm yết trên sàn chứng khoán với vốn điều lệ thực tế là ${(charterCapital / 1e9).toFixed(2)} tỷ VNĐ, hiện đang có khoảng ${employees} cán bộ công nhân viên hoạt động chuyên nghiệp.`;

      await this.prisma.companyProfile.upsert({
        where: { instrumentId },
        update: {
          description,
          industry,
          management: management as any,
          charterCapital,
          outstandingShares,
          beta,
          eps,
          pe,
          pb,
          dividendYield,
          updatedAt: new Date(),
        },
        create: {
          instrumentId,
          description,
          industry,
          management: management as any,
          charterCapital,
          outstandingShares,
          beta,
          eps,
          pe,
          pb,
          dividendYield,
        },
      });

      // Sync exchange industry info if instrument doesn't have it
      await this.prisma.instrument.update({
        where: { id: instrumentId },
        data: { industry, name },
      });

      this.logger.log(
        `[PROFILE] Ingested profile successfully for ${cleanSym}`,
      );
    } catch (error) {
      this.logger.error(
        `Yahoo Finance failed to fetch profile for ${cleanSym}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 2. Ingest SHAREHOLDERS Segment
   */
  async ingestShareholders(
    instrumentId: string,
    symbol: string,
  ): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[SHAREHOLDERS] Fetching shareholders for ${cleanSym}...`);

    const rawShareholders: any[] = [];
    try {
      const yahooSymbol = `${cleanSym}.VN`;
      const summary = (await this.yf.quoteSummary(yahooSymbol, {
        modules: [
          "institutionOwnership",
          "fundOwnership",
          "majorDirectHolders",
        ],
      })) as any;
      if (
        summary?.institutionOwnership?.ownershipList &&
        Array.isArray(summary.institutionOwnership.ownershipList)
      ) {
        summary.institutionOwnership.ownershipList
          .slice(0, 5)
          .forEach((item: any) => {
            if (item.organization) {
              rawShareholders.push({
                name: item.organization,
                percentage: (item.pctHeld || 0) * 100,
                shares: item.position || 0,
                isForeign: true,
              });
            }
          });
      }
    } catch (e) {
      this.logger.error(
        `Could not fetch shareholders from Yahoo for ${cleanSym}: ${(e as Error).message}`,
      );
      throw e;
    }

    for (const sh of rawShareholders) {
      if (!sh.name) continue;

      const name = sh.name.trim();
      const percentage = sh.percentage || 0;
      const shares = sh.shares ? BigInt(sh.shares) : BigInt(0);
      const isForeign = sh.isForeign || false;

      await this.prisma.companyShareholder.upsert({
        where: {
          instrumentId_name: {
            instrumentId,
            name,
          },
        },
        update: {
          shares,
          percentage,
          isForeign,
          updatedAt: new Date(),
        },
        create: {
          instrumentId,
          name,
          shares,
          percentage,
          isForeign,
        },
      });
    }
    this.logger.log(
      `[SHAREHOLDERS] Ingested ${rawShareholders.length} major shareholders for ${cleanSym}`,
    );
  }

  /**
   * 3. Ingest DIVIDENDS Segment
   */
  async ingestDividends(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(
      `[DIVIDENDS] Fetching dividends for ${cleanSym} from Yahoo Finance...`,
    );

    let rawDividends: any[] = [];
    try {
      const yahooSymbol = `${cleanSym}.VN`;
      const period1 = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
      const period2 = new Date();
      const divResult = await this.yf.historical(yahooSymbol, {
        period1,
        period2,
        events: "dividends",
      });

      if (divResult && Array.isArray(divResult) && divResult.length > 0) {
        rawDividends = divResult.map((item: any) => {
          const value = item.dividends || 0;
          const rate =
            value >= 10
              ? `${((value / 10000) * 100).toFixed(0)}%`
              : `${(value * 100).toFixed(0)}%`;
          return {
            exDate: item.date,
            type: "CASH",
            rate,
            value,
          };
        });
      }
    } catch (error) {
      this.logger.error(
        `Yahoo Finance failed to fetch dividends for ${cleanSym}: ${(error as Error).message}`,
      );
      throw error;
    }

    const processedDividends = rawDividends.slice(0, 6);

    for (const div of processedDividends) {
      const exDateStr = div.exDate || div.publishDate;
      if (!exDateStr) continue;

      const exDate = new Date(exDateStr);
      const type = div.type || "CASH";
      const rate = div.rate || "10%";
      const value = div.value ? div.value : null;

      await this.prisma.companyDividend.upsert({
        where: {
          instrumentId_exDate_type: {
            instrumentId,
            exDate,
            type,
          },
        },
        update: {
          rate,
          value,
          updatedAt: new Date(),
        },
        create: {
          instrumentId,
          exDate,
          type,
          rate,
          value,
        },
      });
    }
    this.logger.log(
      `[DIVIDENDS] Ingested ${processedDividends.length} dividends history for ${cleanSym}`,
    );
  }

  /**
   * 4. Ingest FINANCIALS (Income Statement & Ratios) Segment
   */
  async ingestFinancials(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(
      `[FINANCIALS] Fetching financial statements for ${cleanSym} from Yahoo Finance...`,
    );

    const yahooSymbol = `${cleanSym}.VN`;
    let financials: any;
    let roe = 0;
    let roa = 0;

    try {
      financials = (await this.yf.quoteSummary(yahooSymbol, {
        modules: [
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",
          "financialData",
        ],
      })) as any;
      if (!financials) {
        throw new Error("Empty financial quoteSummary response");
      }

      const fd = financials.financialData || {};
      roe = fd.returnOnEquity ? fd.returnOnEquity.raw * 100 : 0;
      roa = fd.returnOnAssets ? fd.returnOnAssets.raw * 100 : 0;
    } catch (error) {
      this.logger.error(
        `Yahoo Finance failed to fetch financials for ${cleanSym}: ${(error as Error).message}`,
      );
      throw error;
    }

    // 4.1 Process Quarters
    const quarterReports =
      financials?.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
    if (Array.isArray(quarterReports) && quarterReports.length > 0) {
      const incData = quarterReports.slice(-4);
      for (const inc of incData) {
        if (!inc.endDate) continue;
        const date = new Date(inc.endDate);
        const qNum = Math.floor(date.getMonth() / 3) + 1;
        const quarterStr = `Q${qNum}/${date.getFullYear()}`;

        const revenue = inc.totalRevenue?.raw ?? inc.totalRevenue ?? 0;
        const grossProfit = inc.grossProfit?.raw ?? inc.grossProfit ?? 0;
        const netProfit = inc.netIncome?.raw ?? inc.netIncome ?? 0;

        await this.prisma.companyFinancialQuarter.upsert({
          where: {
            instrumentId_quarter: {
              instrumentId,
              quarter: quarterStr,
            },
          },
          update: {
            revenue,
            grossProfit,
            netProfit,
            roe,
            roa,
            updatedAt: new Date(),
          },
          create: {
            instrumentId,
            quarter: quarterStr,
            revenue,
            grossProfit,
            netProfit,
            roe,
            roa,
          },
        });
      }
      this.logger.log(
        `[FINANCIALS] Processed ${incData.length} quarters for ${cleanSym}`,
      );
    }

    // 4.2 Process Years
    const yearReports =
      financials?.incomeStatementHistory?.incomeStatementHistory || [];
    if (Array.isArray(yearReports) && yearReports.length > 0) {
      const incData = yearReports.slice(-3);
      for (const inc of incData) {
        if (!inc.endDate) continue;
        const date = new Date(inc.endDate);
        const yearStr = date.getFullYear().toString();

        const revenue = inc.totalRevenue?.raw ?? inc.totalRevenue ?? 0;
        const grossProfit = inc.grossProfit?.raw ?? inc.grossProfit ?? 0;
        const netProfit = inc.netIncome?.raw ?? inc.netIncome ?? 0;

        await this.prisma.companyFinancialYear.upsert({
          where: {
            instrumentId_year: {
              instrumentId,
              year: yearStr,
            },
          },
          update: {
            revenue,
            grossProfit,
            netProfit,
            roe,
            roa,
            updatedAt: new Date(),
          },
          create: {
            instrumentId,
            year: yearStr,
            revenue,
            grossProfit,
            netProfit,
            roe,
            roa,
          },
        });
      }
      this.logger.log(
        `[FINANCIALS] Processed ${incData.length} years for ${cleanSym}`,
      );
    }
  }
}
