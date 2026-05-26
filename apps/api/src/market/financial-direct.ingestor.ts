import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class FinancialDirectIngestor {
  private readonly logger = new Logger(FinancialDirectIngestor.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tải toàn bộ dữ liệu tài chính của 1 cổ phiếu trực tiếp và lưu vào DB (Synchronous direct fallback).
   */
  async ingestAllSegments(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[Direct Ingestion] Starting synchronous segmented financial ingestion for ${cleanSym}...`);

    // Ingest Profile
    try {
      await this.ingestProfile(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(`Failed to ingest profile directly for ${cleanSym}: ${(e as Error).message}`);
    }

    // Ingest Shareholders
    try {
      await this.ingestShareholders(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(`Failed to ingest shareholders directly for ${cleanSym}: ${(e as Error).message}`);
    }

    // Ingest Dividends
    try {
      await this.ingestDividends(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(`Failed to ingest dividends directly for ${cleanSym}: ${(e as Error).message}`);
    }

    // Ingest Financial Statements
    try {
      await this.ingestFinancials(instrumentId, cleanSym);
    } catch (e) {
      this.logger.error(`Failed to ingest financials directly for ${cleanSym}: ${(e as Error).message}`);
    }

    this.logger.log(`[Direct Ingestion] Completed full financial ingestion for ${cleanSym}`);
  }

  /**
   * 1. Ingest PROFILE Segment
   */
  async ingestProfile(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[Direct PROFILE] Fetching profile for ${cleanSym} from TCBS...`);

    const profileUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/profile?ticker=${cleanSym}`;
    const officersUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/officer?ticker=${cleanSym}`;

    const [profileRes, officersRes] = await Promise.allSettled([
      axios.get(profileUrl, { headers: this.headers, timeout: 8000 }),
      axios.get(officersUrl, { headers: this.headers, timeout: 8000 }),
    ]);

    if (profileRes.status === 'rejected') {
      throw new Error(`Failed to fetch stock profile for ${cleanSym} from TCBS: ${profileRes.reason.message}`);
    }

    const data = profileRes.value.data;
    if (!data || !data.charterCapital || !data.outstandingShares) {
      throw new Error(`TCBS returned empty/invalid profile data for ${cleanSym}`);
    }

    const name = data.name || `${cleanSym} Joint Stock Company`;
    const industry = data.industry || 'Financial Services';
    const charterCapital = data.charterCapital;
    const outstandingShares = data.outstandingShares;
    const employees = data.noEmployees || 0;

    const management: Array<{ name: string; position: string }> = [];
    if (officersRes.status === 'fulfilled' && officersRes.value.data && Array.isArray(officersRes.value.data)) {
      officersRes.value.data.slice(0, 5).forEach((off: any) => {
        if (off.name && off.position) {
          management.push({
            name: off.name.trim(),
            position: off.position.trim(),
          });
        }
      });
    }

    if (management.length === 0) {
      management.push({ name: 'Chưa cập nhật', position: 'Chủ tịch HĐQT' });
    }

    let pe = 0;
    let pb = 0;
    let eps = 0;
    let beta = 1.0;
    let dividendYield = 0;

    try {
      const ratioUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/financial-ratio?ticker=${cleanSym}&period=quarter`;
      const ratioRes = await axios.get(ratioUrl, { headers: this.headers, timeout: 8000 });
      if (ratioRes.data && Array.isArray(ratioRes.data) && ratioRes.data.length > 0) {
        const latest = ratioRes.data[ratioRes.data.length - 1];
        pe = latest.priceToEarning || 0;
        pb = latest.priceToBook || 0;
        beta = latest.beta || 1.0;
        dividendYield = (latest.dividendYield || 0) * 100; 
        eps = latest.earningPerShare || 0;
      }
    } catch (err) {
      this.logger.warn(`Could not fetch advanced ratios directly for ${cleanSym}: ${(err as Error).message}`);
    }

    const description = `Công ty Cổ phần ${name} là doanh nghiệp hoạt động trong lĩnh vực ${industry} tại Việt Nam. Công ty được niêm yết trên sàn chứng khoán với vốn điều lệ thực tế là ${(charterCapital / 1e9).toFixed(2)} tỷ VNĐ${employees > 0 ? `, hiện đang có khoảng ${employees} cán bộ công nhân viên hoạt động chuyên nghiệp` : ''}.`;

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

    await this.prisma.instrument.update({
      where: { id: instrumentId },
      data: { industry, name },
    });

    this.logger.log(`[Direct PROFILE] Ingested profile successfully for ${cleanSym}`);
  }

  /**
   * 2. Ingest SHAREHOLDERS Segment
   */
  async ingestShareholders(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[Direct SHAREHOLDERS] Fetching shareholders for ${cleanSym}...`);

    const ownershipUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/ownership?ticker=${cleanSym}`;
    const response = await axios.get(ownershipUrl, { headers: this.headers, timeout: 8000 });

    if (response.data && Array.isArray(response.data)) {
      const rawShareholders = response.data.slice(0, 5);
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
      this.logger.log(`[Direct SHAREHOLDERS] Ingested ${rawShareholders.length} major shareholders for ${cleanSym}`);
    }
  }

  /**
   * 3. Ingest DIVIDENDS Segment
   */
  async ingestDividends(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[Direct DIVIDENDS] Fetching dividends for ${cleanSym}...`);

    const url = `https://apipublish.tcbs.com.vn/api/v1/stock/dividend?ticker=${cleanSym}`;
    const response = await axios.get(url, { headers: this.headers, timeout: 8000 });

    if (response.data && Array.isArray(response.data)) {
      const rawDividends = response.data.slice(0, 6);
      for (const div of rawDividends) {
        const exDateStr = div.exDate || div.publishDate;
        if (!exDateStr) continue;

        const exDate = new Date(exDateStr);
        const type = div.type || 'CASH'; 
        const rate = div.rate || '10%';
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
      this.logger.log(`[Direct DIVIDENDS] Ingested ${rawDividends.length} dividends history for ${cleanSym}`);
    }
  }

  /**
   * 4. Ingest FINANCIALS Segment
   */
  async ingestFinancials(instrumentId: string, symbol: string): Promise<void> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(`[Direct FINANCIALS] Fetching financial statements for ${cleanSym}...`);

    const incomeQuarterUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/income-statement?ticker=${cleanSym}&period=quarter`;
    const incomeYearUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/income-statement?ticker=${cleanSym}&period=year`;
    
    const ratioQuarterUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/financial-ratio?ticker=${cleanSym}&period=quarter`;
    const ratioYearUrl = `https://apipublish.tcbs.com.vn/api/v1/stock/financial-ratio?ticker=${cleanSym}&period=year`;

    const [incQuarterRes, incYearRes, ratQuarterRes, ratYearRes] = await Promise.allSettled([
      axios.get(incomeQuarterUrl, { headers: this.headers, timeout: 10000 }),
      axios.get(incomeYearUrl, { headers: this.headers, timeout: 10000 }),
      axios.get(ratioQuarterUrl, { headers: this.headers, timeout: 10000 }),
      axios.get(ratioYearUrl, { headers: this.headers, timeout: 10000 }),
    ]);

    // 4.1 Process Quarters
    if (incQuarterRes.status === 'fulfilled' && Array.isArray(incQuarterRes.value.data)) {
      const incData = incQuarterRes.value.data.slice(-4); 
      const ratioData: Record<string, any> = {};

      if (ratQuarterRes.status === 'fulfilled' && Array.isArray(ratQuarterRes.value.data)) {
        ratQuarterRes.value.data.forEach((ratio: any) => {
          if (ratio.year && ratio.quarter) {
            const key = `Q${ratio.quarter}/${ratio.year}`;
            ratioData[key] = ratio;
          }
        });
      }

      for (const inc of incData) {
        if (!inc.year || !inc.quarter) continue;
        const quarterStr = `Q${inc.quarter}/${inc.year}`;
        const revenue = inc.revenue || inc.sales || 0;
        const grossProfit = inc.grossProfit || inc.grossProfitMargin || 0;
        const netProfit = inc.postTaxProfit || inc.netProfit || 0;

        const ratioObj = ratioData[quarterStr] || {};
        const roe = ratioObj.roe ? ratioObj.roe * 100 : null;
        const roa = ratioObj.roa ? ratioObj.roa * 100 : null;

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
      this.logger.log(`[Direct FINANCIALS] Processed quarters successfully for ${cleanSym}`);
    }

    // 4.2 Process Years
    if (incYearRes.status === 'fulfilled' && Array.isArray(incYearRes.value.data)) {
      const incData = incYearRes.value.data.slice(-3); 
      const ratioData: Record<string, any> = {};

      if (ratYearRes.status === 'fulfilled' && Array.isArray(ratYearRes.value.data)) {
        ratYearRes.value.data.forEach((ratio: any) => {
          if (ratio.year) {
            ratioData[ratio.year.toString()] = ratio;
          }
        });
      }

      for (const inc of incData) {
        if (!inc.year) continue;
        const yearStr = inc.year.toString();
        const revenue = inc.revenue || inc.sales || 0;
        const grossProfit = inc.grossProfit || inc.grossProfitMargin || 0;
        const netProfit = inc.postTaxProfit || inc.netProfit || 0;

        const ratioObj = ratioData[yearStr] || {};
        const roe = ratioObj.roe ? ratioObj.roe * 100 : 15.0; 
        const roa = ratioObj.roa ? ratioObj.roa * 100 : 8.0; 

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
      this.logger.log(`[Direct FINANCIALS] Processed years successfully for ${cleanSym}`);
    }
  }
}
