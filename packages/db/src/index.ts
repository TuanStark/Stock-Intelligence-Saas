export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";

import { PrismaClient } from "@prisma/client";

let prismaInstance: PrismaClient | null = null;

/**
 * Creates a singleton PrismaClient instance.
 * Reuses the same connection across the application to avoid
 * exhausting the database connection pool.
 */
export function createPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "warn", "error"]
          : ["warn", "error"],
    });
  }
  return prismaInstance;
}

/**
 * Disconnect the singleton PrismaClient.
 * Call this during graceful shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
