import fs from "fs";
import path from "path";

/**
 * Stock Intelligence SaaS — Strongly-Typed Local Environment Configuration for Payment Worker
 */

// ─── 1. Ascending Directory Tree Env Loader ────────────────
function loadEnvFromRoot() {
  let currentDir = __dirname;
  // Walk up to 6 directory levels to locate the .env in the monorepo root
  for (let i = 0; i < 6; i++) {
    const potentialEnv = path.join(currentDir, ".env");
    if (fs.existsSync(potentialEnv)) {
      try {
        const envConfig = fs.readFileSync(potentialEnv, "utf8");
        for (const line of envConfig.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;

          const equalIndex = trimmed.indexOf("=");
          if (equalIndex > 0) {
            const key = trimmed.slice(0, equalIndex).trim();
            let value = trimmed.slice(equalIndex + 1).trim();

            // Strip wrapping quotes
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

            if (process.env[key] === undefined) {
              process.env[key] = value;
            }
          }
        }
      } catch (err) {
        // Fail silently during reading
      }
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
}

// Load environment variables immediately
if (process.env.NODE_ENV !== "production") {
  loadEnvFromRoot();
}

// ─── 2. Strongly-Typed Config Object ────────────────────────
export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.WORKER_PAYMENT_PORT || process.env.PORT || "3010", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",

  // Webhook secrets (required for validation)
  PAYOS_WEBHOOK_SECRET:
    process.env.PAYOS_WEBHOOK_SECRET || "payos_default_secret_2026",
  SEPAY_WEBHOOK_SECRET:
    process.env.SEPAY_WEBHOOK_SECRET || "sepay_default_secret_2026",
} as const;

// ─── 3. Fail-Fast Startup Validations ───────────────────────
const missingVars: string[] = [];
if (!env.DATABASE_URL) missingVars.push("DATABASE_URL");

// In production, we strictly require secure non-default keys for webhooks
if (env.NODE_ENV === "production") {
  if (
    !process.env.PAYOS_WEBHOOK_SECRET ||
    env.PAYOS_WEBHOOK_SECRET === "payos_default_secret_2026"
  ) {
    missingVars.push(
      "PAYOS_WEBHOOK_SECRET (missing or using unsafe default value)",
    );
  }
  if (
    !process.env.SEPAY_WEBHOOK_SECRET ||
    env.SEPAY_WEBHOOK_SECRET === "sepay_default_secret_2026"
  ) {
    missingVars.push(
      "SEPAY_WEBHOOK_SECRET (missing or using unsafe default value)",
    );
  }
}

if (missingVars.length > 0) {
  console.error(
    "\n❌ CRITICAL STARTUP ERROR: Missing required environment variables in Payment Worker:",
  );
  console.error(missingVars.map((v) => `   - ${v}`).join("\n"));
  console.error("\nPlease check your .env file or configuration.\n");
  process.exit(1);
}
export type Env = typeof env;
