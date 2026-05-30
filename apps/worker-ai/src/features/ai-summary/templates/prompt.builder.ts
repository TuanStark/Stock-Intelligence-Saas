import { Injectable } from '@nestjs/common';
import { ContextData } from '../types/ai-summary.types';
import { RetrievedChunk } from '../helper/hybrid-retriever.service';

@Injectable()
export class PromptBuilder {
  /**
   * Xây dựng prompt chất lượng cao cho LLM phân tích mã cổ phiếu.
   * Hỗ trợ Hybrid RAG với Markdown Report (Dữ liệu cứng) + Qualitative Chunks (Bối cảnh mềm).
   */
  build(
    symbol: string,
    data: ContextData,
    options?: { markdownReport?: string; qualitativeChunks?: RetrievedChunk[] },
  ): string {
    const cleanSym = symbol.toUpperCase().trim();

    // 1. Nếu có Markdown Report và Qualitative Chunks (Bộ Hybrid RAG mới)
    if (options?.markdownReport || (options?.qualitativeChunks && options.qualitativeChunks.length > 0)) {
      const markdownReport = options.markdownReport || '*(Không tìm thấy báo cáo số liệu cứng)*';
      
      const chunksText = options.qualitativeChunks && options.qualitativeChunks.length > 0
        ? options.qualitativeChunks.map((chunk, index) => {
            const dateStr = chunk.createdAt ? new Date(chunk.createdAt).toLocaleDateString('vi-VN') : 'N/A';
            const scoreStr = chunk.finalScore ? chunk.finalScore.toFixed(3) : 'N/A';
            return `[Nguồn tin số ${index + 1}] [Loại: ${chunk.type}] [Ngày cập nhật: ${dateStr}] [Điểm tin cậy: ${scoreStr}]\nNội dung: ${chunk.content}`;
          }).join('\n\n')
        : '*(Không tìm thấy dữ liệu bối cảnh/tin tức liên quan)*';

      return `Bạn là một Chuyên gia Phân tích Chứng khoán Cấp cao (Senior Quantitative Equity Analyst) có 10 năm kinh nghiệm.
Nhiệm vụ của bạn là phân tích toàn diện mã cổ phiếu ${cleanSym} để đưa ra nhận định đầu tư chuẩn xác, không có sự sai lệch số liệu hay ảo tưởng thông tin.

Hãy sử dụng các nguồn thông tin xác thực, chất lượng cao được cung cấp dưới đây:

### I. BÁO CÁO SỐ LIỆU TÀI CHÍNH CƠ BẢN VÀ CHỈ SỐ DOANH NGHIỆP CỨNG (TRUY VẤN TRỰC TIẾP)
Dưới đây là số liệu tài chính, định giá, cơ cấu cổ đông, tín hiệu kỹ thuật và cổ tức chính xác từ cơ sở dữ liệu hệ thống:
${markdownReport}

### II. DỮ LIỆU BỐI CẢNH & TIN TỨC CHẤT LƯỢNG CAO (RAG HYBRID RETRIEVAL)
Các bài báo, mô tả chi tiết, hoặc cập nhật hoạt động liên quan được sắp xếp theo độ tương đồng ngữ nghĩa và yếu tố suy giảm theo thời gian (tin mới hơn có trọng số cao hơn):
${chunksText}

---

### YÊU CẦU PHÂN TÍCH:
1. **Độ chính xác tuyệt đối:** Hãy phân tích bảng số liệu tài chính (Quý và Năm) để tìm ra xu hướng doanh thu, lợi nhuận ròng, biên lợi nhuận, sức khỏe tài chính và tỷ suất ROE/ROA. Không bao giờ tự bịa ra hoặc làm tròn sai các con số tài chính có sẵn ở bảng trên.
2. **Tổng hợp thông tin mềm:** Phân tích kỹ các tin tức gần đây, sự kiện hỗ trợ hoặc rủi ro vĩ mô/nội tại doanh nghiệp được tìm thấy từ dữ liệu bối cảnh.
3. **Độ dài và ngôn ngữ:** Viết nhận định tóm tắt ngắn gọn, sắc bén và súc tích bằng tiếng Việt (không quá 150 từ). Tập trung vào định giá hiện tại, sức khỏe tài chính, chất xúc tác ngắn hạn và dòng tiền/tín hiệu kỹ thuật.
4. **Không fallback giả:** Không sử dụng bất kỳ thông tin giả định hay dữ liệu mock nào. Nếu số liệu tài chính thiếu, hãy nhận định dựa trên những gì có sẵn và chỉ ra điểm còn trống một cách chuyên nghiệp.

### ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Bạn PHẢI phản hồi bằng một đối tượng JSON duy nhất khớp CHÍNH XÁC với schema sau:
{
  "summary": "Tóm tắt nhận định đầu tư chi tiết, chuyên nghiệp dưới 150 từ bằng tiếng Việt.",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": Điền số thực nằm trong khoảng từ 0.0 đến 1.0 (thể hiện mức độ tự tin của phân tích),
  "drivers": ["Động lực thúc đẩy tăng trưởng 1", "Động lực 2", "Động lực 3"],
  "risks": ["Rủi ro ảnh hưởng tiêu cực 1", "Rủi ro 2", "Rủi ro 3"]
}

Không viết thêm bất kỳ văn bản giới thiệu, kết luận hoặc ký tự bao quanh nào ngoài chuỗi JSON gốc.`;
    }

    // 2. Chế độ cũ (Backward Compatibility) để đảm bảo không lỗi các luồng khác nếu có
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

    const shareholdersText = companyShareholders && companyShareholders.length > 0
      ? companyShareholders.map(s => `- ${s.name}: ${Number(s.percentage).toFixed(2)}% ownership (${Number(s.shares).toLocaleString()} shares)`).join('\n')
      : 'No major shareholder records available';

    const dividendsText = companyDividends && companyDividends.length > 0
      ? companyDividends.map(d => `- Ex-Date: ${new Date(d.exDate).toLocaleDateString('vi-VN')} | Type: ${d.type} | Rate: ${d.rate}`).join('\n')
      : 'No recent dividend announcements';

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