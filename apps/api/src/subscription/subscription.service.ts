import { Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, PaymentProvider, BillingTxStatus } from '@stock-intel/db';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('payment-process') private readonly paymentQueue: Queue,
    ) { }

    /**
     * Retrieves the subscription status of a user.
     */
    async getSubscription(userId: string) {
        const sub = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        return {
            success: true,
            data: sub || { tier: 'FREE' as SubscriptionTier, status: 'ACTIVE' },
        };
    }

    /**
     * Initiates a subscription upgrade.
     * Generates a unique reference code, registers a PENDING billing transaction,
     * and constructs the dynamic VietQR payment links/syntaxes.
     */
    async initiateUpgrade(userId: string, tier: string, providerStr: string) {
        // 1. Validate Tier
        const upperTier = tier.toUpperCase();
        if (upperTier !== 'PRO' && upperTier !== 'API') {
            throw new BadRequestException(`Invalid subscription upgrade tier: ${tier}`);
        }
        const validTier = upperTier as SubscriptionTier;

        // 2. Validate Payment Provider
        const upperProvider = providerStr.toUpperCase();
        if (upperProvider !== 'PAYOS' && upperProvider !== 'SEPAY') {
            throw new BadRequestException(`Unsupported payment provider: ${providerStr}`);
        }
        const provider = upperProvider as PaymentProvider;

        // 3. Determine pricing (in VND)
        const amount = validTier === 'PRO' ? 199000 : 499000;

        // 4. Generate dynamic reference code (Unique prefix SI + timestamp + random chars)
        const timestamp = Date.now().toString().slice(-8);
        const randomStr = crypto.randomBytes(2).toString('hex').toUpperCase();
        const referenceCode = `SI${timestamp}${randomStr}`;

        // 5. Save the transaction order as PENDING in the database
        const transaction = await this.prisma.billingTransaction.create({
            data: {
                userId,
                amount,
                tier: validTier,
                provider,
                referenceCode,
                status: 'PENDING' as BillingTxStatus,
            },
        });

        // 6. Generate Dynamic Payment QR Code & Gateway Links
        let paymentUrl = '';
        let qrUrl = '';
        let transferInstructions = '';

        if (provider === 'PAYOS') {
            // Simulated PayOS Link & VietQR Generator (resembling VietQR API)
            paymentUrl = `https://payos.vn/pay/${referenceCode}`;
            qrUrl = `https://img.vietqr.io/image/vietinbank-1133224455-compact2.jpg?amount=${amount}&addInfo=${referenceCode}&accountName=STOCK%20INTELLIGENCE`;
            transferInstructions = `Quét mã VietQR hoặc chuyển khoản Vietinbank STK 1133224455 số tiền ${amount}đ với nội dung chuyển khoản: "${referenceCode}"`;
        } else {
            // SePay Bank Transfer Syntax Direct Generation
            paymentUrl = `https://sepay.vn/pay/STOCKINTEL?amount=${amount}&ref=${referenceCode}`;
            qrUrl = `https://img.vietqr.io/image/mb-990022884466-compact2.jpg?amount=${amount}&addInfo=${referenceCode}&accountName=STOCK%20INTELLIGENCE%20SEPAY`;
            transferInstructions = `Vui lòng chuyển khoản đến MB Bank STK 990022884466 số tiền ${amount}đ với nội dung chuyển khoản chính xác: "${referenceCode}"`;
        }

        this.logger.log(`Tạo giao dịch thanh toán thành công: ${referenceCode} cho User: ${userId}`);

        return {
            success: true,
            data: {
                transactionId: transaction.id,
                referenceCode,
                amount,
                provider,
                tier: validTier,
                paymentUrl,
                qrUrl,
                transferInstructions,
            },
        };
    }

    /**
     * Handles secure webhook notifications from PayOS.
     * Verifies the cryptographic HMAC-SHA256 signature to prevent fraud.
     */
    async handlePayosWebhook(payload: any, signature: string) {
        const webhookSecret = process.env.PAYOS_WEBHOOK_SECRET || 'payos_default_secret_2026';

        // 1. Sort payload.data keys alphabetically and convert to query string for manual signature verification
        const sortedData = Object.keys(payload.data)
            .sort()
            .map((key) => {
                let value = payload.data[key];
                if (value === null || value === undefined) {
                    value = '';
                }
                return `${key}=${value}`;
            })
            .join('&');

        const computedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(sortedData)
            .digest('hex');

        // BYPASS TRONG DEV MODE NẾU CHƯA CẤU HÌNH KEY (ĐỂ THUẬN TIỆN CHO DEV TEST CƠ CHẾ KHÔNG CẦN CHỜ KEY THẬT)
        if (
            webhookSecret === 'payos_default_secret_2026' && 
            process.env.NODE_ENV === 'development'
        ) {
            this.logger.warn(`⚠️ [PayOS Webhook] Phát hiện đang sử dụng Webhook Secret mặc định trong môi trường Development. BỎ QUA xác thực chữ ký để tạo thuận lợi cho việc test!`);
        } else if (signature !== computedSignature) {
            this.logger.error(`PayOS Webhook Signature verification failed!`);
            this.logger.error(`Computed: ${computedSignature}`);
            this.logger.error(`Received: ${signature}`);
            throw new UnauthorizedException('Invalid signature');
        }

        // 2. Extract transaction details defensively to prevent TypeError on missing fields
        const orderData = payload.data || {};
        const referenceCode = (orderData.orderCode || '').toString();
        const providerTxId = (orderData.reference || orderData.paymentLinkId || orderData.id || Date.now().toString()).toString();
        const amount = orderData.amount || 0;

        this.logger.log(`Đã nhận webhook PayOS hợp lệ cho đơn hàng ${referenceCode} (TxID: ${providerTxId})`);

        // 3. Push payment job to BullMQ queue for async processing
        await this.paymentQueue.add(
            'process-payment',
            {
                provider: 'PAYOS' as PaymentProvider,
                referenceCode,
                providerTxId,
                amount,
                rawPayload: payload,
            },
            {
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 },
            },
        );

        return { success: true };
    }

    /**
     * Handles secure webhook notifications from SePay.
     */
    async handleSepayWebhook(payload: any, apiKeyHeader: string) {
        const expectedApiKey = process.env.SEPAY_WEBHOOK_SECRET || 'sepay_default_secret_2026';

        // 1. Simple but secure API Key verification for webhook
        if (apiKeyHeader !== expectedApiKey) {
            this.logger.error(`SePay API Key verification failed!`);
            throw new UnauthorizedException('Invalid API Key');
        }

        // 2. Extract transaction details from SePay transaction format
        const referenceCode = payload.content; // Transfer content matches referenceCode
        const providerTxId = payload.id.toString(); // Transaction ID from SePay
        const amount = parseFloat(payload.transferAmount);

        this.logger.log(`Đã nhận webhook SePay hợp lệ cho đơn hàng ${referenceCode}`);

        // 3. Push job to queue
        await this.paymentQueue.add(
            'process-payment',
            {
                provider: 'SEPAY' as PaymentProvider,
                referenceCode,
                providerTxId,
                amount,
                rawPayload: payload,
            },
            {
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 },
            },
        );

        return { success: true };
    }

    /**
     * DEPRECATED: Standard direct upgrade (kept for compatibility, upgraded to log transaction).
     */
    async upgradeSubscription(userId: string, tier: string) {
        const upperTier = tier.toUpperCase();
        if (upperTier !== 'FREE' && upperTier !== 'PRO' && upperTier !== 'API') {
            throw new BadRequestException(`Invalid subscription tier: ${tier}`);
        }
        const validTier = upperTier as SubscriptionTier;

        const sub = await this.prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                tier: validTier,
                status: 'ACTIVE',
                renewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
                tier: validTier,
                status: 'ACTIVE',
                renewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        return {
            success: true,
            data: {
                tier: sub.tier,
                status: sub.status,
                renewalAt: sub.renewalAt,
            },
        };
    }
}
