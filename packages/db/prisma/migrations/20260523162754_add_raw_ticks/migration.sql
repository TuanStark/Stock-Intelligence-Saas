-- CreateTable
CREATE TABLE "raw_ticks" (
    "time" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "volume" INTEGER NOT NULL,

    CONSTRAINT "raw_ticks_pkey" PRIMARY KEY ("symbol","time")
);

-- Kích hoạt TimescaleDB extension nếu chưa có
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Chuyển raw_ticks thành hypertable phân rã theo 1 ngày
SELECT create_hypertable('raw_ticks', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Tạo chỉ mục tối ưu hóa cho truy vấn ticks theo symbol và time
CREATE INDEX IF NOT EXISTS "idx_raw_ticks_symbol_time" ON "raw_ticks" ("symbol", "time" DESC);

-- Thiết lập Retention Policy tự động trên TimescaleDB: tự động xóa ticks cũ hơn 3 ngày
SELECT add_retention_policy('raw_ticks', INTERVAL '3 days', if_not_exists => TRUE);

