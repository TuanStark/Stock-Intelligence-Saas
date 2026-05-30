# Product Business Flow Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer / Product Thinker (10+ năm kinh nghiệm)  
**Mục tiêu:** Xác định nghiệp vụ sản phẩm cốt lõi, user decision flow, feature logic, retention loop và monetization logic để đảm bảo Stock Intelligence SaaS được xây như một decision-support product, không phải chỉ là một dashboard xem cổ phiếu.

---

## 1. Product Truth (Bản chất thật của sản phẩm)

Stock Intelligence SaaS không phải là:
- Website xem giá cổ phiếu đơn thuần.
- Công cụ vẽ biểu đồ (charting tool) thuần túy.
- Nơi chỉ để đọc tin tức.
- Một trình theo dõi danh mục (portfolio tracker) thụ động.

Bản chất thật của sản phẩm là:
> **Một hệ thống hỗ trợ ra quyết định đầu tư**, giúp người dùng tìm cơ hội nhanh hơn, lọc nhiễu tốt hơn, giảm thời gian phân tích và hành động tự tin hơn.

Người dùng trả tiền để mua:
- **Clarity (Sự rõ ràng):** Biết nên nhìn vào mã nào giữa hàng ngàn mã.
- **Speed (Tốc độ):** Biết có gì bất thường đang xảy ra ngay lập tức.
- **Confidence (Sự tự tin):** Giảm bớt sự mơ hồ khi đặt lệnh.
- **Signal (Tín hiệu):** Sản phẩm bán "tín hiệu", không bán "dữ liệu thô".

---

## 2. Core User Job-to-be-Done (JTBD)

Người dùng "thuê" sản phẩm này để làm 5 việc chính:
1. **Scan the market:** "Hôm nay có gì đáng chú ý?"
2. **Validate an opportunity:** "Mã này có thực sự đáng xem/mua không?"
3. **Track positions:** "Danh mục của tôi đang ổn hay đang gặp nguy hiểm?"
4. **React at the right time:** "Khi nào tôi cần phải hành động ngay lập tức?"
5. **Reduce analysis effort:** "Tóm tắt nhanh cho tôi những điều quan trọng nhất."

---

## 3. User Segments & Decision Styles

### 3.1 Retail Investor (Primary)
- **Mục tiêu:** Ra quyết định nhanh, ít tốn thời gian phân tích kỹ thuật/cơ bản phức tạp.
- **Hành vi:** Mở app 1–3 lần/ngày, lướt nhanh, cần sự rõ ràng (Clarity).

### 3.2 Power User (Secondary)
- **Mục tiêu:** Quét thị trường diện rộng, so sánh sâu, cần nhiều lớp dữ liệu.
- **Hành vi:** Dùng screener chuyên sâu, cần mật độ dữ liệu (Data Density) cao, có nhu cầu trích xuất dữ liệu.

---

## 4. Core User Decision Flow (Luồng quyết định cốt lõi)

Đây là xương sống của sản phẩm:

1. **Open App**
2. **See what matters today** (Nhìn thấy thứ quan trọng nhất)
3. **Spot opportunity / risk** (Phát hiện cơ hội hoặc rủi ro)
4. **Open stock detail** (Xem chi tiết mã)
5. **Validate signal** (Xác nhận tín hiệu qua dữ liệu/AI)
6. **Decide:** Watch / Buy / Ignore / Exit (Ra quyết định)
7. **Track position** (Theo dõi vị thế)
8. **Get alerted when action is needed** (Nhận thông báo khi cần hành động)
9. **Return tomorrow** (Quay lại vào ngày mai)

---

## 5. Primary User Journey (Daily Flow)

### Step 1 — Market Scan
- **User muốn biết:** "Cái gì đang nóng? Cái gì bất thường?"
- **Trách nhiệm của Product:** Trả lời trong 5 giây đầu (Top movers, Unusual volume, Market sentiment, Strongest sectors). Nếu thất bại ở đây, người dùng sẽ thoát app.

### Step 2 — Opportunity Discovery
- **Lý do click:** Người dùng chọn 1 mã vì có "tín hiệu" (Tăng mạnh, Volume lạ, AI Signal, Alert).
- **Trách nhiệm của Product:** Phải chỉ ra "Tại sao mã này đáng chú ý?" (Reason to look).

