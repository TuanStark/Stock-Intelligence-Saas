import fs from 'fs';
import path from 'path';

/**
 * Stock Intelligence SaaS — Strongly-Typed Local Environment Configuration for Ingestion Worker
 */

// ─── 1. Ascending Directory Tree Env Loader ────────────────
function loadEnvFromRoot() {
    let currentDir = __dirname;
    // Walk up to 6 directory levels to locate the .env in the monorepo root
    for (let i = 0; i < 6; i++) {
        const potentialEnv = path.join(currentDir, '.env');
        if (fs.existsSync(potentialEnv)) {
            try {
                const envConfig = fs.readFileSync(potentialEnv, 'utf8');
                for (const line of envConfig.split(/\r?\n/)) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    
                    const equalIndex = trimmed.indexOf('=');
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
if (process.env.NODE_ENV !== 'production') {
    loadEnvFromRoot();
}

// ─── 2. Strongly-Typed Config Object ────────────────────────
export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Redis
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
} as const;

// ─── 3. Fail-Fast Startup Validations ───────────────────────
const missingVars: string[] = [];
if (!env.DATABASE_URL) missingVars.push('DATABASE_URL');

if (missingVars.length > 0) {
    console.error('\n❌ CRITICAL STARTUP ERROR: Missing required environment variables in Ingestion Worker:');
    console.error(missingVars.map((v) => `   - ${v}`).join('\n'));
    console.error('\nPlease check your .env file or configuration.\n');
    process.exit(1);
}
