-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('VIEW_STOCK', 'CLICK_NEWS', 'SEARCH_SYMBOL', 'VIEW_SECTOR', 'INTERACT_AI', 'ADD_WATCHLIST', 'ADD_PORTFOLIO');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "symbol" TEXT,
    "sector_id" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interest_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferredSectors" JSONB NOT NULL,
    "viewedStocks" JSONB NOT NULL,
    "investmentStyle" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "risk_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 0.50,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_interest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "reasons" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "total_value" DECIMAL(24,8) NOT NULL,
    "cash_balance" DECIMAL(24,8) NOT NULL,
    "unrealized_pnl" DECIMAL(24,8) NOT NULL,
    "realized_pnl" DECIMAL(24,8) NOT NULL,
    "volatility" DECIMAL(10,4) NOT NULL,
    "allocation" JSONB NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personalized_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "related_symbol" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personalized_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activities_user_id_timestamp_idx" ON "user_activities"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "user_activities_symbol_idx" ON "user_activities"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "user_interest_profiles_user_id_key" ON "user_interest_profiles"("user_id");

-- CreateIndex
CREATE INDEX "recommendation_scores_user_id_score_idx" ON "recommendation_scores"("user_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_scores_user_id_instrument_id_key" ON "recommendation_scores"("user_id", "instrument_id");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_portfolio_id_recorded_at_idx" ON "portfolio_snapshots"("portfolio_id", "recorded_at");

-- CreateIndex
CREATE INDEX "personalized_notifications_user_id_is_read_created_at_idx" ON "personalized_notifications"("user_id", "is_read", "created_at");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interest_profiles" ADD CONSTRAINT "user_interest_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_scores" ADD CONSTRAINT "recommendation_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_scores" ADD CONSTRAINT "recommendation_scores_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personalized_notifications" ADD CONSTRAINT "personalized_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
