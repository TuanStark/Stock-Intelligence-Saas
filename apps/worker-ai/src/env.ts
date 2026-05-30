import fs from 'fs';
import path from 'path';

/**
 * Stock Intelligence SaaS — Strongly-Typed Local Environment Configuration for AI Worker
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
                        
                        // Overwrite or set env variables so they load fresh
                        process.env[key] = value;
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

// Load environment variables immediately in development
if (process.env.NODE_ENV !== 'production') {
    loadEnvFromRoot();
}

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    LITELLM_API_BASE: process.env.LITELLM_API_BASE || '',
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
} as const;