### Step 3 — Opportunity Validation
- **Xác nhận:** "Mã này có đáng để xuống tiền không?"
- **Trách nhiệm của Product:** Biến dữ liệu thô thành thông tin có ý nghĩa (Trend, Momentum, Signal strength, Support/Resistance, AI Summary).

### Step 4 — Decision Point
- **Hành động:** Add watchlist, Buy, Ignore, hoặc Exit. Đây là điểm chuyển đổi giá trị kinh doanh thực sự.

### Step 5 — Position Monitoring
- **User muốn biết:** "Danh mục của tôi có ổn không?"
- **Trách nhiệm của Product:** Portfolio không chỉ là một cái bảng, nó phải là một **Decision Cockpit** (Bảng điều khiển quyết định) hiển thị rủi ro và các mã cần chú ý.

### Step 6 — Alert-Driven Return
- **Cơ chế:** Alerts là công cụ giữ chân (Retention engine). Alert phải trả lời: Cái gì xảy ra? Vì sao quan trọng? Cần làm gì?

---

## 6. Screen-by-Screen Business Logic

### 6.1 Market Page (Opportunity Discovery Engine)
- Nhiệm vụ: Ưu tiên sự chú ý, giảm thời gian quét (Scan time).
- Business Goal: Giảm **Time-to-first-opportunity**.

### 6.2 Stock Detail Page (Decision Validation Engine)
- Nhiệm vụ: Giải thích tín hiệu, giảm sự mơ hồ.
- Business Goal: Chuyển đổi sự chú ý (Attention) thành niềm tin (Conviction).

### 6.3 Watchlist (Intent Queue)
- Nhiệm vụ: Giữ lại các ứng viên đang cân nhắc, chờ đợi tín hiệu chín muồi.
- Business Goal: Giữ cho ý định mua trong tương lai luôn sống.

### 6.4 Portfolio (Position Decision Engine)
- Nhiệm vụ: Hiển thị rủi ro, mức độ tập trung và các hành động cần thực hiện.
- Business Goal: Kéo người dùng quay lại hàng ngày để kiểm soát tài sản.

### 6.5 Alerts (Re-engagement Engine)
- Nhiệm vụ: Kéo người dùng quay lại đúng lúc, kích hoạt hành động.
- Business Goal: Tạo vòng lặp thói quen (Habit loop).

### 6.6 AI Summary (Time Compression Engine)
- Nhiệm vụ: Rút ngắn thời gian hiểu bối cảnh, giảm mệt mỏi khi phân tích.
- Business Goal: Giảm tải nhận thức (Cognitive load).

---

## 7. Product Habit Loop

**Scan market** -> **Spot signal** -> **Validate stock** -> **Take action/watch** -> **Get alerted** -> **Return.**

---

## 8. Retention Loop (Vòng lặp giữ chân)

Người dùng quay lại vì 3 lý do:
1. Có diễn biến thị trường mới để quét (Fresh data).
2. Có danh mục cần theo dõi (Personal stakes).
3. Có thông báo kéo quay lại (External triggers).

---

## 9. Monetization Logic (Logic kiếm tiền)

Người dùng không trả tiền cho dữ liệu thô, họ trả tiền cho:
- **Discovery Speed:** Tìm thấy mã ngon nhanh hơn người khác.
- **Confidence:** Yên tâm hơn khi vào lệnh nhờ hệ thống validation.
- **Convenience:** Tiết kiệm hàng giờ tự ngồi lọc mã.

---

## 10. Product KPIs (Chỉ số đo lường thực sự)

1. **Time to first insight:** Thời gian từ lúc mở app đến khi tìm thấy 1 cơ hội.
2. **Watchlist add rate:** Tỷ lệ mã được thêm vào danh mục theo dõi.
3. **Alert return rate:** Tỷ lệ quay lại app từ thông báo.
4. **D1 / D7 Retention:** Tỷ lệ người dùng quay lại sau 1 ngày và 7 ngày.

---

## 11. Product Failure Modes (Các kịch bản thất bại)

- Quá nhiều nhiễu (Noise), người dùng không biết nhìn vào đâu.
- Trang chi tiết cổ phiếu không trả lời được câu hỏi "Vậy thì sao?" (So what?).
- Thông báo (Alerts) quá nhiều và không có giá trị hành động (Spammy).
- AI viết quá dài nhưng không mang lại thông tin thực tế (Fluffy AI).
