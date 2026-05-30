-- CreateTable
CREATE TABLE "market_knowledge_chunks" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT,
    "symbol" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "embedding" DOUBLE PRECISION[],

    CONSTRAINT "market_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_knowledge_chunks_symbol_idx" ON "market_knowledge_chunks"("symbol");

-- CreateIndex
CREATE INDEX "market_knowledge_chunks_type_idx" ON "market_knowledge_chunks"("type");

-- AddForeignKey
ALTER TABLE "market_knowledge_chunks" ADD CONSTRAINT "market_knowledge_chunks_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
