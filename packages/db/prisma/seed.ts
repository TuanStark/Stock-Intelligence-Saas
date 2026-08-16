import path from "path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Ensure root .env is loaded
config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Exchanges ─────────────────────────────────────────
  const exchanges = await Promise.all([
    prisma.exchange.upsert({
      where: { code: "HOSE" },
      update: {},
      create: {
        code: "HOSE",
        name: "Ho Chi Minh Stock Exchange",
        market: "VN",
      },
    }),
    prisma.exchange.upsert({
      where: { code: "HNX" },
      update: {},
      create: { code: "HNX", name: "Hanoi Stock Exchange", market: "VN" },
    }),
    prisma.exchange.upsert({
      where: { code: "UPCOM" },
      update: {},
      create: {
        code: "UPCOM",
        name: "Unlisted Public Company Market",
        market: "VN",
      },
    }),
  ]);

  console.log(`  ✅ ${exchanges.length} exchanges seeded`);

  // ─── Sectors ───────────────────────────────────────────
  const sectorNames = [
    "Banking",
    "Real Estate",
    "Securities",
    "Steel",
    "Technology",
    "Retail",
    "Energy",
    "Construction",
    "Food & Beverage",
    "Insurance",
    "Pharmaceuticals",
    "Transportation",
    "Telecommunications",
    "Materials",
    "Utilities",
  ];

  const sectors = await Promise.all(
    sectorNames.map((name) =>
      prisma.sector.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  console.log(`  ✅ ${sectors.length} sectors seeded`);

  // ─── Sample Instruments (Top VN30 stocks) ─────────────
  const hose = exchanges[0];
  const bankingSector = sectors.find((s) => s.name === "Banking")!;
  const realEstateSector = sectors.find((s) => s.name === "Real Estate")!;
  const techSector = sectors.find((s) => s.name === "Technology")!;
  const steelSector = sectors.find((s) => s.name === "Steel")!;
  const retailSector = sectors.find((s) => s.name === "Retail")!;

  const sampleInstruments = [
    {
      symbol: "VCB",
      name: "Vietcombank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "BID",
      name: "BIDV",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "CTG",
      name: "VietinBank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "TCB",
      name: "Techcombank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "MBB",
      name: "MB Bank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "VPB",
      name: "VPBank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "ACB",
      name: "Asia Commercial Bank",
      sectorId: bankingSector.id,
      currency: "VND",
    },
    {
      symbol: "VHM",
      name: "Vinhomes",
      sectorId: realEstateSector.id,
      currency: "VND",
    },
    {
      symbol: "VIC",
      name: "Vingroup",
      sectorId: realEstateSector.id,
      currency: "VND",
    },
    {
      symbol: "VRE",
      name: "Vincom Retail",
      sectorId: retailSector.id,
      currency: "VND",
    },
    {
      symbol: "FPT",
      name: "FPT Corporation",
      sectorId: techSector.id,
      currency: "VND",
    },
    {
      symbol: "HPG",
      name: "Hoa Phat Group",
      sectorId: steelSector.id,
      currency: "VND",
    },
  ];

  const instruments = await Promise.all(
    sampleInstruments.map((inst) =>
      prisma.instrument.upsert({
        where: {
          symbol_exchangeId: { symbol: inst.symbol, exchangeId: hose.id },
        },
        update: {},
        create: {
          symbol: inst.symbol,
          name: inst.name,
          exchangeId: hose.id,
          sectorId: inst.sectorId,
          currency: inst.currency,
          tradable: true,
        },
      }),
    ),
  );

  console.log(`  ✅ ${instruments.length} sample instruments seeded`);

  // ─── Default Developer User ──────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@stockintel.ai" },
    update: {},
    create: {
      email: "admin@stockintel.ai",
      passwordHash:
        "$2b$10$EPf9kdCqMdg.O24jZ63yUeE9l5W5F98p1Kae1y.v5rXoX.Teeu/4u", // admin123
      status: "ACTIVE",
    },
  });
  console.log(`  ✅ Default active user seeded: ${adminUser.email}`);

  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
