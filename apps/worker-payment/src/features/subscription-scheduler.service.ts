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
                const updated = await this.prisma.$transaction(async (tx) => {
                    // Chống Race Condition: Query lại subscription xem trong lúc chờ quét có ai nâng cấp/gia hạn không
                    const currentSub = await tx.subscription.findUnique({
                        where: { id: sub.id },
                    });

                    // Nếu subscription không còn tồn tại hoặc status không phải ACTIVE hoặc renewalAt không còn nhỏ hơn now, skip
                    if (!currentSub || currentSub.status !== 'ACTIVE' || !currentSub.renewalAt || currentSub.renewalAt >= now) {
                        return false;
                    }

                    // Hạ cấp gói về FREE và đổi status thành ACTIVE nhưng gói FREE
                    await tx.subscription.update({
                        where: { id: sub.id },
                        data: {
                            tier: 'FREE' as SubscriptionTier,
                            status: 'ACTIVE',
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

                    return true;
                });

                if (updated) {
                    // Xóa cache của người dùng để API Gateway áp dụng ngay lập tức
                    await this.redisService.invalidateUserCache(sub.userId);
                    this.logger.log(`[Cron] Đã hạ cấp thành công tài khoản User ${sub.userId} về gói FREE do hết hạn.`);
                } else {
                    this.logger.log(`[Cron] Bỏ qua hạ cấp cho User ${sub.userId} vì gói cước đã được cập nhật/thay đổi.`);
                }
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
        this.logger.log('[Cron] Khởi chạy tác vụ dọn dẹp đơn hàng PENDING quá hạn...');
        const twoHoursAgo = new Date();
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

        try {
            // Tìm và đóng các giao dịch PENDING đã tạo quá 2 giờ (hết hạn thanh toán)
            const expiredTxs = await this.prisma.billingTransaction.findMany({
                where: {
                    status: 'PENDING' as BillingTxStatus,
                    createdAt: {
                        lt: twoHoursAgo,
                    },
                },
            });

            if (expiredTxs.length > 0) {
                this.logger.log(`[Cron] Phát hiện ${expiredTxs.length} giao dịch PENDING quá hạn (2 giờ). Cập nhật trạng thái thành EXPIRED.`);
                for (const tx of expiredTxs) {
                    await this.prisma.billingTransaction.update({
                        where: { id: tx.id },
                        data: {
                            status: 'EXPIRED' as BillingTxStatus,
                            metadata: {
                                ...(tx.metadata as object || {}),
                                expiredAt: new Date(),
                                reason: 'PENDING_TIMEOUT_2H'
                            }
                        }
                    });
                    this.logger.log(`[Cron] Đơn hàng ${tx.referenceCode} đã tự động chuyển sang trạng thái EXPIRED.`);
                }
            } else {
                this.logger.log('[Cron] Không có đơn hàng PENDING nào bị quá hạn.');
            }
        } catch (err: any) {
            this.logger.error(`[Cron] Lỗi khi thực hiện dọn dẹp đơn hàng quá hạn: ${err.message}`);
        }
    }
}
