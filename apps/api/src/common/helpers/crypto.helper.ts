import * as crypto from 'crypto';

const SECRET_KEY = process.env.API_ENCRYPTION_KEY || 'stockintel-aes-key-must-be-32bytes';

export function encryptPayload(data: any): { iv: string; content: string; tag: string } {
    // Generate secure 12-byte initialization vector (standard for GCM)
    const iv = crypto.randomBytes(12);

    // Hash the secret to ensure it is exactly 32 bytes (256 bits)
    const key = crypto.createHash('sha256').update(SECRET_KEY).digest();

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag,
    };
}
