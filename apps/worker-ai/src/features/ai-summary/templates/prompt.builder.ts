import { Injectable } from "@nestjs/common";
import { ContextData } from "../types/ai-summary.types";
import { RetrievedChunk } from "../helper/hybrid-retriever.service";

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
    if (
      options?.markdownReport ||
      (options?.qualitativeChunks && options.qualitativeChunks.length > 0)
    ) {
      const markdownReport =
        options.markdownReport || "*(Không tìm thấy báo cáo số liệu cứng)*";

      const chunksText =
        options.qualitativeChunks && options.qualitativeChunks.length > 0
          ? options.qualitativeChunks
              .map((chunk, index) => {
                const dateStr = chunk.createdAt
                  ? new Date(chunk.createdAt).toLocaleDateString("vi-VN")
                  : "N/A";
                const scoreStr = chunk.finalScore
                  ? chunk.finalScore.toFixed(3)
                  : "N/A";
                return `[Nguồn tin số ${index + 1}] [Loại: ${chunk.type}] [Ngày cập nhật: ${dateStr}] [Điểm tin cậy: ${scoreStr}]\nNội dung: ${chunk.content}`;
              })
              .join("\n\n")
          : "*(Không tìm thấy dữ liệu bối cảnh/tin tức liên quan)*";

      return `Bạn là một Cố vấn Đầu tư Chứng khoán Cấp cao (Senior Investment Mentor) với hơn 10 năm kinh nghiệm thực chiến, chuyên hướng dẫn và đưa ra khuyến nghị đầu tư cực kỳ tận tâm, dễ hiểu cho các nhà đầu tư cá nhân mới tham gia thị trường (F0 / nhà đầu tư trẻ tuổi).

Nhiệm vụ của bạn là phân tích toàn diện mã cổ phiếu ${cleanSym} để đưa ra một cẩm nang nhận định đầu tư chuẩn xác, giải thích chi tiết lý do và hướng dẫn hành động từng bước một cách thực tế nhất, giúp người mới không bị mơ hồ và tự tin ra quyết định giao dịch.

Hãy sử dụng các nguồn thông tin xác thực, chất lượng cao được cung cấp dưới đây:

### I. BÁO CÁO SỐ LIỆU TÀI CHÍNH CƠ BẢN VÀ CHỈ SỐ DOANH NGHIỆP CỨNG (TRUY VẤN TRỰC TIẾP)
Dưới đây là số liệu tài chính, định giá, cơ cấu cổ đông, tín hiệu kỹ thuật và cổ tức chính xác từ cơ sở dữ liệu hệ thống:
${markdownReport}

### II. DỮ LIỆU BỐI CẢNH & TIN TỨC CHẤT LƯỢNG CAO (RAG HYBRID RETRIEVAL)
Các bài báo, mô tả chi tiết, hoặc cập nhật hoạt động liên quan:
${chunksText}

---

### YÊU CẦU PHÂN TÍCH VÀ KHUYẾN NGHỊ CHI TIẾT (MENTOR'S GUIDELINES):
1. **Đóng vai Mentor chia sẻ tận tâm cho F0**: Hãy viết bằng giọng văn thân thiện, dễ hiểu, trực quan. Tuyệt đối không dùng thuật ngữ học thuật khô khan mà không giải thích. Hãy ví von đơn giản (Ví dụ: "Chỉ số P/E 13.28 nghĩa là bạn chỉ mất 13.2 năm để thu hồi vốn từ lợi nhuận của doanh nghiệp, rẻ hơn 15% so với trung bình ngành - giống như bạn đang mua được một món đồ hiệu giá hời vậy").
2. **Khuyến nghị Mua/Bán/Quan sát cực kỳ chi tiết**:
   - Chỉ rõ hành động cụ thể: **Nên MUA THÊM**, **Nên BÁN BỚT**, hay **NÊN NẮM GIỮ/QUAN SÁT**?
   - Định lượng số lượng giao dịch cụ thể: "Nên mua thêm bao nhiêu?" (Ví dụ: "Nên giải ngân thêm 10-15% tổng số vốn dự định phân bổ cho mã này, chia làm 2 đợt mua ở vùng giá hỗ trợ...", "Nếu muốn bán, hãy bán chốt lời từng phần khoảng 30-50% vị thế khi giá chạm vùng mục tiêu...").
   - Giải thích cặn kẽ chữ **"TẠI SAO (Lý do hành động)"**: Nêu rõ 2-3 điểm tựa cơ bản/kỹ thuật cốt lõi giải thích vì sao làm vậy để nhà đầu tư trẻ hiểu được logic đằng sau, tăng tính thuyết phục và giảm bớt lo lắng.
3. **Độ dài và cấu trúc**: Nhận định chi tiết khoảng 350 - 450 từ bằng tiếng Việt. Trình bày rõ ràng theo 3 phần chính bằng cách dùng dấu xuống dòng để hiển thị đẹp mắt:
   - 📌 **ĐÁNH GIÁ VỊ THẾ & LÝ DO:** Giải thích chi tiết sức khỏe tài chính của doanh nghiệp, tại sao vị thế này lại an toàn/nguy hiểm cho người mới (giải thích từ ngữ đơn giản).
   - 🎯 **CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT:** Hướng dẫn từng bước mua/bán bao nhiêu %, chia vốn thế nào, tại sao lại dùng tỷ lệ đó.
   - 💸 **VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG:** Cung cấp mốc giá mua tích lũy an toàn, mốc chốt lời mục tiêu, và điểm cắt lỗ phòng vệ nếu xu hướng đảo chiều đột ngột.

### ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Bạn PHẢI phản hồi bằng một đối tượng JSON duy nhất khớp CHÍNH XÁC với schema sau:
{
  "summary": "Nội dung cẩm nang nhận định chi tiết của Cố vấn Đầu tư dài 350-450 từ, được định dạng đẹp mắt theo đúng 3 phần: 📌 ĐÁNH GIÁ VỊ THẾ & LÝ DO, 🎯 CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT, và 💸 VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG.",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": Điền số thực nằm trong khoảng từ 0.0 đến 1.0 (thể hiện mức độ tự tin của phân tích),
  "drivers": ["Động lực tăng trưởng thực chiến 1", "Động lực 2", "Động lực 3"],
  "risks": ["Rủi ro thực chiến lớn nhất 1", "Rủi ro 2", "Rủi ro 3"]
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
      ? `${Number(latestQuote.price).toLocaleString()} VND (${Number(latestQuote.changePercent) >= 0 ? "+" : ""}${Number(latestQuote.changePercent).toFixed(2)}%)`
      : "N/A";

    const signalsText =
      activeSignals && activeSignals.length > 0
        ? activeSignals
            .map((s) => `${s.type} (Strength: ${s.strength})`)
            .join(", ")
        : "No major indicator crossovers detected";

    const newsText =
      recentNews && recentNews.length > 0
        ? recentNews
            .map(
              (n) =>
                `- ${n.headline}: ${n.summary ? n.summary.slice(0, 100) : ""}`,
            )
            .join("\n")
        : "No recent significant corporate press releases";

    let profileText = "N/A";
    if (companyProfile) {
      const mgmt = Array.isArray(companyProfile.management)
        ? companyProfile.management
            .map((m: any) => `${m.name} (${m.position})`)
            .join(", ")
        : "N/A";
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

    const shareholdersText =
      companyShareholders && companyShareholders.length > 0
        ? companyShareholders
            .map(
              (s) =>
                `- ${s.name}: ${Number(s.percentage).toFixed(2)}% ownership (${Number(s.shares).toLocaleString()} shares)`,
            )
            .join("\n")
        : "No major shareholder records available";

    const dividendsText =
      companyDividends && companyDividends.length > 0
        ? companyDividends
            .map(
              (d) =>
                `- Ex-Date: ${new Date(d.exDate).toLocaleDateString("vi-VN")} | Type: ${d.type} | Rate: ${d.rate}`,
            )
            .join("\n")
        : "No recent dividend announcements";

    const financialsText =
      companyFinancialQuarters && companyFinancialQuarters.length > 0
        ? companyFinancialQuarters
            .map(
              (f) =>
                `- Quarter ${f.quarter} | Revenue: ${Number(f.revenue).toLocaleString()} VND | Net Profit: ${Number(f.netProfit).toLocaleString()} VND | ROE: ${f.roe ? f.roe + "%" : "N/A"}`,
            )
            .join("\n")
        : "No quarterly financial statements available";

    return `Bạn là một Cố vấn Đầu tư Chứng khoán Cấp cao (Senior Investment Mentor) tận tâm hướng dẫn cho nhà đầu tư mới (F0). Hãy phân tích các dữ liệu sau cho mã cổ phiếu ${symbol.toUpperCase()} để đưa ra cẩm nang đầu tư thực chiến, chi tiết bằng tiếng Việt, hướng dẫn rõ ràng nên mua/bán bao nhiêu % và tại sao làm thế.

Dữ liệu hệ thống:
- Thị giá và biến động: ${priceText}
- Tín hiệu kỹ thuật phát hiện: ${signalsText}

Hồ sơ doanh nghiệp:
${profileText}

Cơ cấu cổ đông lớn:
${shareholdersText}

Lịch sử chia cổ tức:
${dividendsText}

Kết quả tài chính các quý gần đây:
${financialsText}

Tin tức doanh nghiệp mới nhất:
${newsText}

Khuyến nghị phải tuân thủ đúng 3 phần chính trong summary:
1. 📌 **ĐÁNH GIÁ VỊ THẾ & LÝ DO**: Phân tích dễ hiểu, giải thích logic tại sao vị thế này tốt/xấu.
2. 🎯 **CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT**: Hướng dẫn chi tiết mua thêm bao nhiêu % hay bán bớt bao nhiêu % vị thế, phân bổ vốn chia nhỏ thế nào.
3. 💸 **VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG**: Vùng giá mua an toàn, giá bán mục tiêu và điểm quản trị rủi ro cắt lỗ.

Mọi phân tích viết bằng tiếng Việt tự nhiên, trực quan, dễ hiểu nhất cho F0.

Bạn PHẢI phản hồi bằng một đối tượng JSON duy nhất khớp CHÍNH XÁC với schema sau:
{
  "summary": "String (Nội dung phân tích hướng dẫn chi tiết của Mentor bằng tiếng Việt, khoảng 350-450 từ, định dạng rõ ràng theo đúng 3 phần: 📌 ĐÁNH GIÁ VỊ THẾ & LÝ DO, 🎯 CHIẾN LƯỢC PHÂN BỔ & HÀNH ĐỘNG CHI TIẾT, và 💸 VÙNG GIÁ THAM KHẢO & ĐIỂM DỪNG.)",
  "sentiment": "BULLISH" | "NEUTRAL" | "BEARISH",
  "confidence": Float từ 0.0 đến 1.0,
  "drivers": ["Chuỗi mô tả động lực 1", "Động lực 2", "Động lực 3"],
  "risks": ["Chuỗi mô tả rủi ro 1", "Rủi ro 2", "Rủi ro 3"]
}
Không viết thêm bất kỳ văn bản giới thiệu, kết luận hoặc ký tự bao quanh nào ngoài chuỗi JSON gốc.`;
  }
}
