import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MarkdownGeneratorService {
  private readonly logger = new Logger(MarkdownGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo báo cáo Markdown tổng hợp toàn bộ dữ liệu cấu trúc cứng của một cổ phiếu.
   */
  async generateMarkdownReport(
    instrumentId: string,
    symbol: string,
  ): Promise<string> {
    const cleanSym = symbol.toUpperCase().trim();
    this.logger.log(
      `[MarkdownGenerator] Generating structured financial report for ${cleanSym}...`,
    );

    const [profile, quote, shareholders, dividends, quarters, years, signals] =
      await Promise.all([
        this.prisma.companyProfile.findUnique({ where: { instrumentId } }),
        this.prisma.quote.findFirst({
          where: { instrumentId },
          orderBy: { asOf: "desc" },
        }),
        this.prisma.companyShareholder.findMany({
          where: { instrumentId },
          orderBy: { percentage: "desc" },
          take: 5,
        }),
        this.prisma.companyDividend.findMany({
          where: { instrumentId },
          orderBy: { exDate: "desc" },
          take: 5,
        }),
        this.prisma.companyFinancialQuarter.findMany({
          where: { instrumentId },
          orderBy: { quarter: "desc" },
          take: 4,
        }),
        this.prisma.companyFinancialYear.findMany({
          where: { instrumentId },
          orderBy: { year: "desc" },
          take: 3,
        }),
        this.prisma.stockSignal.findMany({
          where: { instrumentId },
          orderBy: { detectedAt: "desc" },
          take: 5,
        }),
      ]);

    const quotePrice = quote ? Number(quote.price) : 20000;
    const marketCap = profile
      ? Number(profile.outstandingShares) * quotePrice
      : 0;

    let md = `# BÁO CÁO DỮ LIỆU TÀI CHÍNH CƠ BẢN VÀ CHỈ SỐ DOANH NGHIỆP: MÃ ${cleanSym}\n\n`;

    // 1. Chỉ số định giá cơ bản
    md += `## 1. THÔNG TIN CHỈ SỐ ĐỊNH GIÁ HIỆN TẠI\n`;
    if (profile) {
      md += `- **Thị giá cổ phiếu hiện tại:** ${quotePrice.toLocaleString("vi-VN")} VNĐ\n`;
      md += `- **Ngành nghề:** ${profile.industry}\n`;
      md += `- **Vốn điều lệ:** ${(Number(profile.charterCapital) / 1e9).toFixed(2)} Tỷ VNĐ\n`;
      md += `- **Số lượng cổ phiếu lưu hành:** ${Number(profile.outstandingShares).toLocaleString("vi-VN")} CP\n`;
      md += `- **Vốn hóa thị trường:** ${(marketCap / 1e9).toFixed(2)} Tỷ VNĐ\n`;
      md += `- **Hệ số Beta:** ${Number(profile.beta).toFixed(2)}\n`;
      md += `- **EPS cơ bản:** ${Number(profile.eps).toLocaleString("vi-VN")} VNĐ\n`;
      md += `- **Chỉ số P/E:** ${Number(profile.pe).toFixed(2)}\n`;
      md += `- **Chỉ số P/B:** ${Number(profile.pb).toFixed(2)}\n`;
      md += `- **Tỷ suất cổ tức (Dividend Yield):** ${Number(profile.dividendYield).toFixed(2)}%\n\n`;
    } else {
      md += `*(Dữ liệu hồ sơ cơ bản hiện chưa được cập nhật)*\n\n`;
    }

    // 2. Kết quả kinh doanh theo Quý
    md += `## 2. KẾT QUẢ KINH DOANH 4 QUÝ GẦN NHẤT\n`;
    if (quarters.length > 0) {
      md += `| Kỳ báo cáo | Doanh thu thuần (Tỷđ) | Lợi nhuận gộp (Tỷđ) | Lợi nhuận sau thuế (Tỷđ) | ROE (%) | ROA (%) |\n`;
      md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;
      // Đảo chiều để hiển thị theo trình tự thời gian tăng dần cho AI dễ phân tích xu hướng
      const sortedQuarters = [...quarters].reverse();
      for (const q of sortedQuarters) {
        md += `| ${q.quarter} | ${(Number(q.revenue) / 1e9).toFixed(2)} | ${(Number(q.grossProfit) / 1e9).toFixed(2)} | ${(Number(q.netProfit) / 1e9).toFixed(2)} | ${q.roe ? Number(q.roe).toFixed(2) : "0.00"} | ${q.roa ? Number(q.roa).toFixed(2) : "0.00"} |\n`;
      }
      md += `\n`;
    } else {
      md += `*(Không tìm thấy lịch sử báo cáo tài chính theo Quý)*\n\n`;
    }

    // 3. Kết quả kinh doanh theo Năm
    md += `## 3. HIỆU QUẢ HOẠT ĐỘNG 3 NĂM TÀI CHÍNH GẦN NHẤT\n`;
    if (years.length > 0) {
      md += `| Năm tài chính | Tổng doanh thu (Tỷđ) | Lợi nhuận ròng (Tỷđ) | Hệ số ROE (%) | Hệ số ROA (%) |\n`;
      md += `| :--- | :---: | :---: | :---: | :---: |\n`;
      const sortedYears = [...years].reverse();
      for (const y of sortedYears) {
        md += `| ${y.year} | ${(Number(y.revenue) / 1e9).toFixed(2)} | ${(Number(y.netProfit) / 1e9).toFixed(2)} | ${Number(y.roe).toFixed(2)}% | ${Number(y.roa).toFixed(2)}% |\n`;
      }
      md += `\n`;
    } else {
      md += `*(Không tìm thấy lịch sử báo cáo tài chính theo Năm)*\n\n`;
    }

    // 4. Lịch sử chia cổ tức
    md += `## 4. LỊCH SỬ CHI TRẢ CỔ TỨC GẦN NHẤT\n`;
    if (dividends.length > 0) {
      md += `| Ngày GDKHQ | Hình thức chi trả | Tỷ lệ / Giá trị |\n`;
      md += `| :--- | :--- | :--- |\n`;
      for (const d of dividends) {
        const typeStr = d.type === "CASH" ? "Tiền mặt" : "Cổ phiếu";
        md += `| ${new Date(d.exDate).toLocaleDateString("vi-VN")} | ${typeStr} | ${d.rate} |\n`;
      }
      md += `\n`;
    } else {
      md += `*(Doanh nghiệp chưa chia cổ tức hoặc chưa cập nhật dữ liệu lịch sử)*\n\n`;
    }

    // 5. Cơ cấu cổ đông lớn
    md += `## 5. DÀNH SÁCH CỔ ĐÔNG LỚN SỞ HỮU CHỦ CHỐT\n`;
    if (shareholders.length > 0) {
      md += `| Tên cổ đông | Số lượng cổ phiếu nắm giữ | Tỷ lệ sở hữu (%) | Loại cổ đông |\n`;
      md += `| :--- | :---: | :---: | :--- |\n`;
      for (const s of shareholders) {
        const typeStr = s.isForeign ? "Nước ngoài" : "Trong nước";
        md += `| ${s.name} | ${Number(s.shares).toLocaleString("vi-VN")} | ${Number(s.percentage).toFixed(2)}% | ${typeStr} |\n`;
      }
      md += `\n`;
    } else {
      md += `*(Cơ cấu cổ đông lớn trống hoặc chưa đồng bộ)*\n\n`;
    }

    // 6. Các tín hiệu phân tích kỹ thuật hiện tại
    md += `## 6. CÁC TÍN HIỆU KỸ THUẬT QUÉT TỪ HỆ THỐNG TRONG PHIÊN\n`;
    if (signals.length > 0) {
      md += `| Thời điểm | Loại tín hiệu | Mức độ | Diễn giải chi tiết |\n`;
      md += `| :--- | :--- | :---: | :--- |\n`;
      for (const sig of signals) {
        md += `| ${new Date(sig.detectedAt).toLocaleDateString("vi-VN")} | ${sig.type.replace("_", " ")} | ${sig.strength} | ${sig.explanation || "Không có mô tả"} |\n`;
      }
      md += `\n`;
    } else {
      md += `*(Hiện tại không ghi nhận tín hiệu kỹ thuật đặc biệt nào kích hoạt)*\n\n`;
    }

    return md;
  }
}
