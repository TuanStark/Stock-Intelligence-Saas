/**
 * Helper to fetch company name from ticker symbol.
 */
export const getCompanyName = (sym: string): string => {
  if (!sym) return "Tổng Công ty Cổ phần Đầu tư & Phát triển";

  const dictionary: Record<string, string> = {
    FPT: "Công ty Cổ phần FPT",
    VNM: "Công ty Cổ phần Sữa Việt Nam (Vinamilk)",
    VIC: "Tập đoàn Vingroup - Công ty Cổ phần",
    HPG: "Công ty Cổ phần Tập đoàn Hòa Phát",
    TCB: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)",
    VCB: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
    SSI: "Công ty Cổ phần Chứng khoán SSI",
    MWG: "Công ty Cổ phần Đầu tư Thế giới Di động",
    VRE: "Công ty Cổ phần Vincom Retail",
    GAS: "Tổng Công ty Khí Việt Nam - Công ty Cổ phần",
    MSN: "Tập đoàn Masan",
    VJC: "Công ty Cổ phần Hàng không VietJet",
    PLX: "Tập đoàn Xăng dầu Việt Nam",
    HDB: "Ngân hàng TMCP Phát triển TP. HCM (HDBank)",
    STB: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)",
    MBB: "Ngân hàng TMCP Quân đội (MBBank)",
    ACB: "Ngân hàng TMCP Á Châu",
    VPB: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)",
    TPB: "Ngân hàng TMCP Tiên Phong (TPBank)",
    LPB: "Ngân hàng TMCP Lộc Phát Việt Nam",
  };
  return (
    dictionary[sym.toUpperCase()] || "Tổng Công ty Cổ phần Đầu tư & Phát triển"
  );
};
