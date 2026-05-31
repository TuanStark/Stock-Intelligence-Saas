-- CreateEnum
CREATE TYPE "BillingTxStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYOS', 'SEPAY');

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "reference_code" TEXT NOT NULL,
    "provider_tx_id" TEXT,
    "status" "BillingTxStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_transactions_reference_code_key" ON "billing_transactions"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "billing_transactions_provider_tx_id_key" ON "billing_transactions"("provider_tx_id");

-- CreateIndex
CREATE INDEX "billing_transactions_user_id_idx" ON "billing_transactions"("user_id");

-- CreateIndex
CREATE INDEX "billing_transactions_reference_code_idx" ON "billing_transactions"("reference_code");

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
