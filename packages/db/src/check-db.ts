import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  try {
    console.log("--- DATABASE DIAGNOSTIC CHECK ---");

    const exchangeCount = await prisma.exchange.count();
    console.log(`Exchanges count: ${exchangeCount}`);

    const sectorCount = await prisma.sector.count();
    console.log(`Sectors count: ${sectorCount}`);

    const instrumentCount = await prisma.instrument.count();
    console.log(`Instruments count: ${instrumentCount}`);

    const quoteCount = await prisma.quote.count();
    console.log(`Quotes count: ${quoteCount}`);

    if (instrumentCount > 0) {
      console.log("\n--- Active Instruments List ---");
      const instruments = await prisma.instrument.findMany({
        take: 10,
        select: { symbol: true, name: true, status: true, tradable: true },
      });
      console.table(instruments);
    }

    if (quoteCount > 0) {
      console.log("\n--- Recent Quotes List ---");
      const quotes = await prisma.quote.findMany({
        take: 5,
        orderBy: { asOf: "desc" },
        select: {
          symbol: true,
          price: true,
          changePercent: true,
          source: true,
          asOf: true,
        },
      });
      console.table(quotes);
    }
  } catch (error) {
    console.error("❌ Check failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
