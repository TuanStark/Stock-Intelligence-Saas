import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { Injectable, Logger } from "@nestjs/common";
import { SubscriptionTier, BillingTxStatus } from "@stock-intel/db";

@Processor("payment-process")
@Injectable()
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  /**
   * Executes the payment job asynchronously with extreme safety.
   */
  async process(job: Job<any>): Promise<any> {
    const { referenceCode, providerTxId, amount, provider } = job.data;
    const redisClient = this.redisService.getClient();

    this.logger.log(
      `[BullMQ] Bắt đầu xử lý thanh toán cho giao dịch: ${referenceCode}`,
    );

    // 1. LỚP BẢO VỆ 1: Khóa phân tán (Distributed Lock) trên Redis bằng referenceCode
    const lockKey = `lock:payment:process:${referenceCode}`;
    const acquireLock = await redisClient.set(
      lockKey,
      "LOCKED",
      "PX",
      10000,
      "NX",
    );

    if (!acquireLock) {
      this.logger.warn(
        `[BullMQ] Phát hiện xử lý song song cho đơn hàng ${referenceCode}. Skip job.`,
      );
      return { status: "LOCKED_BY_ANOTHER_PROCESS" };
    }

    try {
      // 2. Chạy Database Transaction cô lập để xử lý
      const result = await this.prisma.$transaction(async (tx) => {
        // Đọc và khóa bản ghi BillingTransaction
        const dbTx = await tx.billingTransaction.findUnique({
          where: { referenceCode },
        });

        if (!dbTx) {
          throw new Error(
            `Không tìm thấy giao dịch thanh toán trong hệ thống: ${referenceCode}`,
          );
        }

        // LỚP BẢO VỆ 2: Chống lặp giao dịch (Idempotency check)
        if (dbTx.status === ("SUCCESS" as BillingTxStatus)) {
          this.logger.warn(
            `[BullMQ] Giao dịch ${referenceCode} đã được xử lý thành công trước đó.`,
          );
          return { status: "ALREADY_SUCCESS", userId: dbTx.userId };
        }

        // 3. Cập nhật BillingTransaction thành SUCCESS
        const updatedTx = await tx.billingTransaction.update({
          where: { referenceCode },
          data: {
            status: "SUCCESS" as BillingTxStatus,
            providerTxId: providerTxId,
            metadata: job.data.rawPayload || {},
          },
        });

        // 4. Tính toán ngày hết hạn (Gia hạn thêm 30 ngày từ ngày hết hạn cũ nếu vẫn còn hạn)
        const existingSub = await tx.subscription.findUnique({
          where: { userId: dbTx.userId },
        });

        const now = new Date();
        let baseDate = now;
        // Nếu subscription hiện tại vẫn còn hạn và cùng tier, gia hạn bảo lưu ngày sử dụng
        if (
          existingSub &&
          existingSub.status === "ACTIVE" &&
          existingSub.renewalAt &&
          existingSub.renewalAt > now &&
          existingSub.tier === dbTx.tier
        ) {
          baseDate = new Date(existingSub.renewalAt);
        }

        const renewalAt = new Date(baseDate);
        renewalAt.setDate(baseDate.getDate() + 30);

        // 5. Nâng cấp Subscription của User
        await tx.subscription.upsert({
          where: { userId: dbTx.userId },
          create: {
            userId: dbTx.userId,
            tier: dbTx.tier,
            status: "ACTIVE",
            renewalAt: renewalAt,
          },
          update: {
            tier: dbTx.tier,
            status: "ACTIVE",
            renewalAt: renewalAt,
            // Chỉ reset createdAt (ngày bắt đầu chu kỳ mới) nếu nâng cấp khác tier hoặc gói cũ đã hết hạn
            createdAt:
              !existingSub ||
              existingSub.tier !== dbTx.tier ||
              !existingSub.renewalAt ||
              existingSub.renewalAt <= now
                ? new Date()
                : existingSub.createdAt,
          },
        });

        // 6. Ghi nhận lịch sử hoạt động cá nhân hóa
        await tx.userActivity.create({
          data: {
            userId: dbTx.userId,
            activityType: "SUBSCRIBE", // Log subscription event
            symbol: null,
            metadata: {
              amount: amount,
              provider: provider,
              tier: dbTx.tier,
              referenceCode,
            },
          },
        });

        return { status: "PROCESSED", userId: dbTx.userId, tier: dbTx.tier };
      });

      // 7. Giải phóng bộ nhớ Cache của User sau khi nâng cấp thành công
      if (result.status === "PROCESSED") {
        await this.redisService.invalidateUserCache(result.userId);
        this.logger.log(
          `[Success] Nâng cấp thành công gói ${result.tier} cho User ${result.userId} (Ref: ${referenceCode})`,
        );
      }

      return result;
    } catch (err: any) {
      this.logger.error(
        `[Error] Thất bại khi xử lý đơn hàng ${referenceCode}: ${err.message}`,
      );
      throw err; // Ném lỗi để BullMQ tự động retry
    } finally {
      // 8. Giải phóng Khóa phân tán
      await redisClient.del(lockKey);
    }
  }
}
