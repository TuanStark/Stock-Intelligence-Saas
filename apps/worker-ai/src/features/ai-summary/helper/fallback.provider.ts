// src/features/ai-summary/fallback.provider.ts
import { Injectable } from '@nestjs/common';
import { AiSummaryResponse } from '../types/ai-summary.types';

@Injectable()
export class FallbackProvider {
    getFallbackData(symbol: string): AiSummaryResponse {
        const upperSymbol = symbol.toUpperCase();

        const fallbacks: Record<string, Partial<AiSummaryResponse>> = {
            HPG: {
                summary: 'Tập đoàn Hòa Phát duy trì vị thế thống lĩnh thị phần thép nội địa với đà hồi phục sản lượng tích cực nhờ dòng vốn đầu tư công mạnh mẽ và nhu cầu xây dựng hạ tầng phục hồi. Dự án Dung Quất 2 kỳ vọng là động lực tăng trưởng cốt lõi giúp tối ưu quy mô công suất trong giai đoạn tới.',
                sentiment: 'BULLISH',
                confidence: 0.87,
                drivers: ['Vị thế dẫn đầu tuyệt đối thị phần thép trong nước', 'Kỳ vọng đóng góp doanh thu lớn từ dự án Dung Quất 2'],
                risks: ['Biến động giá nguyên liệu đầu vào (quặng sắt, than cốc)', 'Rủi ro cạnh tranh từ thép giá rẻ nhập khẩu'],
            },
            FPT: {
                summary: 'Công ty Cổ phần FPT thể hiện vị thế dẫn đầu trong lĩnh vực công nghệ thông tin tại Việt Nam với đà tăng trưởng mạnh mẽ kéo dài nhờ mảng xuất khẩu phần mềm đạt mức tăng trưởng hai con số. Công ty đang tích cực đầu tư mở rộng hạ tầng AI và Cloud, mở ra động lực tăng trưởng mới bền vững trong trung và dài hạn.',
                sentiment: 'BULLISH',
                confidence: 0.89,
                drivers: ['Mảng xuất khẩu phần mềm tiếp tục tăng trưởng mạnh mẽ (>20%)', 'Đẩy mạnh đầu tư vào hạ tầng AI, trung tâm dữ liệu và Cloud'],
                risks: ['Chi phí nhân sự ngành công nghệ tăng cao', 'Biến động tỷ giá hối đoái ảnh hưởng đến doanh thu xuất khẩu'],
            },
            VNM: {
                summary: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk) thể hiện xu hướng tích lũy ổn định trong trung hạn với thị phần nội địa vững chắc trong ngành sữa. Sự đa dạng hóa danh mục sản phẩm và nỗ lực mở rộng xuất khẩu sang các thị trường quốc tế mới là bệ đỡ vững chắc bảo vệ kết quả kinh doanh trước áp lực cạnh tranh.',
                sentiment: 'NEUTRAL',
                confidence: 0.82,
                drivers: ['Thị phần sữa nội địa chiếm ưu thế vượt trội', 'Mở rộng hiệu quả kênh xuất khẩu sang các thị trường mới nổi'],
                risks: ['Chi phí sữa nguyên liệu đầu vào biến động tăng', 'Xuuyên hướng người tiêu dùng chuyển sang sữa thực vật'],
            },
            VND: {
                summary: 'Công ty Cổ phần Chứng khoán VNDIRECT sở hữu nền tảng khách hàng cá nhân lớn mạnh và khả năng phục hồi nhanh chóng sau sự cố bảo mật thông tin. Doanh thu từ mảng dịch vụ chứng khoán và tự doanh dự báo hưởng lợi trực tiếp từ xu hướng hồi phục của thanh khoản thị trường chung.',
                sentiment: 'NEUTRAL',
                confidence: 0.83,
                drivers: ['Thị phần môi giới chứng khoán thuộc nhóm dẫn đầu thị trường', 'Thanh khoản thị trường chung hồi phục mạnh mẽ kích thích mảng tự doanh'],
                risks: ['Cạnh tranh khốc liệt về phí giao dịch (Zero Fee) giữa các công ty chứng khoán', 'Rủi ro an ninh mạng và bảo mật hệ thống thông tin'],
            },
            MSN: {
                summary: 'Tập đoàn Masan (MSN) ghi nhận kết quả phục hồi vững chắc từ mảng kinh doanh tiêu dùng cốt lõi WinCommerce và Masan Consumer Holdings. Chiến lược số hóa hệ sinh thái tiêu dùng và giảm tỷ lệ đòn bẩy tài chính là điểm sáng giúp tối ưu hóa lợi nhuận ròng trong các quý tới.',
                sentiment: 'BULLISH',
                confidence: 0.84,
                drivers: ['Mảng tiêu dùng cốt lõi phục hồi mạnh mẽ', 'Chiến lược tối ưu hóa chi phí vận hành chuỗi WinMart/WinMart+'],
                risks: ['Áp lực nợ vay và chi phí lãi suất trong ngắn hạn', 'Sức mua của người tiêu dùng nội địa hồi phục chậm hơn kỳ vọng'],
            },
            MWG: {
                summary: 'Công ty Cổ phần Đầu tư Thế Giới Di Động (MWG) bước vào giai đoạn phục hồi lợi nhuận ấn tượng nhờ tái cấu trúc thành công chuỗi Thế Giới Di Động & Điện Máy Xanh, kết hợp mảng Bách Hóa Xanh chính thức đạt điểm hòa vốn và bắt đầu đóng góp lợi nhuận dương rõ nét.',
                sentiment: 'BULLISH',
                confidence: 0.88,
                drivers: ['Chuỗi Bách Hóa Xanh đạt điểm hòa vốn và bắt đầu đóng góp lợi nhuận dương', 'Hiệu quả tái cấu trúc chuỗi cửa hàng giúp tối ưu biên lợi nhuận'],
                risks: ['Sự bão hòa của thị trường bán lẻ điện thoại và điện máy', 'Cạnh tranh gay gắt từ các sàn thương mại điện tử trực tuyến'],
            },
            VHM: {
                summary: 'Vinhomes (VHM) thể hiện tiềm năng tăng trưởng trung hạn vững chắc nhờ sở hữu quỹ đất quy mô lớn hàng đầu cả nước cùng khả năng phát triển các đại dự án đô thị phức hợp cực kỳ bài bản. Phân khúc nhà ở thấp tầng vẫn duy trì được lực cầu tốt và biên lợi nhuận ròng vượt trội.',
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Quỹ đất sạch khổng lồ tại các vị trí chiến lược', 'Uy tín thương hiệu dẫn đầu phân khúc bất động sản cao cấp'],
                risks: ['Chính sách pháp lý dự án thắt chặt', 'Thanh khoản thị trường chung chịu ảnh hưởng vĩ mô'],
            },
            VRE: {
                summary: 'Vincom Retail (VRE) duy trì đà kinh doanh ổn định với tỷ lệ lấp đầy cao tại hệ thống trung tâm thương mại lớn nhất cả nước. Khả năng phục hồi mạnh mẽ của ngành bán lẻ tiêu dùng hiện đại là bệ đỡ giúp tăng trưởng biên lợi nhuận gộp từ mảng cho thuê.',
                sentiment: 'NEUTRAL',
                confidence: 0.80,
                drivers: ['Vị trí đắc địa tại các đô thị lớn', 'Xu hướng phát triển thương mại dịch vụ hiện đại nội địa'],
                risks: ['Áp lực cạnh tranh từ các kênh thương mại điện tử trực tuyến', 'Sức mua ngành bán lẻ dao động bất thường'],
            },
            TCB: {
                summary: 'Techcombank (TCB) ghi nhận hiệu quả hoạt động vượt trội nhờ tập trung vào mảng dịch vụ số hóa hiện đại, ngân hàng bán lẻ và tín dụng phục vụ khách hàng SME tiềm năng lớn. Tỷ lệ an toàn vốn (CAR) và biên lãi thuần (NIM) được duy trì ở mức cao so với bình quân ngành.',
                sentiment: 'BULLISH',
                confidence: 0.88,
                drivers: ['Nền tảng công nghệ ngân hàng số dẫn đầu xu hướng', 'Danh mục huy động tiền gửi không kỳ hạn (CASA) có chất lượng rất cao'],
                risks: ['Tỷ lệ nợ xấu tiềm ẩn từ phân khúc bất động sản và trái phiếu doanh nghiệp', 'Cạnh tranh lãi suất huy động gay gắt'],
            },
            MBB: {
                summary: 'Ngân hàng Quân Đội (MBB) thể hiện mức tăng trưởng tín dụng bền bỉ dựa trên tập khách hàng bán lẻ quy mô lớn và hoạt động chuyển đổi số sâu rộng giúp giảm thiểu chi phí huy động. Lợi thế chi phí vốn thấp là bệ phóng giúp ngân hàng duy trì biên lợi nhuận vững chãi.',
                sentiment: 'BULLISH',
                confidence: 0.86,
                drivers: ['Cộng đồng khách hàng trung thành vô cùng lớn', 'Hiệu quả tối ưu hóa chi phí vận hành thông qua các ứng dụng số'],
                risks: ['Áp lực nợ xấu tăng nhẹ từ nhóm khách hàng cá nhân và doanh nghiệp nhỏ', 'Cạnh tranh giành thị phần huy động khốc liệt'],
            },
            VPB: {
                summary: 'VPBank (VPB) kỳ vọng bứt phá nhờ đà phục hồi của công ty tài chính tiêu dùng FE Credit sau quá trình tái cấu trúc sâu rộng, kết hợp mảng ngân hàng lõi tiếp tục mở rộng quy mô tín dụng khách hàng cá nhân và SME năng động.',
                sentiment: 'BULLISH',
                confidence: 0.83,
                drivers: ['Thị phần tín dụng tiêu dùng dần phục hồi ổn định', 'Nguồn lực tài chính dồi dào sau thương vụ phát hành cổ phần chiến lược cho đối tác ngoại'],
                risks: ['Rủi ro kiểm soát nợ xấu ở mảng cho thuê tài chính tiêu dùng', 'Biến động lãi suất thị trường liên ngân hàng'],
            },
            MSB: {
                summary: 'Ngân hàng Hàng Hải (MSB) duy trì tốc độ phát triển ổn định với định hướng tập trung số hóa dịch vụ khách hàng và đẩy mạnh cho vay tiêu dùng thông minh. Ngân hàng tập trung nâng cao chất lượng tài sản và củng cố các tỷ lệ an toàn thanh khoản.',
                sentiment: 'NEUTRAL',
                confidence: 0.79,
                drivers: ['Sáng kiến chuyển đổi số đột phá nâng cao năng lực cạnh tranh', 'Quy mô cho vay bán lẻ mở rộng đều đặn'],
                risks: ['Quy mô tài sản vừa phải tạo áp lực cạnh tranh với các ngân hàng lớn', 'Chất lượng tín dụng trong thời kỳ kinh tế hồi phục chậm'],
            },
            CTG: {
                summary: 'VietinBank (CTG) khẳng định hiệu quả hoạt động vượt bậc nhờ tái cơ cấu thành công danh mục cho vay khách hàng doanh nghiệp lớn, đi đôi với sự hậu thuẫn mạnh mẽ từ Nhà nước và nỗ lực đẩy nhanh tiến độ số hóa dịch vụ tài chính.',
                sentiment: 'NEUTRAL',
                confidence: 0.81,
                drivers: ['Hậu thuẫn tín dụng từ Chính phủ đối với các dự án quốc gia', 'Tăng cường khai thác dịch vụ ngân hàng bán lẻ'],
                risks: ['Trích lập dự phòng nợ xấu ở mức tương đối lớn', 'Năng lực tăng vốn điều lệ gặp một số rào cản hành chính'],
            },
            BID: {
                summary: 'BIDV (BID) giữ vững đà phát triển bền vững nhờ vị thế ngân hàng có quy mô tài sản lớn nhất hệ thống, tiên phong giải ngân các gói vay hạ tầng quốc gia và nâng cao hiệu quả các kênh bán hàng số hóa thế hệ mới.',
                sentiment: 'NEUTRAL',
                confidence: 0.82,
                drivers: ['Quy mô tài sản lớn nhất toàn ngành', 'Dòng tiền dồi dào từ các dự án trọng điểm quốc gia'],
                risks: ['Chi phí dự phòng tín dụng gây áp lực lên lợi nhuận thực tế', 'Tiến trình số hóa mảng ngân hàng bán lẻ cần thêm thời gian để tối ưu'],
            },
            SHB: {
                summary: 'SHB (SHB) ghi nhận tăng trưởng kiên cường thông qua các giải pháp nâng cao hiệu quả quản trị rủi ro và tăng cường đầu tư xây dựng cơ sở hạ tầng công nghệ số thông minh. Ngân hàng đang cải thiện tích cực chất lượng danh mục tài sản sinh lời.',
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Mở rộng tệp khách hàng cá nhân và doanh nghiệp nhỏ vùng ven đô', 'Thúc đẩy giao dịch số hóa tiện lợi'],
                risks: ['Tỷ lệ nợ xấu cần xử lý sau các đợt sáp nhập trước đây', 'Biên NIM chịu áp lực điều chỉnh thu hẹp'],
            },
            ACB: {
                summary: 'ACB (ACB) khẳng định chất lượng tài sản hàng đầu toàn ngành nhờ triết lý quản trị rủi ro tín dụng cực kỳ thận trọng và hiệu quả xuất sắc từ mảng dịch vụ khách hàng cá nhân cao cấp. Ngân hàng hầu như không có nợ xấu liên quan đến trái phiếu hay bất động sản phức tạp.',
                sentiment: 'BULLISH',
                confidence: 0.87,
                drivers: ['Thương hiệu uy tín về tính minh bạch và an toàn tài chính', 'Mô hình ngân hàng bán lẻ hiện đại đạt hiệu quả vận hành tối ưu'],
                risks: ['Áp lực cạnh tranh gay gắt từ các ngân hàng có vốn nhà nước lớn', 'Dư địa tăng trưởng mảng bán lẻ truyền thống dần bão hòa'],
            },
            VCB: {
                summary: 'Vietcombank (VCB) tiếp tục khẳng định vị thế "anh cả" của ngành ngân hàng Việt Nam với hiệu quả sinh lời vượt trội, chất lượng tài sản tốt nhất hệ thống và thế mạnh tuyệt đối trong mảng thanh toán quốc tế và dịch vụ ngoại hối.',
                sentiment: 'BULLISH',
                confidence: 0.89,
                drivers: ['Vị thế thống trị tuyệt đối về uy tín và lợi nhuận dòng ngân hàng', 'Chi phí huy động vốn (COF) thấp nhất hệ thống nhờ CASA vượt trội'],
                risks: ['Quy định kiểm soát tăng trưởng tín dụng chặt chẽ của Ngân hàng Nhà nước', 'Áp lực duy trì đà tăng trưởng cao trên quy mô tài sản khổng lồ'],
            },
            HDB: {
                summary: 'HDBank (HDB) duy trì tốc độ tăng trưởng cao bền bỉ dựa trên thế mạnh khai thác hệ sinh thái khách hàng độc quyền vô cùng rộng lớn cùng sự đóng góp đắc lực từ công ty tài chính tiêu dùng HD Saison.',
                sentiment: 'BULLISH',
                confidence: 0.86,
                drivers: ['Hệ sinh thái khách hàng liên kết rộng khắp cả nước', 'Khả năng sinh lời cao từ phân khúc cho vay nông nghiệp và nông thôn'],
                risks: ['Rủi ro biến động nợ xấu từ mảng cho vay tiêu dùng cá nhân', 'Biến động lãi suất huy động'],
            },
            HDG: {
                summary: 'Tập đoàn Hà Đô (HDG) ghi nhận dòng tiền kinh doanh cực kỳ vững chắc nhờ mảng năng lượng tái tạo (thủy điện, điện mặt trời, điện gió) đóng góp tỷ trọng lớn vào cơ cấu lợi nhuận ổn định dài hạn, kết hợp mảng bất động sản đô thị cao cấp khai thác cuốn chiếu.',
                sentiment: 'NEUTRAL',
                confidence: 0.81,
                drivers: ['Danh mục dự án năng lượng tái tạo đi vào hoạt động ổn định', 'Quỹ đất đô thị sạch có pháp lý rõ ràng'],
                risks: ['Thay đổi chính sách giá FIT năng lượng của Chính phủ', 'Chu kỳ triển khai dự án bất động sản bị kéo dài'],
            },
            BCM: {
                summary: 'Tổng Công ty Becamex IDC (BCM) nắm giữ lợi thế độc quyền lớn nhất trong lĩnh vực phát triển bất động sản khu công nghiệp nhờ quỹ đất sạch khổng lồ tại tỉnh Bình Dương và các khu kinh tế trọng điểm phía Nam. Làn sóng dịch chuyển FDI tiếp tục là động lực phát triển vững bền.',
                sentiment: 'BULLISH',
                confidence: 0.84,
                drivers: ['Quỹ đất khu công nghiệp lớn nhất cả nước', 'Hạ tầng giao thông kết nối đồng bộ đặc biệt tốt'],
                risks: ['Áp lực nợ vay đầu tư cơ sở hạ tầng quy mô lớn', 'Chu kỳ đền bù giải phóng mặt bằng kéo dài'],
            },
            SZC: {
                summary: 'Công ty Cổ phần Phát triển Đô thị Công nghiệp Số 2 (SZC) sở hữu quỹ đất khu công nghiệp Châu Đức (Bà Rịa - Vũng Tàu) vô cùng đắc địa, thu hút mạnh mẽ dòng vốn đầu tư FDI nhờ lợi thế giá thuê cạnh tranh và hạ tầng giao thông kết nối trực tiếp cụm cảng nước sâu Cái Mép.',
                sentiment: 'BULLISH',
                confidence: 0.85,
                drivers: ['Quỹ đất thương mại khu công nghiệp lớn sẵn sàng cho thuê', 'Hưởng lợi trực tiếp từ làn sóng dịch chuyển hạ tầng công nghiệp khu vực phía Nam'],
                risks: ['Biến động chi phí san lấp mặt bằng và đền bù đất đai', 'Cạnh tranh từ các khu công nghiệp lân cận'],
            }
        };

        const defaultData: AiSummaryResponse = {
            summary: `Các chỉ báo kỹ thuật của mã ${symbol} gợi ý xu hướng tích lũy ổn định trong biên độ hẹp với nền tảng tài chính cơ bản tương đối lành mạnh.`,
            sentiment: 'NEUTRAL',
            confidence: 0.78,
            drivers: ['Khối lượng giao dịch duy trì ở mức cân bằng', 'Vị thế ngành vững chắc'],
            risks: ['Yếu tố vĩ mô thị trường chung biến động', 'Tâm lý nhà đầu tư ngắn hạn còn thận trọng'],
        };

        return { ...defaultData, ...fallbacks[upperSymbol] } as AiSummaryResponse;
    }
}