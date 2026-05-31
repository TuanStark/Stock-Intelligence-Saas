import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BillingTxStatus, SubscriptionTier, PaymentProvider } from '@stock-intel/db';

@Injectable()
export class SubscriptionSchedulerService {
    private readonly logger = new Logger(SubscriptionSchedulerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
        @InjectQueue('payment-process') private readonly paymentQueue: Queue,
    ) {}

    /**
     * TÁC VỤ 1: Quét và quét dọn các gói hết hạn (Subscription Expired Sweep)
     * Tần suất: Chạy vào lúc 00:01 hàng ngày.
     */
    @Cron('0 1 0 * * *')
    async sweepExpiredSubscriptions() {
        this.logger.log('[Cron] Bắt đầu quét dọn tài khoản hết hạn...');
        const now = new Date();

        try {
            // Tìm tất cả các Subscription đã quá ngày gia hạn và đang ở trạng thái ACTIVE
            const expiredSubs = await this.prisma.subscription.findMany({
                where: {
                    status: 'ACTIVE',
                    renewalAt: {
                        lt: now,
                    },
                },
            });

            if (expiredSubs.length === 0) {
                this.logger.log('[Cron] Không tìm thấy tài khoản nào hết hạn sử dụng.');
                return;
            }

            this.logger.log(`[Cron] Tìm thấy ${expiredSubs.length} tài khoản quá hạn gia hạn.`);

            for (const sub of expiredSubs) {
                await this.prisma.$transaction(async (tx) => {
                    // Hạ cấp gói về FREE và đổi status thành EXPIRED
                    await tx.subscription.update({
                        where: { id: sub.id },
                        data: {
                            tier: 'FREE' as SubscriptionTier,
                            status: 'ACTIVE', // Ở trạng thái ACTIVE nhưng gói FREE
                            renewalAt: null,
                        },
                    });

                    // Ghi nhận sự kiện hạ cấp
                    await tx.userActivity.create({
                        data: {
                            userId: sub.userId,
                            activityType: 'UNSUBSCRIBE', // Log unsubscribe event
                            metadata: { reason: 'SUBSCRIPTION_EXPIRED', previousTier: sub.tier },
                        },
                    });
                });

                // Xóa cache của người dùng để API Gateway áp dụng ngay lập tức
                await this.redisService.invalidateUserCache(sub.userId);
                this.logger.log(`[Cron] Đã hạ cấp thành công tài khoản User ${sub.userId} về gói FREE do hết hạn.`);
            }
        } catch (err: any) {
            this.logger.error(`[Cron] Lỗi nghiêm trọng khi quét dọn tài khoản hết hạn: ${err.message}`);
        }
    }

    /**
     * TÁC VỤ 2: Tự động đối soát ngân hàng (15-Minute Bank Reconciliation)
     * Tần suất: 15 phút chạy 1 lần.
     * Nhiệm vụ: Quét đơn PENDING cũ trong 2 giờ qua và đối soát trực tiếp API cổng thanh toán.
     */
    @Cron('0 */15 * * * *')
    async reconcilePendingTransactions() {
        this.logger.log('[Cron] Khởi chạy tác vụ đối soát đơn hàng PENDING...');
        const twoHoursAgo = new Date();
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

        try {
            // Tìm các giao dịch PENDING được tạo trong 2 giờ gần đây
            const pendingTxs = await this.prisma.billingTransaction.findMany({
                where: {
                    status: 'PENDING' as BillingTxStatus,
                    createdAt: {
                        gte: twoHoursAgo,
                    },
                },
            });

            if (pendingTxs.length === 0) {
                this.logger.log('[Cron] Không có đơn hàng PENDING cần đối soát.');
                return;
            }

            this.logger.log(`[Cron] Phát hiện ${pendingTxs.length} đơn hàng PENDING cần đối soát.`);

            for (const tx of pendingTxs) {
                // Giả lập gọi API bên thứ ba (PayOS / SePay) để kiểm tra giao dịch
                this.logger.log(`[Cron] Đang gọi đối soát API cho đơn hàng: ${tx.referenceCode} (Cổng: ${tx.provider})`);
                
                // MOCK API CHECK: Tỷ lệ 10% các đơn PENDING là đơn thật được chuyển khoản nhưng mất webhook
                const isPaidOnGateway = Math.random() < 0.1; 

                if (isPaidOnGateway) {
                    const mockProviderTxId = `FT${Date.now().toString().slice(-6)}`;
                    this.logger.log(`[Cron] [Phát hiện lệch!] Đơn hàng ${tx.referenceCode} đã thanh toán trên cổng. Đẩy Job xử lý bù.`);

                    // Đẩy bù job xử lý thanh toán vào BullMQ
                    await this.paymentQueue.add(
                        'process-payment',
                        {
                            provider: tx.provider,
                            referenceCode: tx.referenceCode,
                            providerTxId: mockProviderTxId,
                            amount: tx.amount.toNumber(),
                            rawPayload: { cronReconciled: true, checkTime: new Date() },
                        },
                        {
                            attempts: 3,
                            backoff: { type: 'exponential', delay: 5000 },
                        },
                    );
                } else {
                    this.logger.log(`[Cron] Đơn hàng ${tx.referenceCode} chưa thanh toán trên cổng.`);
                }
            }
        } catch (err: any) {
            this.logger.error(`[Cron] Lỗi khi thực hiện đối soát tự động: ${err.message}`);
        }
    }
}
